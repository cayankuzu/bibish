const SNAPSHOT_INTERVAL_MS = 125;
const MAX_NAME_LENGTH = 18;
const WORLD_HALF_WIDTH = 720;
const WORLD_HALF_DEPTH = 720;
const INTEREST_CELL_SIZE = 160;
const INTEREST_RADIUS = 260;
const MAX_INTEREST_PLAYERS = 32;
const MAX_MESSAGE_BYTES = 8 * 1024;
const MAX_MESSAGES_PER_SECOND = 40;
const ROOM_ID = 'global';
const PAINT_HISTORY_LIMIT = 1000;
const WORLD_STATE_SCHEMA_VERSION = 3;
const DEATH_SCORE_PENALTY = 25;
const FORTS = [
  { x: -510, z: -450, team: 'red' }, { x: -255, z: -490, team: 'red' },
  { x: 0, z: -510, team: 'red' }, { x: 255, z: -490, team: 'red' },
  { x: 510, z: -450, team: 'red' }, { x: -510, z: 450, team: 'blue' },
  { x: -255, z: 490, team: 'blue' }, { x: 0, z: 510, team: 'blue' },
  { x: 255, z: 490, team: 'blue' }, { x: 510, z: 450, team: 'blue' },
];
const encoder = new TextEncoder();
const decoder = new TextDecoder();

const clamp = (value, minimum, maximum) => Math.min(maximum, Math.max(minimum, Number(value) || 0));
const cleanText = (value, maximum = MAX_NAME_LENGTH) => String(value || '')
  .replace(/[<>\u0000-\u001f]/g, '')
  .trim()
  .slice(0, maximum);
const cleanTeam = (value) => value === 'blue' ? 'blue' : 'red';
const cleanCountry = (value) => /^[A-Z]{2}$/.test(String(value || '').toUpperCase())
  ? String(value).toUpperCase()
  : 'TR';

function byteLength(value) {
  if (typeof value === 'string') return encoder.encode(value).byteLength;
  if (value instanceof ArrayBuffer) return value.byteLength;
  if (ArrayBuffer.isView(value)) return value.byteLength;
  return 0;
}

function decodeMessage(value) {
  if (typeof value === 'string') return value;
  if (value instanceof ArrayBuffer) return decoder.decode(value);
  if (ArrayBuffer.isView(value)) return decoder.decode(value);
  return '';
}

function publicPlayer(player) {
  return [
    player.id, player.name, player.team, player.countryCode,
    player.x, player.y, player.z, player.yaw, player.pitch,
    player.stance, player.weapon, player.mode, player.shieldActive ? 1 : 0,
    player.health, player.score, player.kills, player.deaths, player.elapsedSeconds,
    player.phase, player.action, player.dead ? 1 : 0,
  ];
}

export class GameRoom {
  constructor(ctx) {
    this.ctx = ctx;
    this.sql = ctx.storage.sql;
    this.players = new Map();
    this.deviceSessions = new Map();
    this.snapshotTimer = null;
    this.paintHistory = [];
    this.fortOwners = FORTS.map((fort) => fort.team);
    this.eventSequence = 0;
    this.dirty = false;
    this.startedAt = Date.now();
    this.worldActiveElapsedMs = 0;
    this.worldRunningSince = null;
    this.instanceId = `do-${ctx.id.toString().slice(0, 20)}`;
    this.metrics = {
      totalConnections: 0,
      inboundMessages: 0,
      outboundMessages: 0,
      inboundBytes: 0,
      outboundBytes: 0,
      snapshots: 0,
      snapshotDeliveries: 0,
      snapshotPlayerRecords: 0,
      droppedSnapshots: 0,
      rejectedSessions: 0,
      rateLimitedMessages: 0,
    };

    // A Durable Object's RAM is discarded during deployments and normal
    // eviction. Keep the authoritative world in the object's SQLite storage
    // and rebuild the hot in-memory copy before accepting any request.
    // SQLite operations are synchronous inside a Durable Object, so schema
    // creation and hydration finish atomically before this constructor returns.
    this.restorePersistentWorld();

    for (const socket of this.ctx.getWebSockets()) {
      const attachment = socket.deserializeAttachment?.();
      if (!attachment?.player) continue;
      this.players.set(socket, attachment.player);
      if (attachment.player.deviceKey) this.deviceSessions.set(attachment.player.deviceKey, socket);
    }
    this.synchronizeWorldClock();
    if (this.ctx.getWebSockets().length) this.startSnapshotLoop();
  }

