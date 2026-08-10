import { randomUUID } from 'node:crypto';
import { monitorEventLoopDelay, performance } from 'node:perf_hooks';

const SNAPSHOT_INTERVAL_MS = 125;
const MAX_NAME_LENGTH = 18;
const WORLD_HALF_WIDTH = 720;
const WORLD_HALF_DEPTH = 720;
const INTEREST_CELL_SIZE = 160;
const INTEREST_RADIUS = 260;
const MAX_INTEREST_PLAYERS = 32;
const MAX_BUFFERED_BYTES = 1024 * 1024;
const INTEREST_CELL_RADIUS = Math.ceil(INTEREST_RADIUS / INTEREST_CELL_SIZE);
const INTEREST_CELL_OFFSETS = [];
for (let z = -INTEREST_CELL_RADIUS; z <= INTEREST_CELL_RADIUS; z += 1) {
  for (let x = -INTEREST_CELL_RADIUS; x <= INTEREST_CELL_RADIUS; x += 1) {
    INTEREST_CELL_OFFSETS.push([x, z, x * x + z * z]);
  }
}
INTEREST_CELL_OFFSETS.sort((a, b) => a[2] - b[2]);

const clamp = (value, minimum, maximum) => Math.min(maximum, Math.max(minimum, Number(value) || 0));
const cleanText = (value, maximum = MAX_NAME_LENGTH) => String(value || '').replace(/[<>\u0000-\u001f]/g, '').trim().slice(0, maximum);
const cleanTeam = (value) => value === 'blue' ? 'blue' : 'red';
const cleanCountry = (value) => /^[A-Z]{2}$/.test(String(value || '').toUpperCase()) ? String(value).toUpperCase() : 'TR';
const GLOBAL_ROOM_ID = cleanText(process.env.BIBISH_ROOM_ID || 'global', 48) || 'global';
const SERVER_INSTANCE_ID = cleanText(process.env.BIBISH_INSTANCE_ID, 64) || randomUUID();
const PAINT_HISTORY_LIMIT = 1000;
const DEATH_SCORE_PENALTY = 25;
const FORTS = [
  { x: -510, z: -450, team: 'red' }, { x: -255, z: -490, team: 'red' },
  { x: 0, z: -510, team: 'red' }, { x: 255, z: -490, team: 'red' },
  { x: 510, z: -450, team: 'red' }, { x: -510, z: 450, team: 'blue' },
  { x: -255, z: 490, team: 'blue' }, { x: 0, z: 510, team: 'blue' },
  { x: 255, z: 490, team: 'blue' }, { x: 510, z: 450, team: 'blue' },
];

function publicPlayer(player) {
  return [
    player.id, player.name, player.team, player.countryCode,
    player.x, player.y, player.z, player.yaw, player.pitch,
    player.stance, player.weapon, player.mode, player.shieldActive ? 1 : 0,
    player.health, player.score, player.kills, player.deaths, player.elapsedSeconds,
    player.phase, player.action, player.dead ? 1 : 0,
  ];
}

