import express from 'express';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import { WebSocket, WebSocketServer } from 'ws';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT) || 3000;
const IS_PROD = process.env.NODE_ENV === 'production';

const VALID_HEROES = new Set([
  'vadek',
  'vano',
  'koren',
  'hooper',
  'sandro',
  'zavod_killer',
  'bo',
  'ded',
]);
const VALID_DIFFICULTIES = new Set(['easy', 'normal', 'hard']);
const VALID_PHASES = new Set(['LOBBY', 'CUTSCENE', 'PLAYING', 'STAGE_CLEAR', 'GAME_OVER', 'VICTORY']);
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const MAX_ROOMS = 150;
const ROOM_TTL_MS = 25 * 60 * 1000;

interface RoomState {
  code: string;
  phase: 'LOBBY' | 'CUTSCENE' | 'PLAYING' | 'STAGE_CLEAR' | 'GAME_OVER' | 'VICTORY';
  levelId: 1 | 2 | 3 | 4 | 5 | 6;
  difficulty: 'easy' | 'normal' | 'hard';
  friendlyFire: boolean;
  hostHero: string;
  guestHero: string;
  hostReady: boolean;
  guestReady: boolean;
  isVictoryCutscene: boolean;
  hostWs: WebSocket | null;
  guestWs: WebSocket | null;
  lastActivity: number;
}

interface ClientMeta {
  roomCode: string | null;
  slot: 1 | 2 | null;
  alive: boolean;
}

const rooms = new Map<string, RoomState>();
const clients = new Map<WebSocket, ClientMeta>();

function generateRoomCode(): string {
  for (let attempt = 0; attempt < 40; attempt++) {
    let code = '';
    for (let i = 0; i < 4; i++) {
      code += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
    }
    if (!rooms.has(code)) return code;
  }
  return `P${Math.floor(100 + Math.random() * 899)}`;
}

function safeSend(ws: WebSocket | null, payload: unknown): void {
  if (!ws || ws.readyState !== WebSocket.OPEN) return;
  try {
    ws.send(JSON.stringify(payload));
  } catch {
    // Ignore transient closed-socket send errors
  }
}

function serializeRoom(room: RoomState) {
  return {
    code: room.code,
    phase: room.phase,
    levelId: room.levelId,
    difficulty: room.difficulty,
    friendlyFire: room.friendlyFire,
    hostHero: room.hostHero,
    guestHero: room.guestHero,
    hostReady: room.hostReady,
    guestReady: room.guestReady,
    guestConnected: Boolean(room.guestWs && room.guestWs.readyState === WebSocket.OPEN),
    isVictoryCutscene: room.isVictoryCutscene,
  };
}

function getOpenRoomsList() {
  const list: Array<{
    code: string;
    hostHero: string;
    difficulty: string;
    levelId: number;
    players: number;
  }> = [];
  for (const r of rooms.values()) {
    const hasHost = Boolean(r.hostWs && r.hostWs.readyState === WebSocket.OPEN);
    const hasGuest = Boolean(r.guestWs && r.guestWs.readyState === WebSocket.OPEN);
    if (hasHost && !hasGuest && r.phase === 'LOBBY') {
      list.push({
        code: r.code,
        hostHero: r.hostHero,
        difficulty: r.difficulty,
        levelId: r.levelId,
        players: 1,
      });
    }
  }
  return list.slice(0, 12);
}

function broadcastRoomState(room: RoomState): void {
  const snapshot = serializeRoom(room);
  safeSend(room.hostWs, { type: 'room:state', room: snapshot, role: 'host' });
  safeSend(room.guestWs, { type: 'room:state', room: snapshot, role: 'guest' });
}

function broadcastLobbyDirectory(): void {
  const list = getOpenRoomsList();
  for (const [ws, meta] of clients.entries()) {
    if (!meta.roomCode) {
      safeSend(ws, { type: 'room:list', rooms: list });
    }
  }
}