  restorePersistentWorld() {
    this.sql.exec(`
      CREATE TABLE IF NOT EXISTS world_meta (
        key TEXT PRIMARY KEY,
        value INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS paint_events (
        event_id INTEGER PRIMARY KEY,
        source_id TEXT NOT NULL,
        team TEXT NOT NULL,
        waste_type TEXT NOT NULL,
        x REAL NOT NULL,
        y REAL NOT NULL,
        z REAL NOT NULL,
        radius REAL NOT NULL
      );
      CREATE TABLE IF NOT EXISTS fort_owners (
        fort_index INTEGER PRIMARY KEY,
        team TEXT NOT NULL
      );
    `);

    this.paintHistory = this.sql.exec(`
      SELECT event_id, source_id, team, waste_type, x, y, z, radius
      FROM paint_events
      ORDER BY event_id ASC
    `).toArray().map((row) => ({
      kind: 'paint',
      eventId: Number(row.event_id),
      sourceId: String(row.source_id),
      team: cleanTeam(row.team),
      wasteType: ['pee', 'vomit', 'poop'].includes(row.waste_type) ? row.waste_type : 'pee',
      x: Number(row.x),
      y: Number(row.y),
      z: Number(row.z),
      radius: Number(row.radius),
    }));

    for (const row of this.sql.exec('SELECT fort_index, team FROM fort_owners')) {
      const index = Math.round(Number(row.fort_index));
      if (index >= 0 && index < this.fortOwners.length) this.fortOwners[index] = cleanTeam(row.team);
    }

    const metaRows = this.sql.exec("SELECT value FROM world_meta WHERE key = 'event_sequence'").toArray();
    const storedSequence = Number(metaRows[0]?.value) || 0;
    const latestPaintSequence = Number(this.paintHistory.at(-1)?.eventId) || 0;
    // Wall-clock seeding guarantees that clients which stayed open across a
    // deployment never reject new events as older duplicate sequence IDs.
    this.eventSequence = Math.max(storedSequence, latestPaintSequence, Date.now() * 1000);
    const activeElapsedRows = this.sql.exec("SELECT value FROM world_meta WHERE key = 'world_active_elapsed_ms'").toArray();
    const runningSinceRows = this.sql.exec("SELECT value FROM world_meta WHERE key = 'world_clock_running_since'").toArray();
    if (activeElapsedRows.length) {
      this.worldActiveElapsedMs = Math.max(0, Number(activeElapsedRows[0]?.value) || 0);
      this.worldRunningSince = Math.max(0, Number(runningSinceRows[0]?.value) || 0) || null;
    } else {
      const worldStartRows = this.sql.exec("SELECT value FROM world_meta WHERE key = 'world_started_at'").toArray();
      const legacyWorldStartedAt = Math.max(1, Number(worldStartRows[0]?.value) || Date.now());
      this.worldActiveElapsedMs = Math.max(0, Date.now() - legacyWorldStartedAt);
      this.worldRunningSince = null;
    }
    this.persistWorldClock();
    this.sql.exec(
      'INSERT OR REPLACE INTO world_meta (key, value) VALUES (?, ?)',
      'schema_version',
      WORLD_STATE_SCHEMA_VERSION,
    );
  }

  worldClockSnapshot(at = Date.now()) {
    const elapsedMs = Math.max(0, this.worldActiveElapsedMs
      + (this.worldRunningSince === null ? 0 : Math.max(0, at - this.worldRunningSince)));
    return {
      worldStartedAt: at - elapsedMs,
      worldActiveElapsedMs: elapsedMs,
      worldClockRunning: this.worldRunningSince !== null,
      serverTime: at,
    };
  }