export function createGameRoom({ now = () => Date.now() } = {}) {
  const sockets = new Set();
  const players = new Map();
  const deviceSessions = new Map();
  const paintHistory = [];
  const fortOwners = FORTS.map((fort) => fort.team);
  let eventSequence = 0;
  let totalConnections = 0;
  let inboundMessages = 0;
  let outboundMessages = 0;
  let snapshots = 0;
  let snapshotDeliveries = 0;
  let snapshotPlayerRecords = 0;
  let droppedSnapshots = 0;
  let inboundBytes = 0;
  let outboundBytes = 0;
  let dirty = true;
  const startedAt = performance.now();
  const startedCpu = process.cpuUsage();
  const eventLoopDelay = monitorEventLoopDelay({ resolution: 20 });
  eventLoopDelay.enable();

  function teamCounts() {
    let red = 0;
    let blue = 0;
    for (const player of players.values()) player.team === 'red' ? red += 1 : blue += 1;
    return { red, blue };
  }

  function balancedTeam(preferred) {
    const counts = teamCounts();
    if (counts.red < counts.blue) return 'red';
    if (counts.blue < counts.red) return 'blue';
    return cleanTeam(preferred);
  }

  function send(socket, message) {
    if (socket.readyState !== 1) return;
    const payload = JSON.stringify(message);
    socket.send(payload);
    outboundMessages += 1;
    outboundBytes += Buffer.byteLength(payload);
  }

  function broadcast(message) {
    for (const socket of sockets) send(socket, message);
  }

  function leaderboard(allPlayers = [...players.values()]) {
    return allPlayers
      .slice()
      .sort((a, b) => b.score - a.score || b.kills - a.kills || a.deaths - b.deaths)
      .slice(0, 12)
      .map((player) => [
        player.id, player.name, player.team, player.countryCode, player.score,
        player.elapsedSeconds, player.kills, player.deaths, player.dead ? 1 : 0,
      ]);
  }

  function gridKey(x, z) {
    return `${Math.floor(x / INTEREST_CELL_SIZE)}:${Math.floor(z / INTEREST_CELL_SIZE)}`;
  }

  function buildInterestGrid(allPlayers) {
    const grid = new Map();
    for (const player of allPlayers) {
      const key = gridKey(player.x, player.z);
      const cell = grid.get(key);
      if (cell) cell.push(player);
      else grid.set(key, [player]);
    }
    return grid;
  }

  function interestedPlayers(viewer, allPlayers, grid) {
    if (viewer.fullRoster) return allPlayers;
    const centerX = Math.floor(viewer.x / INTEREST_CELL_SIZE);
    const centerZ = Math.floor(viewer.z / INTEREST_CELL_SIZE);
    const radiusSquared = INTEREST_RADIUS * INTEREST_RADIUS;
    const selected = [];
    let hash = 0;
    for (let index = 0; index < viewer.id.length; index += 1) hash = (hash * 31 + viewer.id.charCodeAt(index)) >>> 0;
    for (const [offsetX, offsetZ] of INTEREST_CELL_OFFSETS) {
      const cell = grid.get(`${centerX + offsetX}:${centerZ + offsetZ}`);
      if (!cell) continue;
      const start = hash % cell.length;
      for (let index = 0; index < cell.length; index += 1) {
        const candidate = cell[(start + index) % cell.length];
        const dx = candidate.x - viewer.x;
        const dz = candidate.z - viewer.z;
        if (dx * dx + dz * dz > radiusSquared) continue;
        selected.push(candidate);
        if (selected.length >= MAX_INTEREST_PLAYERS) return selected;
      }
    }
    return selected;
  }

  function broadcastSnapshot(force = false) {
    if (!force && !dirty) return;
    dirty = false;
    const counts = teamCounts();
    const allPlayers = [...players.values()];
    const grid = buildInterestGrid(allPlayers);
    const leaders = leaderboard(allPlayers);
    const serverTime = now();
    for (const socket of sockets) {
      if (socket.readyState !== 1) continue;
      if (socket.bufferedAmount > MAX_BUFFERED_BYTES) {
        droppedSnapshots += 1;
        continue;
      }
      const viewer = players.get(socket);
      const visiblePlayers = viewer ? interestedPlayers(viewer, allPlayers, grid) : [];
      const message = JSON.stringify({
        type: 'snapshot',
        serverTime,
        counts,
        totalPlayers: allPlayers.length,
        leaders,
        players: visiblePlayers.map(publicPlayer),
      });
      socket.send(message);
      outboundMessages += 1;
      outboundBytes += Buffer.byteLength(message);
      snapshotDeliveries += 1;
      snapshotPlayerRecords += visiblePlayers.length;
    }
    snapshots += 1;
  }

  function handleGameEvent(socket, player, input) {
    if (!input || typeof input !== 'object' || player.dead) return;
    const kind = cleanText(input.kind, 24);
    if (kind === 'paint') {
      const x = clamp(input.x, -WORLD_HALF_WIDTH, WORLD_HALF_WIDTH);
      const y = clamp(input.y, -100, 250);
      const z = clamp(input.z, -WORLD_HALF_DEPTH, WORLD_HALF_DEPTH);
      if (Math.hypot(x - player.x, z - player.z) > 205) return;
      const wasteType = ['pee', 'vomit', 'poop'].includes(input.wasteType) ? input.wasteType : null;
      if (!wasteType) return;
      const event = {
        kind, eventId: ++eventSequence, sourceId: player.id, team: player.team,
        wasteType, x, y, z, radius: clamp(input.radius, 0.1, 2),
      };
      paintHistory.push(event);
      if (paintHistory.length > PAINT_HISTORY_LIMIT) paintHistory.splice(0, paintHistory.length - PAINT_HISTORY_LIMIT);
      broadcast({ type: 'game-event', event });
      return;
    }

    if (kind === 'fort') {
      const fortIndex = Math.round(clamp(input.fortIndex, 0, FORTS.length - 1));
      const fort = FORTS[fortIndex];
      if (!fort || Math.hypot(player.x - fort.x, player.z - fort.z) > 58) return;
      let allies = 0;
      let enemies = 0;
      for (const candidate of players.values()) {
        if (candidate.dead || Math.hypot(candidate.x - fort.x, candidate.z - fort.z) > 44) continue;
        if (candidate.team === player.team) allies += 1;
        else enemies += 1;
      }
      if (allies <= enemies || fortOwners[fortIndex] === player.team) return;
      fortOwners[fortIndex] = player.team;
      broadcast({
        type: 'game-event',
        event: { kind, eventId: ++eventSequence, sourceId: player.id, fortIndex, team: player.team },
      });
      return;
    }

    if (kind !== 'damage') return;
    let targetSocket = null;
    let target = null;
    for (const [candidateSocket, candidate] of players.entries()) {
      if (candidate.id === cleanText(input.targetId, 64)) {
        targetSocket = candidateSocket;
        target = candidate;
        break;
      }
    }
    if (!target || target.id === player.id || target.team === player.team || target.dead) return;
    const weapon = input.weapon === 'sword' ? 'sword' : 'rifle';
    const eventNow = now();
    const cooldown = weapon === 'sword' ? 520 : 160;
    if (eventNow - (player.lastAttackAt || 0) < cooldown) return;
    const distance = Math.hypot(target.x - player.x, target.y - player.y, target.z - player.z);
    if (distance > (weapon === 'sword' ? 4.2 : 800)) return;
    player.lastAttackAt = eventNow;
    const forwardX = -Math.sin(target.yaw);
    const forwardZ = -Math.cos(target.yaw);
    const attackerLength = Math.max(0.001, Math.hypot(player.x - target.x, player.z - target.z));
    const shieldAlignment = (forwardX * (player.x - target.x) + forwardZ * (player.z - target.z)) / attackerLength;
    if (target.weapon === 1 && target.shieldActive && shieldAlignment > 0.22) {
      broadcast({
        type: 'game-event',
        event: { kind: 'blocked', eventId: ++eventSequence, sourceId: player.id, targetId: target.id, source: [player.x, player.y, player.z] },
      });
      return;
    }
    const zone = ['head', 'torso', 'limb'].includes(input.zone) ? input.zone : 'torso';
    let baseDamage = weapon === 'sword' ? 36 : zone === 'head' ? 100 : zone === 'limb' ? 28 : 38;
    if (weapon === 'rifle' && distance > 45) baseDamage *= Math.max(0.55, 1 - (distance - 45) / 900);
    const appliedDamage = Math.min(target.health, Math.max(1, Math.round(baseDamage)));
    target.health = Math.max(0, target.health - appliedDamage);
    player.score += appliedDamage;
    const killed = target.health <= 0;
    if (killed) {
      target.dead = true;
      target.diedAt = eventNow;
      target.deaths += 1;
      target.score = Math.max(0, target.score - DEATH_SCORE_PENALTY);
      player.kills += 1;
      player.score += 100;
    }
    player.statsLockedUntil = eventNow + 1200;
    target.statsLockedUntil = eventNow + 1200;
    target.updatedAt = eventNow;
    dirty = true;
    broadcast({
      type: 'game-event',
      event: {
        kind, eventId: ++eventSequence, sourceId: player.id, targetId: target.id,
        source: [player.x, player.y, player.z], weapon, zone, distance,
        damage: appliedDamage, health: target.health, killed,
        attacker: { id: player.id, name: player.name, team: player.team, countryCode: player.countryCode },
        victim: { id: target.id, name: target.name, team: target.team, countryCode: target.countryCode },
        attackerStats: { score: player.score, kills: player.kills },
        targetStats: { score: target.score, deaths: target.deaths },
      },
    });
  }

  function attach(socket) {
    sockets.add(socket);
    totalConnections += 1;
    socket.missedPongs = 0;
    socket.on('pong', () => { socket.missedPongs = 0; });
    socket.on('message', (raw) => {
      inboundMessages += 1;
      inboundBytes += raw.byteLength ?? Buffer.byteLength(String(raw));
      let message;
      try { message = JSON.parse(String(raw)); } catch { return; }
      if (message.type === 'observe') {
        const allPlayers = [...players.values()];
        send(socket, {
          type: 'snapshot',
          serverTime: now(),
          counts: teamCounts(),
          totalPlayers: allPlayers.length,
          leaders: leaderboard(allPlayers),
          players: [],
        });
        return;
      }
      if (message.type === 'join') {
        const previous = players.get(socket);
        const deviceKey = cleanText(message.deviceKey, 96);
        const allowDuplicateDevice = process.env.NODE_ENV !== 'production' && Boolean(message.allowDuplicateDevice);
        const activeDeviceSocket = deviceKey ? deviceSessions.get(deviceKey) : null;
        if (!deviceKey || (!allowDuplicateDevice && activeDeviceSocket && activeDeviceSocket !== socket && activeDeviceSocket.readyState === 1)) {
          send(socket, { type: 'session-rejected', reason: deviceKey ? 'duplicate-device' : 'device-id-required' });
          setTimeout(() => socket.close(4009, 'duplicate-device'), 20).unref?.();
          return;
        }
        if (previous?.deviceKey && previous.deviceKey !== deviceKey && deviceSessions.get(previous.deviceKey) === socket) {
          deviceSessions.delete(previous.deviceKey);
        }
        if (!allowDuplicateDevice) deviceSessions.set(deviceKey, socket);
        const team = previous?.team || balancedTeam(message.team);
        const player = {
          id: cleanText(message.clientId, 64) || randomUUID(),
          name: cleanText(message.name) || 'BibishPlayer',
          team,
          countryCode: cleanCountry(message.countryCode),
          x: 0, y: 0, z: team === 'red' ? -430 : 430,
          yaw: team === 'red' ? Math.PI : 0, pitch: 0,
          stance: 'stand', weapon: 0, mode: 0, shieldActive: false,
          health: 100,
          score: clamp(message.score, 0, 1_000_000_000),
          kills: clamp(message.kills, 0, 1_000_000),
          deaths: clamp(message.deaths, 0, 1_000_000),
          elapsedSeconds: clamp(message.elapsedSeconds, 0, 1_000_000_000),
          phase: 0, action: 0, dead: false, updatedAt: now(),
          deviceKey,
          fullRoster: process.env.BIBISH_ALLOW_FULL_ROSTER === '1' && Boolean(message.loadTestFullRoster),
        };
        players.set(socket, player);
        dirty = true;
        send(socket, {
          type: 'welcome',
          clientId: player.id,
          team,
          roomId: GLOBAL_ROOM_ID,
          instanceId: SERVER_INSTANCE_ID,
          counts: teamCounts(),
          snapshotHz: 1000 / SNAPSHOT_INTERVAL_MS,
        });
        send(socket, { type: 'world-state', paint: paintHistory, forts: fortOwners, eventSequence });
        return;
      }
      const player = players.get(socket);
      if (!player) return;
      if (message.type === 'ping') {
        send(socket, { type: 'pong', sentAt: Number(message.sentAt) || 0, serverTime: now() });
        return;
      }
      if (message.type === 'game-event') {
        handleGameEvent(socket, player, message.event);
        return;
      }
      if (message.type !== 'state') return;
      player.x = clamp(message.x, -WORLD_HALF_WIDTH, WORLD_HALF_WIDTH);
      player.y = clamp(message.y, -100, 250);
      player.z = clamp(message.z, -WORLD_HALF_DEPTH, WORLD_HALF_DEPTH);
      player.yaw = clamp(message.yaw, -Math.PI * 4, Math.PI * 4);
      player.pitch = clamp(message.pitch, -Math.PI / 2, Math.PI / 2);
      player.stance = ['stand', 'crouch', 'prone'].includes(message.stance) ? message.stance : 'stand';
      player.weapon = clamp(message.weapon, 0, 1);
      player.mode = clamp(message.mode, 0, 1);
      player.shieldActive = Boolean(message.shieldActive);
      const stateNow = now();
      const reportedHealth = clamp(message.health, 0, 100);
      if (player.dead) {
        if (!message.dead && stateNow - (player.diedAt || stateNow) >= 2800) {
          player.dead = false;
          player.health = 100;
          player.diedAt = 0;
        } else player.health = 0;
      } else {
        const elapsed = Math.max(0, (stateNow - (player.updatedAt || stateNow)) / 1000);
        player.health = Math.min(reportedHealth, player.health + elapsed * 7 + 0.75);
      }
      if (stateNow >= (player.statsLockedUntil || 0)) {
        player.score = clamp(message.score, 0, 1_000_000_000);
        player.kills = clamp(message.kills, 0, 1_000_000);
        player.deaths = clamp(message.deaths, 0, 1_000_000);
      }
      player.elapsedSeconds = clamp(message.elapsedSeconds, 0, 1_000_000_000);
      player.phase = clamp(message.phase, -1_000_000, 1_000_000);
      player.action = clamp(message.action, 0, 8);
      if (!player.dead) player.dead = Boolean(message.dead);
      player.updatedAt = stateNow;
      dirty = true;
    });
    socket.on('close', () => {
      sockets.delete(socket);
      const player = players.get(socket);
      if (player?.deviceKey && deviceSessions.get(player.deviceKey) === socket) deviceSessions.delete(player.deviceKey);
      if (players.delete(socket)) dirty = true;
    });
  }

  const snapshotTimer = setInterval(() => broadcastSnapshot(false), SNAPSHOT_INTERVAL_MS);
  snapshotTimer.unref?.();
  const heartbeatTimer = setInterval(() => {
    for (const socket of sockets) {
      // Browser background tabs can heavily throttle requestAnimationFrame and state
      // packets. The WebSocket transport's pong is the authoritative liveness signal;
      // a temporarily idle player must not be removed from the shared world.
      if (socket.missedPongs >= 6) {
        socket.terminate();
        continue;
      }
      socket.missedPongs += 1;
      socket.ping();
    }
  }, 10000);
  heartbeatTimer.unref?.();

  return {
    attach,
    getMetrics: () => {
      const elapsedMs = Math.max(1, performance.now() - startedAt);
      const cpu = process.cpuUsage(startedCpu);
      return {
        connected: sockets.size,
        players: players.size,
        activeDevices: deviceSessions.size,
        roomId: GLOBAL_ROOM_ID,
        instanceId: SERVER_INSTANCE_ID,
        teams: teamCounts(),
        totalConnections,
        inboundMessages,
        outboundMessages,
        inboundBytes,
        outboundBytes,
        snapshots,
        snapshotDeliveries,
        snapshotPlayerRecords,
        averagePlayersPerSnapshot: snapshotDeliveries ? snapshotPlayerRecords / snapshotDeliveries : 0,
        droppedSnapshots,
        snapshotHz: 1000 / SNAPSHOT_INTERVAL_MS,
        interestRadius: INTEREST_RADIUS,
        maxInterestPlayers: MAX_INTEREST_PLAYERS,
        cpuPercentSingleCore: (cpu.user + cpu.system) / (elapsedMs * 1000) * 100,
        eventLoopMeanMs: Number.isFinite(eventLoopDelay.mean) ? eventLoopDelay.mean / 1e6 : 0,
        eventLoopP99Ms: eventLoopDelay.percentile(99) / 1e6,
        eventLoopMaxMs: eventLoopDelay.max / 1e6,
        memory: process.memoryUsage(),
      };
    },
    close: () => {
      clearInterval(snapshotTimer);
      clearInterval(heartbeatTimer);
      eventLoopDelay.disable();
      for (const socket of sockets) socket.close(1001, 'server-shutdown');
    },
  };
}
