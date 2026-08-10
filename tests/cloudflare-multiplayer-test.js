import WebSocket from 'ws';

const endpoint = process.env.BIBISH_WS_URL || process.argv[2];
const clientCount = Math.max(2, Number(process.env.CLIENT_COUNT || 6));
const timeoutMs = Math.max(5000, Number(process.env.TEST_TIMEOUT_MS || 30000));
const batchSize = Math.max(1, Number(process.env.BATCH_SIZE || 50));
const rampDelayMs = Math.max(0, Number(process.env.RAMP_DELAY_MS || 120));

if (!endpoint) throw new Error('Set BIBISH_WS_URL or pass the wss:// endpoint as the first argument.');

const wait = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));
const createdClients = [];

function connectClient(index) {
  return new Promise((resolve, reject) => {
    const socket = new WebSocket(endpoint, { handshakeTimeout: timeoutMs, perMessageDeflate: false });
    const client = {
      socket,
      index,
      welcome: null,
      snapshot: null,
      pong: null,
      worldState: null,
      events: [],
      errors: [],
    };
    createdClients.push(client);
    const timer = setTimeout(() => reject(new Error(`Client ${index} timed out`)), timeoutMs);
    socket.once('open', () => {
      socket.send(JSON.stringify({
        type: 'join',
        clientId: `cloud-test-${Date.now()}-${index}`,
        deviceKey: `cloud-device-${Date.now()}-${index}`,
        name: `Cloud-${String(index).padStart(2, '0')}`,
        team: index % 2 === 0 ? 'red' : 'blue',
        countryCode: index % 2 === 0 ? 'TR' : 'US',
      }));
    });
    socket.on('message', (raw) => {
      let message;
      try { message = JSON.parse(String(raw)); } catch { return; }
      if (message.type === 'welcome') {
        client.welcome = message;
        socket.send(JSON.stringify({
          type: 'state',
          x: index * 2,
          y: 4,
          z: index * 2,
          yaw: 0,
          pitch: 0,
          stance: 'stand',
          weapon: 0,
          mode: 0,
          health: 100,
          score: index,
          kills: 0,
          deaths: 0,
          elapsedSeconds: 1,
          phase: 0,
          action: 0,
          dead: false,
        }));
        socket.send(JSON.stringify({ type: 'ping', sentAt: Date.now() }));
      } else if (message.type === 'snapshot') {
        client.snapshot = message;
      } else if (message.type === 'pong') {
        client.pong = message;
      } else if (message.type === 'world-state') {
        client.worldState = message;
      } else if (message.type === 'game-event') {
        client.events.push(message.event);
      }
      if (client.welcome && client.snapshot && client.pong) {
        clearTimeout(timer);
        resolve(client);
      }
    });
    socket.on('error', (error) => {
      client.errors.push(error.message);
      clearTimeout(timer);
      reject(error);
    });
  });
}

const clients = [];
try {
  for (let offset = 0; offset < clientCount; offset += batchSize) {
    const size = Math.min(batchSize, clientCount - offset);
    clients.push(...await Promise.all(Array.from({ length: size }, (_, batchIndex) => connectClient(offset + batchIndex))));
    if (offset + size < clientCount) await wait(rampDelayMs);
  }
  const populationDeadline = Date.now() + timeoutMs;
  while (Date.now() < populationDeadline && !clients.every((client) => client.snapshot?.totalPlayers === clientCount)) await wait(100);
  const attacker = clients[0];
  const victim = clients.find((client) => client.welcome.team !== attacker.welcome.team);
  attacker.socket.send(JSON.stringify({
    type: 'game-event',
    event: { kind: 'paint', x: 0, y: 4, z: 0, radius: 0.5, wasteType: 'pee' },
  }));
  attacker.socket.send(JSON.stringify({
    type: 'game-event',
    event: { kind: 'damage', targetId: victim.welcome.clientId, weapon: 'rifle', zone: 'torso' },
  }));
  const eventDeadline = Date.now() + timeoutMs;
  while (Date.now() < eventDeadline && !clients.every((client) => (
    client.events.some((event) => event.kind === 'paint')
    && client.events.some((event) => event.kind === 'damage' && event.targetId === victim.welcome.clientId)
  ))) await wait(50);
  const roomIds = new Set(clients.map((client) => client.welcome.roomId));
  const instanceIds = new Set(clients.map((client) => client.welcome.instanceId));
  const counts = clients.at(-1).snapshot.counts;
  const result = {
    passed: roomIds.size === 1
      && roomIds.has('global')
      && instanceIds.size === 1
      && clients.every((client) => client.snapshot.totalPlayers === clientCount)
      && Math.abs(counts.red - counts.blue) <= 1
      && clients.every((client) => client.worldState && Array.isArray(client.worldState.paint) && Array.isArray(client.worldState.forts))
      && clients.every((client) => client.events.some((event) => event.kind === 'paint'))
      && clients.every((client) => client.events.some((event) => event.kind === 'damage' && event.health === 62))
      && clients.every((client) => Array.isArray(client.snapshot.leaders) && client.snapshot.leaders.length > 0)
      && clients.every((client) => client.errors.length === 0),
    endpoint,
    clients: clientCount,
    roomIds: [...roomIds],
    instanceIds: [...instanceIds],
    counts,
    visiblePlayers: {
      minimum: Math.min(...clients.map((client) => client.snapshot.players.length)),
      maximum: Math.max(...clients.map((client) => client.snapshot.players.length)),
    },
    sharedEvents: {
      recipients: clients.length,
      paintRecipients: clients.filter((client) => client.events.some((event) => event.kind === 'paint')).length,
      damageRecipients: clients.filter((client) => client.events.some((event) => event.kind === 'damage')).length,
      victimHealth: clients[0].events.find((event) => event.kind === 'damage')?.health ?? null,
    },
  };
  process.stdout.write(`BIBISH_CLOUDFLARE_RESULT ${JSON.stringify(result)}\n`);
  if (!result.passed) process.exitCode = 1;
} finally {
  for (const client of createdClients) client.socket.close(1000, 'test-complete');
}