function pickAlternateHero(takenHero: string): string {
  for (const hero of VALID_HEROES) {
    if (hero !== takenHero) return hero;
  }
  return 'vano';
}

function leaveCurrentRoom(ws: WebSocket): void {
  const meta = clients.get(ws);
  if (!meta || !meta.roomCode) return;
  const room = rooms.get(meta.roomCode);
  const prevSlot = meta.slot;
  meta.roomCode = null;
  meta.slot = null;

  if (!room) return;

  if (prevSlot === 1 && room.hostWs === ws) {
    room.hostWs = null;
    if (room.guestWs && room.guestWs.readyState === WebSocket.OPEN) {
      safeSend(room.guestWs, {
        type: 'peer:left',
        reason: 'Хост закрыл комнату. Возвращаемся в лобби.',
        hostLeft: true,
      });
      const guestMeta = clients.get(room.guestWs);
      if (guestMeta) {
        guestMeta.roomCode = null;
        guestMeta.slot = null;
      }
    }
    rooms.delete(room.code);
  } else if (prevSlot === 2 && room.guestWs === ws) {
    room.guestWs = null;
    room.guestReady = false;
    room.lastActivity = Date.now();
    safeSend(room.hostWs, {
      type: 'peer:left',
      reason: 'Игрок 2 отключился.',
      hostLeft: false,
    });
    broadcastRoomState(room);
  }
  broadcastLobbyDirectory();
}

