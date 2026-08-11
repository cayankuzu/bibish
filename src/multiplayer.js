const SEND_INTERVAL = 1 / 15;
const PING_INTERVAL = 2;
const RECONNECT_MAX_MS = 15000;
const PUBLIC_MULTIPLAYER_URL = 'wss://bibish-realtime.bibish.workers.dev/ws';

function websocketUrl() {
  const queryUrl = new URLSearchParams(window.location.search).get('ws');
  if (queryUrl) return queryUrl;
  if (globalThis.__BIBISH_WS_URL__) return globalThis.__BIBISH_WS_URL__;
  if (import.meta.env.VITE_MULTIPLAYER_URL) return import.meta.env.VITE_MULTIPLAYER_URL;
  if (['localhost', '127.0.0.1'].includes(window.location.hostname)) {
    return `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}/ws`;
  }
  return PUBLIC_MULTIPLAYER_URL;
}

function createClientId() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return `bibish-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

function stableHash(value) {
  let first = 0x811c9dc5;
  let second = 0x9e3779b9;
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    first = Math.imul(first ^ code, 0x01000193) >>> 0;
    second = Math.imul(second ^ code, 0x85ebca6b) >>> 0;
  }
  return `${first.toString(36)}${second.toString(36)}`;
}

function createDeviceKey() {
  let graphics = 'webgl-unavailable';
  try {
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('webgl2') || canvas.getContext('webgl');
    const debugInfo = context?.getExtension('WEBGL_debug_renderer_info');
    graphics = debugInfo
      ? `${context.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL)}|${context.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL)}`
      : `${context?.getParameter(context.VENDOR) || ''}|${context?.getParameter(context.RENDERER) || ''}`;
  } catch {}
  const signature = [
    navigator.platform || '', navigator.hardwareConcurrency || 0, navigator.deviceMemory || 0,
    screen.width, screen.height, screen.colorDepth, navigator.maxTouchPoints || 0,
    Intl.DateTimeFormat().resolvedOptions().timeZone || '', graphics,
  ].join('|');
  return `device-v1-${stableHash(signature)}`;
}

function allowLocalDuplicateClients() {
  if (!['localhost', '127.0.0.1'].includes(window.location.hostname)) return false;
  const query = new URLSearchParams(window.location.search);
  return query.has('localLobbyTest') || query.has('loadtest') || query.has('stressFullRoster');
}

export class MultiplayerClient {
  constructor({ onSnapshot, onWelcome, onStatus, onRejected, onEvent, onWorldState } = {}) {
    this.onSnapshot = onSnapshot;
    this.onWelcome = onWelcome;
    this.onStatus = onStatus;
    this.onRejected = onRejected;
    this.onEvent = onEvent;
    this.onWorldState = onWorldState;
    this.clientId = createClientId();
    this.deviceKey = createDeviceKey();
    this.allowDuplicateDevice = allowLocalDuplicateClients();
    this.socket = null;
    this.profile = null;
    this.sendAccumulator = 0;
    this.pingAccumulator = 0;
    this.reconnectDelay = 650;
    this.reconnectTimer = 0;
    this.closedByClient = false;
    this.connected = false;
    this.joined = false;
    this.latencyMs = null;
    this.snapshotCount = 0;
    this.sentStateCount = 0;
    this.lastSnapshotAt = 0;
    this.serverPlayerCount = 0;
    this.serverTeamCounts = { red: 0, blue: 0 };
    this.serverTeamStats = null;
    this.serverLeaderboard = [];
    this.roomId = null;
    this.serverInstanceId = null;
    this.worldStartedAt = null;
    this.worldActiveElapsedMs = 0;
    this.worldClockRunning = false;
  }

  connect(profile) {
    this.profile = { ...profile };
    this.closedByClient = false;
    if (this.socket?.readyState === WebSocket.OPEN) {
      this.sendJoin();
      return;
    }
    if (this.socket?.readyState === WebSocket.CONNECTING) return;
    this.disconnect(false);
    this.open();
  }

  observe() {
    this.profile = null;
    this.joined = false;
    this.closedByClient = false;
    if (this.socket?.readyState === WebSocket.OPEN) {
      this.send({ type: 'observe' });
      return;
    }
    if (this.socket?.readyState === WebSocket.CONNECTING) return;
    this.disconnect(false);
    this.open();
  }

  sendJoin() {
    if (!this.profile) return false;
    return this.send({
      type: 'join',
      clientId: this.clientId,
      deviceKey: this.deviceKey,
      allowDuplicateDevice: this.allowDuplicateDevice,
      ...this.profile,
    });
  }

  open() {
    if (this.closedByClient) return;
    this.onStatus?.('connecting');
    const socket = new WebSocket(websocketUrl());
    this.socket = socket;
    socket.addEventListener('open', () => {
      if (socket !== this.socket) return;
      this.connected = true;
      this.reconnectDelay = 650;
      this.onStatus?.('online');
      if (this.profile) this.sendJoin();
      else this.send({ type: 'observe' });
    });
    socket.addEventListener('message', (event) => {
      if (socket !== this.socket) return;
      let message;
      try { message = JSON.parse(event.data); } catch { return; }
      if (message.type === 'session-rejected') {
        this.closedByClient = true;
        this.connected = false;
        this.onStatus?.('duplicate');
        this.onRejected?.(message.reason || 'duplicate-device');
        socket.close(4009, 'duplicate-device');
      } else if (message.type === 'welcome') {
        this.joined = true;
        this.clientId = message.clientId || this.clientId;
        this.roomId = message.roomId || null;
        this.serverInstanceId = message.instanceId || null;
        this.worldStartedAt = Number(message.worldStartedAt) || this.worldStartedAt;
        if (message.worldActiveElapsedMs != null) {
          this.worldActiveElapsedMs = Math.max(0, Number(message.worldActiveElapsedMs) || 0);
          this.worldClockRunning = Boolean(message.worldClockRunning);
        }
        this.serverTeamCounts = message.counts || this.serverTeamCounts;
        this.serverTeamStats = message.teamStats || this.serverTeamStats;
        this.serverPlayerCount = Math.max(0,
          (Number(this.serverTeamCounts.red) || 0) + (Number(this.serverTeamCounts.blue) || 0));
        this.onWelcome?.(message);
      } else if (message.type === 'snapshot' && Array.isArray(message.players)) {
        this.snapshotCount += 1;
        this.lastSnapshotAt = performance.now();
        this.serverPlayerCount = Number(message.totalPlayers) || message.players.length;
        this.serverTeamCounts = message.counts || this.serverTeamCounts;
        this.serverTeamStats = message.teamStats || this.serverTeamStats;
        this.serverLeaderboard = Array.isArray(message.leaders) ? message.leaders : this.serverLeaderboard;
        this.worldStartedAt = Number(message.worldStartedAt) || this.worldStartedAt;
        if (message.worldActiveElapsedMs != null) {
          this.worldActiveElapsedMs = Math.max(0, Number(message.worldActiveElapsedMs) || 0);
          this.worldClockRunning = Boolean(message.worldClockRunning);
        }
        this.onSnapshot?.(message.players, message);
      } else if (message.type === 'game-event' && message.event) {
        this.onEvent?.(message.event, message);
      } else if (message.type === 'world-state') {
        this.worldStartedAt = Number(message.worldStartedAt) || this.worldStartedAt;
        if (message.worldActiveElapsedMs != null) {
          this.worldActiveElapsedMs = Math.max(0, Number(message.worldActiveElapsedMs) || 0);
          this.worldClockRunning = Boolean(message.worldClockRunning);
        }
        this.onWorldState?.(message);
      } else if (message.type === 'pong') {
        this.latencyMs = Math.max(0, performance.now() - Number(message.sentAt || performance.now()));
      }
    });
    socket.addEventListener('close', () => {
      if (socket !== this.socket) return;
      this.connected = false;
      this.joined = false;
      this.socket = null;
      this.onStatus?.('offline');
      if (this.closedByClient) return;
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = setTimeout(() => this.open(), this.reconnectDelay);
      this.reconnectDelay = Math.min(RECONNECT_MAX_MS, Math.round(this.reconnectDelay * 1.7));
    });
    socket.addEventListener('error', () => {
      if (socket === this.socket) this.onStatus?.('error');
    });
  }

  send(message) {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) return false;
    this.socket.send(JSON.stringify(message));
    return true;
  }

  sendEvent(event) {
    if (!event || typeof event !== 'object') return false;
    return this.send({ type: 'game-event', event });
  }

  update(delta, player) {
    if (!this.connected || !player) return;
    this.sendAccumulator += delta;
    this.pingAccumulator += delta;
    if (this.sendAccumulator >= SEND_INTERVAL) {
      this.sendAccumulator %= SEND_INTERVAL;
      if (this.send({ type: 'state', ...player })) this.sentStateCount += 1;
    }
    if (this.pingAccumulator >= PING_INTERVAL) {
      this.pingAccumulator %= PING_INTERVAL;
      this.send({ type: 'ping', sentAt: performance.now() });
    }
  }

  disconnect(permanent = true) {
    this.closedByClient = permanent;
    clearTimeout(this.reconnectTimer);
    this.reconnectTimer = 0;
    if (this.socket) {
      const socket = this.socket;
      this.socket = null;
      socket.close(1000, 'client-left');
    }
    this.connected = false;
    this.joined = false;
    this.onStatus?.('offline');
  }

  getMetrics() {
    return {
      connected: this.connected,
      joined: this.joined,
      clientId: this.clientId,
      latencyMs: this.latencyMs == null ? null : Math.round(this.latencyMs),
      snapshots: this.snapshotCount,
      sentStates: this.sentStateCount,
      serverPlayerCount: this.serverPlayerCount,
      serverTeamCounts: { ...this.serverTeamCounts },
      serverTeamStats: this.serverTeamStats,
      roomId: this.roomId,
      serverInstanceId: this.serverInstanceId,
      worldStartedAt: this.worldStartedAt,
      worldActiveElapsedMs: this.worldActiveElapsedMs,
      worldClockRunning: this.worldClockRunning,
      deviceKey: this.deviceKey,
      lastSnapshotAgeMs: this.lastSnapshotAt ? Math.round(performance.now() - this.lastSnapshotAt) : null,
      url: websocketUrl(),
    };
  }
}
