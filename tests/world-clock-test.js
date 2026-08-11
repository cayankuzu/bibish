import { EventEmitter } from 'node:events';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createGameRoom } from '../server/game-room.js';
import { loadPersistentLocalWorldClock } from '../server/local-world-clock.js';

class TestSocket extends EventEmitter {
  constructor() {
    super();
    this.readyState = 1;
    this.bufferedAmount = 0;
    this.messages = [];
  }

  send(payload) {
    this.messages.push(JSON.parse(payload));
  }

  ping() {}

  close() {
    if (this.readyState !== 1) return;
    this.readyState = 3;
    this.emit('close');
  }
}

let timestamp = 1_800_000_000_000;
const saved = [];
const room = createGameRoom({
  now: () => timestamp,
  worldActiveElapsedMs: 12_000,
  persistWorldClock: (clock) => saved.push({ ...clock }),
});

function metrics() {
  return room.getMetrics();
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

try {
  const observer = new TestSocket();
  room.attach(observer);
  observer.emit('message', JSON.stringify({ type: 'observe' }));
  timestamp += 5000;
  assert(metrics().worldClockRunning === false, 'An observer must not start the game clock.');
  assert(metrics().worldActiveElapsedMs === 12_000, 'The empty-room clock must stay frozen.');

  const firstPlayer = new TestSocket();
  room.attach(firstPlayer);
  firstPlayer.emit('message', JSON.stringify({
    type: 'join', clientId: 'player-one', deviceKey: 'device-one', name: 'One', team: 'red', countryCode: 'TR',
  }));
  timestamp += 2400;
  assert(metrics().worldClockRunning === true, 'The first player must start the game clock.');
  assert(metrics().worldActiveElapsedMs === 14_400, 'The active clock did not advance with a player online.');

  // Rejoining/team-screen changes on the same live connection must not reset the epoch.
  firstPlayer.emit('message', JSON.stringify({
    type: 'join', clientId: 'player-one', deviceKey: 'device-one', name: 'One', team: 'blue', countryCode: 'TR',
  }));
  timestamp += 600;
  assert(metrics().worldActiveElapsedMs === 15_000, 'Rejoining reset or paused the active clock.');

  firstPlayer.close();
  const pausedAt = metrics().worldActiveElapsedMs;
  timestamp += 7000;
  assert(metrics().players === 0, 'The last player did not leave the room.');
  assert(metrics().worldClockRunning === false, 'The empty room did not pause the clock.');
  assert(metrics().worldActiveElapsedMs === pausedAt, 'The clock advanced while the room was empty.');

  const refreshedPlayer = new TestSocket();
  room.attach(refreshedPlayer);
  refreshedPlayer.emit('message', JSON.stringify({
    type: 'join', clientId: 'player-one', deviceKey: 'device-one', name: 'One', team: 'red', countryCode: 'TR',
  }));
  timestamp += 1100;
  assert(metrics().worldActiveElapsedMs === pausedAt + 1100, 'A refreshed/reconnected player did not resume the same clock.');
  assert(saved.length >= 3, 'Clock transitions were not persisted.');
  assert(saved.every((entry) => Number.isFinite(entry.activeElapsedMs)), 'Persisted clock payload is invalid.');

  console.log('BIBISH_WORLD_CLOCK_RESULT', JSON.stringify({
    passed: true,
    initialMs: 12_000,
    pausedAt,
    resumedAt: metrics().worldActiveElapsedMs,
    persistenceWrites: saved.length,
  }));
  refreshedPlayer.close();
  observer.close();
} finally {
  room.close();
}

const persistenceRoot = mkdtempSync(join(tmpdir(), 'bibish-world-clock-'));
try {
  const firstClock = loadPersistentLocalWorldClock(persistenceRoot);
  firstClock.persist({ activeElapsedMs: 5000 });
  firstClock.persist({ activeElapsedMs: 1200 });
  const restoredClock = loadPersistentLocalWorldClock(persistenceRoot);
  assert(restoredClock.activeElapsedMs === 5000, 'A stale persistence write reduced/reset the clock.');
  console.log('BIBISH_LOCAL_CLOCK_PERSISTENCE_RESULT', JSON.stringify({ passed: true, restoredMs: restoredClock.activeElapsedMs }));
} finally {
  rmSync(persistenceRoot, { recursive: true, force: true });
}