function isValidLevelId(n: unknown): n is 1 | 2 | 3 | 4 | 5 | 6 {
  return typeof n === 'number' && Number.isInteger(n) && n >= 1 && n <= 6;
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '32kb' }));

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true, rooms: rooms.size });
  });

  const httpServer = http.createServer(app);
  const wss = new WebSocketServer({
    server: httpServer,
    path: '/ws',
    maxPayload: 64 * 1024,
  });

  wss.on('connection', (ws) => {
    clients.set(ws, { roomCode: null, slot: null, alive: true });
    safeSend(ws, { type: 'room:list', rooms: getOpenRoomsList() });

    ws.on('pong', () => {
      const m = clients.get(ws);
      if (m) m.alive = true;
    });

    ws.on('message', (raw) => {
      let msg: Record<string, unknown>;
      try {
        const parsed = JSON.parse(raw.toString('utf8'));
        if (!parsed || typeof parsed !== 'object' || typeof parsed.type !== 'string') return;
        msg = parsed as Record<string, unknown>;
      } catch {
        return;
      }

      const meta = clients.get(ws);
      if (!meta) return;

      switch (msg.type) {
        case 'room:list': {
          safeSend(ws, { type: 'room:list', rooms: getOpenRoomsList() });
          break;
        }

        case 'room:create': {
          leaveCurrentRoom(ws);
          if (rooms.size >= MAX_ROOMS) {
            safeSend(ws, { type: 'room:error', message: 'Сервер переполнен. Попробуйте чуть позже.' });
            return;
          }
          const code = generateRoomCode();
          const hostHero = typeof msg.heroId === 'string' && VALID_HEROES.has(msg.heroId) ? msg.heroId : 'vadek';
          const difficulty =
            typeof msg.difficulty === 'string' && VALID_DIFFICULTIES.has(msg.difficulty)
              ? (msg.difficulty as 'easy' | 'normal' | 'hard')
              : 'normal';
          const levelId = isValidLevelId(msg.levelId) ? msg.levelId : 1;
          const friendlyFire = Boolean(msg.friendlyFire);

          const room: RoomState = {
            code,
            phase: 'LOBBY',
            levelId,
            difficulty,
            friendlyFire,
            hostHero,
            guestHero: pickAlternateHero(hostHero),
            hostReady: true,
            guestReady: false,
            isVictoryCutscene: false,
            hostWs: ws,
            guestWs: null,
            lastActivity: Date.now(),
          };
          rooms.set(code, room);
          meta.roomCode = code;
          meta.slot = 1;
          broadcastRoomState(room);
          broadcastLobbyDirectory();
          break;
        }

        case 'room:join': {
          const rawCode = typeof msg.code === 'string' ? msg.code.trim().toUpperCase() : '';
          if (!/^[A-Z2-9]{4}$/.test(rawCode)) {
            safeSend(ws, { type: 'room:error', message: 'Неверный формат кода (нужно 4 символа).' });
            return;
          }
          const room = rooms.get(rawCode);
          if (!room || !room.hostWs || room.hostWs.readyState !== WebSocket.OPEN) {
            safeSend(ws, { type: 'room:error', message: `Комната ${rawCode} не найдена.` });
            return;
          }
          if (room.guestWs && room.guestWs.readyState === WebSocket.OPEN && room.guestWs !== ws) {
            safeSend(ws, { type: 'room:error', message: `Комната ${rawCode} уже заполнена (2/2).` });
            return;
          }
          if (room.phase !== 'LOBBY') {
            safeSend(ws, { type: 'room:error', message: `В комнате ${rawCode} игра уже идёт.` });
            return;
          }

          leaveCurrentRoom(ws);
          room.guestWs = ws;
          room.guestReady = false;
          if (room.guestHero === room.hostHero) {
            room.guestHero = pickAlternateHero(room.hostHero);
          }
          room.lastActivity = Date.now();
          meta.roomCode = room.code;
          meta.slot = 2;
          broadcastRoomState(room);
          broadcastLobbyDirectory();
          break;
        }

        case 'room:leave': {
          leaveCurrentRoom(ws);
          break;
        }

        case 'lobby:hero': {
          if (!meta.roomCode || !meta.slot) return;
          const room = rooms.get(meta.roomCode);
          if (!room || room.phase !== 'LOBBY') return;
          const heroId = typeof msg.heroId === 'string' && VALID_HEROES.has(msg.heroId) ? msg.heroId : null;
          if (!heroId) return;

          if (meta.slot === 1) {
            if (room.guestWs && heroId === room.guestHero) return;
            room.hostHero = heroId;
            if (!room.guestWs && room.guestHero === heroId) {
              room.guestHero = pickAlternateHero(heroId);
            }
          } else {
            if (heroId === room.hostHero) return;
            room.guestHero = heroId;
          }
          room.lastActivity = Date.now();
          broadcastRoomState(room);
          broadcastLobbyDirectory();
          break;
        }

        case 'lobby:ready': {
          if (!meta.roomCode || !meta.slot) return;
          const room = rooms.get(meta.roomCode);
          if (!room || room.phase !== 'LOBBY') return;
          if (meta.slot === 1) room.hostReady = Boolean(msg.ready);
          else room.guestReady = Boolean(msg.ready);
          room.lastActivity = Date.now();
          broadcastRoomState(room);
          break;
        }

        case 'lobby:settings': {
          if (!meta.roomCode || meta.slot !== 1) return;
          const room = rooms.get(meta.roomCode);
          if (!room) return;
          if (typeof msg.difficulty === 'string' && VALID_DIFFICULTIES.has(msg.difficulty)) {
            room.difficulty = msg.difficulty as 'easy' | 'normal' | 'hard';
          }
          if (isValidLevelId(msg.levelId)) {
            room.levelId = msg.levelId;
          }
          if (typeof msg.friendlyFire === 'boolean') {
            room.friendlyFire = msg.friendlyFire;
          }
          room.lastActivity = Date.now();
          broadcastRoomState(room);
          broadcastLobbyDirectory();
          break;
        }

        case 'game:phase': {
          // Only Host can drive phase transitions (LOBBY -> CUTSCENE -> PLAYING -> STAGE_CLEAR -> VICTORY)
          if (!meta.roomCode || meta.slot !== 1) return;
          const room = rooms.get(meta.roomCode);
          if (!room) return;
          if (typeof msg.phase === 'string' && VALID_PHASES.has(msg.phase)) {
            room.phase = msg.phase as RoomState['phase'];
          }
          if (isValidLevelId(msg.levelId)) {
            room.levelId = msg.levelId;
          }
          if (typeof msg.isVictoryCutscene === 'boolean') {
            room.isVictoryCutscene = msg.isVictoryCutscene;
          }
          room.lastActivity = Date.now();
          broadcastRoomState(room);
          if (msg.summary !== undefined || msg.score !== undefined || msg.continuesLeft !== undefined) {
            safeSend(room.guestWs, {
              type: 'game:meta',
              phase: room.phase,
              levelId: room.levelId,
              isVictoryCutscene: room.isVictoryCutscene,
              summary: msg.summary ?? null,
              score: typeof msg.score === 'number' ? msg.score : 0,
              continuesLeft: typeof msg.continuesLeft === 'number' ? msg.continuesLeft : 3,
            });
          }
          broadcastLobbyDirectory();
          break;
        }

        case 'game:input': {
          // Guest sends validated P2 input -> server stamps slot: 2 and relays to Host
          if (!meta.roomCode || meta.slot !== 2) return;
          const room = rooms.get(meta.roomCode);
          if (!room || !room.hostWs) return;
          const inp = msg.input as Record<string, unknown> | undefined;
          if (!inp || typeof inp !== 'object') return;
          room.lastActivity = Date.now();
          safeSend(room.hostWs, {
            type: 'game:input',
            slot: 2,
            input: {
              up: Boolean(inp.up),
              down: Boolean(inp.down),
              left: Boolean(inp.left),
              right: Boolean(inp.right),
              analogX: typeof inp.analogX === 'number' ? Math.max(-1, Math.min(1, inp.analogX)) : 0,
              analogY: typeof inp.analogY === 'number' ? Math.max(-1, Math.min(1, inp.analogY)) : 0,
              melee: Boolean(inp.melee),
              jump: Boolean(inp.jump),
              shoot: Boolean(inp.shoot),
              swap: Boolean(inp.swap),
            },
          });
          break;
        }

        case 'game:frame': {
          // Host sends authoritative visual frame snapshot -> server relays to Guest
          if (!meta.roomCode || meta.slot !== 1) return;
          const room = rooms.get(meta.roomCode);
          if (!room || !room.guestWs) return;
          room.lastActivity = Date.now();
          safeSend(room.guestWs, {
            type: 'game:frame',
            frame: msg.frame,
          });
          break;
        }

        case 'game:cutscene_sync': {
          // Host syncs cutscene line index / skip to Guest so both read dialogues together
          if (!meta.roomCode || meta.slot !== 1) return;
          const room = rooms.get(meta.roomCode);
          if (!room || !room.guestWs) return;
          safeSend(room.guestWs, {
            type: 'game:cutscene_sync',
            lineIndex: typeof msg.lineIndex === 'number' ? msg.lineIndex : 0,
          });
          break;
        }
      }
    });

    ws.on('close', () => {
      leaveCurrentRoom(ws);
      clients.delete(ws);
    });

    ws.on('error', () => {
      leaveCurrentRoom(ws);
      clients.delete(ws);
    });
  });

  // Periodic heartbeat & stale room cleanup
  setInterval(() => {
    const now = Date.now();
    for (const [ws, meta] of clients.entries()) {
      if (!meta.alive) {
        leaveCurrentRoom(ws);
        ws.terminate();
        clients.delete(ws);
        continue;
      }
      meta.alive = false;
      try {
        ws.ping();
      } catch {
        // Ignore
      }
    }
    for (const [code, room] of rooms.entries()) {
      const hostOpen = room.hostWs && room.hostWs.readyState === WebSocket.OPEN;
      if (!hostOpen || now - room.lastActivity > ROOM_TTL_MS) {
        rooms.delete(code);
      }
    }
  }, 30000);

  if (!IS_PROD) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true, hmr: false },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(__dirname, 'dist');
    app.use(express.static(distDir, { maxAge: '7d' }));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`GREEN BEER PIZEDES server running on http://0.0.0.0:${PORT} (WS at /ws)`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