  persistWorldClock() {
    const clock = this.worldClockSnapshot();
    this.sql.exec(
      'INSERT OR REPLACE INTO world_meta (key, value) VALUES (?, ?), (?, ?), (?, ?)',
      'world_active_elapsed_ms', Math.round(this.worldActiveElapsedMs),
      'world_clock_running_since', Math.round(this.worldRunningSince || 0),
      'world_started_at', Math.round(clock.worldStartedAt),
    );
  }

  synchronizeWorldClock() {
    const clockNow = Date.now();
    if (this.players.size > 0 && this.worldRunningSince === null) {
      this.worldRunningSince = clockNow;
      this.persistWorldClock();
    } else if (this.players.size === 0 && this.worldRunningSince !== null) {
      this.worldActiveElapsedMs += Math.max(0, clockNow - this.worldRunningSince);
      this.worldRunningSince = null;
      this.persistWorldClock();
    }
  }

  nextEventId() {
    this.eventSequence = Math.max(this.eventSequence + 1, Date.now() * 1000);
    return this.eventSequence;
  }

  persistEventSequence() {
    this.sql.exec(
      'INSERT OR REPLACE INTO world_meta (key, value) VALUES (?, ?)',
      'event_sequence',
      this.eventSequence,
    );
  }

  persistPaintEvent(event) {
    this.sql.exec(
      `INSERT OR REPLACE INTO paint_events
        (event_id, source_id, team, waste_type, x, y, z, radius)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      event.eventId,
      event.sourceId,
      event.team,
      event.wasteType,
      event.x,
      event.y,
      event.z,
      event.radius,
    );
    this.sql.exec(
      `DELETE FROM paint_events
       WHERE event_id NOT IN (
         SELECT event_id FROM paint_events ORDER BY event_id DESC LIMIT ?
       )`,
      PAINT_HISTORY_LIMIT,
    );
    this.persistEventSequence();
  }

  persistFortOwner(fortIndex, team) {
    this.sql.exec(
      'INSERT OR REPLACE INTO fort_owners (fort_index, team) VALUES (?, ?)',
      fortIndex,
      team,
    );
    this.persistEventSequence();
  }

  async fetch(request) {
    const url = new URL(request.url);
    if (url.pathname === '/health' || url.pathname === '/metrics') {
      return Response.json({ ok: true, ...this.getMetrics() }, {
        headers: { 'cache-control': 'no-store', 'access-control-allow-origin': '*' },
      });
    }
    if (url.pathname !== '/ws' || request.headers.get('Upgrade')?.toLowerCase() !== 'websocket') {
      return new Response('Not found', { status: 404 });
    }

    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);
    this.ctx.acceptWebSocket(server);
    server.serializeAttachment({ connectedAt: Date.now(), player: null });
    this.metrics.totalConnections += 1;
    this.startSnapshotLoop();
    return new Response(null, { status: 101, webSocket: client });
  }

  startSnapshotLoop() {
    if (this.snapshotTimer) return;
    this.snapshotTimer = setInterval(() => {
      if (!this.ctx.getWebSockets().length) {
        clearInterval(this.snapshotTimer);
        this.snapshotTimer = null;
        return;
      }
      this.broadcastSnapshot();
    }, SNAPSHOT_INTERVAL_MS);
  }

  send(socket, message) {
    if (socket.readyState !== WebSocket.OPEN) return false;
    const payload = JSON.stringify(message);
    try {
      socket.send(payload);
      this.metrics.outboundMessages += 1;
      this.metrics.outboundBytes += byteLength(payload);
      return true;
    } catch {
      return false;
    }
  }

  broadcast(message) {
    for (const socket of this.players.keys()) this.send(socket, message);
  }

  persistPlayer(socket, player) {
    const attachment = socket.deserializeAttachment?.() || {};
    attachment.player = player;
    socket.serializeAttachment(attachment);
  }

  findPlayerSocket(id) {
    for (const [socket, player] of this.players.entries()) {
      if (player.id === id) return [socket, player];
    }
    return null;
  }

  leaderboard(allPlayers = [...this.players.values()]) {
    return allPlayers
      .slice()
      .sort((a, b) => b.score - a.score || b.kills - a.kills || a.deaths - b.deaths)
      .slice(0, 12)
      .map((player) => [
        player.id, player.name, player.team, player.countryCode, player.score,
        player.elapsedSeconds, player.kills, player.deaths, player.dead ? 1 : 0,
      ]);
  }

  teamCounts() {
    let red = 0;
    let blue = 0;
    for (const player of this.players.values()) player.team === 'red' ? red += 1 : blue += 1;
    return { red, blue };
  }

  teamStatistics(allPlayers = [...this.players.values()]) {
    const totals = {
      red: { players: 0, score: 0, kills: 0, deaths: 0, elapsedSeconds: 0 },
      blue: { players: 0, score: 0, kills: 0, deaths: 0, elapsedSeconds: 0 },
    };
    for (const player of allPlayers) {
      const team = cleanTeam(player.team);
      totals[team].players += 1;
      totals[team].score += Math.max(0, Number(player.score) || 0);
      totals[team].kills += Math.max(0, Number(player.kills) || 0);
      totals[team].deaths += Math.max(0, Number(player.deaths) || 0);
      totals[team].elapsedSeconds += Math.max(0, Number(player.elapsedSeconds) || 0);
    }
    return totals;
  }

  balancedTeam(preferred) {
    const counts = this.teamCounts();
    if (counts.red < counts.blue) return 'red';
    if (counts.blue < counts.red) return 'blue';
    return cleanTeam(preferred);
  }

  playerForJoin(message) {
    const team = this.balancedTeam(message.team);
    return {
      id: cleanText(message.clientId, 64) || crypto.randomUUID(),
      name: cleanText(message.name) || 'BibishPlayer',
      team,
      countryCode: cleanCountry(message.countryCode),
      x: 0,
      y: 0,
      z: team === 'red' ? -430 : 430,
      yaw: team === 'red' ? Math.PI : 0,
      pitch: 0,
      stance: 'stand',
      weapon: 0,
      mode: 0,
      shieldActive: false,
      health: 100,
      score: clamp(message.score, 0, 1_000_000_000),
      kills: clamp(message.kills, 0, 1_000_000),
      deaths: clamp(message.deaths, 0, 1_000_000),
      elapsedSeconds: clamp(message.elapsedSeconds, 0, 1_000_000_000),
      phase: 0,
      action: 0,
      dead: false,
      updatedAt: Date.now(),
      deviceKey: cleanText(message.deviceKey, 96),
    };
  }

  isRateLimited(socket, now) {
    const attachment = socket.deserializeAttachment?.() || {};
    let windowStartedAt = Number(attachment.messageWindowAt) || 0;
    let messageCount = Number(attachment.messageCount) || 0;
    if (!windowStartedAt || now - windowStartedAt >= 1000) {
      windowStartedAt = now;
      messageCount = 0;
    }
    attachment.messageWindowAt = windowStartedAt;
    messageCount += 1;
    attachment.messageCount = messageCount;
    socket.serializeAttachment(attachment);
    if (messageCount <= MAX_MESSAGES_PER_SECOND) return false;
    this.metrics.rateLimitedMessages += 1;
    return true;
  }

  webSocketMessage(socket, raw) {
    const size = byteLength(raw);
    this.metrics.inboundMessages += 1;
    this.metrics.inboundBytes += size;
    if (!size || size > MAX_MESSAGE_BYTES || this.isRateLimited(socket, Date.now())) return;

    let message;
    try { message = JSON.parse(decodeMessage(raw)); } catch { return; }
    if (message.type === 'observe') {
      const allPlayers = [...this.players.values()];
      const clock = this.worldClockSnapshot();
      this.send(socket, {
        type: 'snapshot',
        ...clock,
        counts: this.teamCounts(),
        totalPlayers: allPlayers.length,
        leaders: this.leaderboard(allPlayers),
        teamStats: this.teamStatistics(allPlayers),
        players: [],
      });
      return;
    }
    if (message.type === 'join') {
      this.join(socket, message);
      return;
    }

    const player = this.players.get(socket);
    if (!player) return;
    if (message.type === 'ping') {
      this.send(socket, { type: 'pong', sentAt: Number(message.sentAt) || 0, serverTime: Date.now() });
      return;
    }
    if (message.type === 'game-event') {
      this.handleGameEvent(socket, player, message.event);
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
    const now = Date.now();
    const reportedHealth = clamp(message.health, 0, 100);
    if (player.dead) {
      if (!message.dead && now - (player.diedAt || now) >= 2800) {
        player.dead = false;
        player.health = 100;
        player.diedAt = 0;
      } else {
        player.health = 0;
      }
    } else {
      const elapsed = Math.max(0, (now - (player.updatedAt || now)) / 1000);
      player.health = Math.min(reportedHealth, player.health + elapsed * 7 + 0.75);
    }
    if (now >= (player.statsLockedUntil || 0)) {
      player.score = clamp(message.score, 0, 1_000_000_000);
      player.kills = clamp(message.kills, 0, 1_000_000);
      player.deaths = clamp(message.deaths, 0, 1_000_000);
    }
    player.elapsedSeconds = clamp(message.elapsedSeconds, 0, 1_000_000_000);
    player.phase = clamp(message.phase, -1_000_000, 1_000_000);
    player.action = clamp(message.action, 0, 8);
    if (!player.dead) player.dead = Boolean(message.dead);
    player.updatedAt = now;
    this.persistPlayer(socket, player);
    this.dirty = true;
  }

  handleGameEvent(socket, player, input) {
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
        kind,
        eventId: this.nextEventId(),
        sourceId: player.id,
        team: player.team,
        wasteType,
        x,
        y,
        z,
        radius: clamp(input.radius, 0.1, 2),
      };
      this.paintHistory.push(event);
      if (this.paintHistory.length > PAINT_HISTORY_LIMIT) {
        this.paintHistory.splice(0, this.paintHistory.length - PAINT_HISTORY_LIMIT);
      }
      this.persistPaintEvent(event);
      this.broadcast({ type: 'game-event', event });
      return;
    }

    if (kind === 'fort') {
      const fortIndex = Math.round(clamp(input.fortIndex, 0, FORTS.length - 1));
      const fort = FORTS[fortIndex];
      if (!fort || Math.hypot(player.x - fort.x, player.z - fort.z) > 58) return;
      let allies = 0;
      let enemies = 0;
      for (const candidate of this.players.values()) {
        if (candidate.dead || Math.hypot(candidate.x - fort.x, candidate.z - fort.z) > 44) continue;
        if (candidate.team === player.team) allies += 1;
        else enemies += 1;
      }
      if (allies <= enemies || this.fortOwners[fortIndex] === player.team) return;
      this.fortOwners[fortIndex] = player.team;
      const eventId = this.nextEventId();
      this.persistFortOwner(fortIndex, player.team);
      this.broadcast({
        type: 'game-event',
        event: { kind, eventId, sourceId: player.id, fortIndex, team: player.team },
      });
      return;
    }

    if (kind !== 'damage') return;
    const targetEntry = this.findPlayerSocket(cleanText(input.targetId, 64));
    if (!targetEntry) return;
    const [targetSocket, target] = targetEntry;
    if (target.id === player.id || target.team === player.team || target.dead) return;
    const weapon = input.weapon === 'sword' ? 'sword' : 'rifle';
    const now = Date.now();
    const cooldown = weapon === 'sword' ? 520 : 160;
    if (now - (player.lastAttackAt || 0) < cooldown) return;
    const distance = Math.hypot(target.x - player.x, target.y - player.y, target.z - player.z);
    if (distance > (weapon === 'sword' ? 4.2 : 800)) return;
    player.lastAttackAt = now;

    const forwardX = -Math.sin(target.yaw);
    const forwardZ = -Math.cos(target.yaw);
    const attackerLength = Math.max(0.001, Math.hypot(player.x - target.x, player.z - target.z));
    const shieldAlignment = (forwardX * (player.x - target.x) + forwardZ * (player.z - target.z)) / attackerLength;
    if (target.weapon === 1 && target.shieldActive && shieldAlignment > 0.22) {
      this.broadcast({
        type: 'game-event',
        event: {
          kind: 'blocked', eventId: this.nextEventId(), sourceId: player.id,
          targetId: target.id, source: [player.x, player.y, player.z],
        },
      });
      return;
    }

    const zone = ['head', 'torso', 'limb'].includes(input.zone) ? input.zone : 'torso';
    let baseDamage = weapon === 'sword' ? 36 : zone === 'head' ? 100 : zone === 'limb' ? 28 : 38;
    if (weapon === 'rifle' && distance > 45) {
      const falloff = Math.max(0.55, 1 - (distance - 45) / 900);
      baseDamage *= falloff;
    }
    const appliedDamage = Math.min(target.health, Math.max(1, Math.round(baseDamage)));
    target.health = Math.max(0, target.health - appliedDamage);
    player.score += appliedDamage;
    const killed = target.health <= 0;
    if (killed) {
      target.dead = true;
      target.diedAt = now;
      target.deaths += 1;
      target.score = Math.max(0, target.score - DEATH_SCORE_PENALTY);
      player.kills += 1;
      player.score += 100;
    }
    player.statsLockedUntil = now + 1200;
    target.statsLockedUntil = now + 1200;
    target.updatedAt = now;
    this.persistPlayer(socket, player);
    this.persistPlayer(targetSocket, target);
    this.dirty = true;
    this.broadcast({
      type: 'game-event',
      event: {
        kind, eventId: this.nextEventId(), sourceId: player.id, targetId: target.id,
        source: [player.x, player.y, player.z], weapon, zone, distance,
        damage: appliedDamage, health: target.health, killed,
        attacker: { id: player.id, name: player.name, team: player.team, countryCode: player.countryCode },
        victim: { id: target.id, name: target.name, team: target.team, countryCode: target.countryCode },
        attackerStats: { score: player.score, kills: player.kills },
        targetStats: { score: target.score, deaths: target.deaths },
      },
    });
  }

  join(socket, message) {
    const previous = this.players.get(socket);
    const deviceKey = cleanText(message.deviceKey, 96);
    const activeDeviceSocket = deviceKey ? this.deviceSessions.get(deviceKey) : null;
    if (!deviceKey || (activeDeviceSocket && activeDeviceSocket !== socket && activeDeviceSocket.readyState === WebSocket.OPEN)) {
      this.metrics.rejectedSessions += 1;
      this.send(socket, { type: 'session-rejected', reason: deviceKey ? 'duplicate-device' : 'device-id-required' });
      socket.close(4009, 'duplicate-device');
      return;
    }
    if (previous?.deviceKey && previous.deviceKey !== deviceKey && this.deviceSessions.get(previous.deviceKey) === socket) {
      this.deviceSessions.delete(previous.deviceKey);
    }
    this.deviceSessions.set(deviceKey, socket);
    const player = this.playerForJoin(message);
    if (previous) player.team = previous.team;
    this.players.set(socket, player);
    this.synchronizeWorldClock();
    const attachment = socket.deserializeAttachment?.() || {};
    attachment.player = player;
    socket.serializeAttachment(attachment);
    this.dirty = true;
    const clock = this.worldClockSnapshot();
    this.send(socket, {
      type: 'welcome',
      clientId: player.id,
      team: player.team,
      roomId: ROOM_ID,
      instanceId: this.instanceId,
      ...clock,
      counts: this.teamCounts(),
      teamStats: this.teamStatistics(),
      snapshotHz: 1000 / SNAPSHOT_INTERVAL_MS,
    });
    this.send(socket, {
      type: 'world-state',
      paint: this.paintHistory,
      forts: this.fortOwners,
      eventSequence: this.eventSequence,
      ...clock,
      persisted: true,
      schemaVersion: WORLD_STATE_SCHEMA_VERSION,
    });
  }

  gridKey(x, z) {
    return `${Math.floor(x / INTEREST_CELL_SIZE)}:${Math.floor(z / INTEREST_CELL_SIZE)}`;
  }

  buildInterestGrid(allPlayers) {
    const grid = new Map();
    for (const player of allPlayers) {
      const key = this.gridKey(player.x, player.z);
      const cell = grid.get(key);
      if (cell) cell.push(player);
      else grid.set(key, [player]);
    }
    return grid;
  }

  interestedPlayers(viewer, grid) {
    const centerX = Math.floor(viewer.x / INTEREST_CELL_SIZE);
    const centerZ = Math.floor(viewer.z / INTEREST_CELL_SIZE);
    const cellRadius = Math.ceil(INTEREST_RADIUS / INTEREST_CELL_SIZE);
    const radiusSquared = INTEREST_RADIUS * INTEREST_RADIUS;
    const selected = [];
    for (let z = -cellRadius; z <= cellRadius; z += 1) {
      for (let x = -cellRadius; x <= cellRadius; x += 1) {
        const cell = grid.get(`${centerX + x}:${centerZ + z}`);
        if (!cell) continue;
        for (const candidate of cell) {
          const dx = candidate.x - viewer.x;
          const dz = candidate.z - viewer.z;
          if (dx * dx + dz * dz > radiusSquared) continue;
          selected.push(candidate);
          if (selected.length >= MAX_INTEREST_PLAYERS) return selected;
        }
      }
    }
    return selected;
  }

  broadcastSnapshot() {
    if (!this.dirty) return;
    this.dirty = false;
    const allPlayers = [...this.players.values()];
    const counts = this.teamCounts();
    const grid = this.buildInterestGrid(allPlayers);
    const leaders = this.leaderboard(allPlayers);
    const teamStats = this.teamStatistics(allPlayers);
    const clock = this.worldClockSnapshot();
    for (const socket of this.ctx.getWebSockets()) {
      if (socket.readyState !== WebSocket.OPEN) continue;
      const viewer = this.players.get(socket);
      const visiblePlayers = viewer ? this.interestedPlayers(viewer, grid) : [];
      if (!this.send(socket, {
        type: 'snapshot',
        ...clock,
        counts,
        totalPlayers: allPlayers.length,
        leaders,
        teamStats,
        players: visiblePlayers.map(publicPlayer),
      })) {
        this.metrics.droppedSnapshots += 1;
        continue;
      }
      this.metrics.snapshotDeliveries += 1;
      this.metrics.snapshotPlayerRecords += visiblePlayers.length;
    }
    this.metrics.snapshots += 1;
  }

  removeSocket(socket) {
    const player = this.players.get(socket);
    if (player?.deviceKey && this.deviceSessions.get(player.deviceKey) === socket) {
      this.deviceSessions.delete(player.deviceKey);
    }
    if (this.players.delete(socket)) {
      this.synchronizeWorldClock();
      this.dirty = true;
    }
    if (!this.ctx.getWebSockets().some((candidate) => candidate.readyState === WebSocket.OPEN)) {
      clearInterval(this.snapshotTimer);
      this.snapshotTimer = null;
    }
  }

  webSocketClose(socket) {
    this.removeSocket(socket);
  }

  webSocketError(socket) {
    this.removeSocket(socket);
  }

  getMetrics() {
    const counts = this.teamCounts();
    return {
      connected: this.ctx.getWebSockets().length,
      players: this.players.size,
      activeDevices: this.deviceSessions.size,
      roomId: ROOM_ID,
      instanceId: this.instanceId,
      ...this.worldClockSnapshot(),
      teams: counts,
      uptimeSeconds: Math.round((Date.now() - this.startedAt) / 1000),
      persistedPaintEvents: this.paintHistory.length,
      worldStateSchemaVersion: WORLD_STATE_SCHEMA_VERSION,
      snapshotHz: 1000 / SNAPSHOT_INTERVAL_MS,
      interestRadius: INTEREST_RADIUS,
      maxInterestPlayers: MAX_INTEREST_PLAYERS,
      averagePlayersPerSnapshot: this.metrics.snapshotDeliveries
        ? this.metrics.snapshotPlayerRecords / this.metrics.snapshotDeliveries
        : 0,
      ...this.metrics,
    };
  }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: {
          'access-control-allow-origin': '*',
          'access-control-allow-methods': 'GET, OPTIONS',
          'access-control-allow-headers': 'content-type',
        },
      });
    }
    if (!['/ws', '/health', '/metrics'].includes(url.pathname)) {
      return new Response('Bibish realtime service', { status: 200 });
    }
    const room = env.GAME_ROOM.getByName(ROOM_ID);
    return room.fetch(request);
  },
};
