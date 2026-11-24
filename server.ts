import crypto from 'crypto';
import express from 'express';
import fs from 'fs/promises';
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
const VALID_MODES = new Set(['1p', '2p', 'online']);
const VALID_PHASES = new Set(['LOBBY', 'CUTSCENE', 'PLAYING', 'STAGE_CLEAR', 'GAME_OVER', 'VICTORY']);
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const MAX_ROOMS = 150;
const ROOM_TTL_MS = 25 * 60 * 1000;

// Persistent Hall of Fame Leaderboard (stored safely inside app data directory)
const DATA_DIR = path.resolve(__dirname, 'data');
const LEADERBOARD_FILE = path.resolve(DATA_DIR, 'leaderboard.json');
const MAX_STORED_SCORES = 100;
const PUBLIC_TOP_LIMIT = 25;
const SUBMIT_WINDOW_MS = 5 * 60 * 1000;
const SUBMIT_MAX_PER_WINDOW = 12;

interface LeaderboardRecord {
  id: string;
  name: string;
  score: number;
  heroes: string[];
  difficulty: 'easy' | 'normal' | 'hard';
  mode: '1p' | '2p' | 'online';
  createdAt: number;
}

let leaderboardCache: LeaderboardRecord[] = [];
let leaderboardWriteChain: Promise<void> = Promise.resolve();
const submitRateMap = new Map<string, number[]>();

function sanitizePlayerName(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  // Strip control characters and angle brackets, normalize spaces
  const cleaned = raw
    .replace(/[\u0000-\u001F\u007F<>]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 18);
  return cleaned.length >= 1 ? cleaned : null;
}

function sortLeaderboard(entries: LeaderboardRecord[]): LeaderboardRecord[] {
  return [...entries].sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return a.createdAt - b.createdAt;
  });
}

async function loadLeaderboardFromDisk(): Promise<void> {
  try {
    await fs.mkdir(DATA_DIR, { recursive: true });
    const raw = await fs.readFile(LEADERBOARD_FILE, 'utf8');
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return;
    const valid: LeaderboardRecord[] = [];
    for (const item of parsed) {
      if (!item || typeof item !== 'object') continue;
      const rec = item as Record<string, unknown>;
      const name = sanitizePlayerName(rec.name);
      const score =
        typeof rec.score === 'number' && Number.isFinite(rec.score)
          ? Math.max(0, Math.min(99_999_999, Math.floor(rec.score)))
          : null;
      if (!name || score === null) continue;
      const heroes = Array.isArray(rec.heroes)
        ? rec.heroes.filter((h): h is string => typeof h === 'string' && VALID_HEROES.has(h)).slice(0, 2)
        : [];
      const difficulty =
        typeof rec.difficulty === 'string' && VALID_DIFFICULTIES.has(rec.difficulty)
          ? (rec.difficulty as 'easy' | 'normal' | 'hard')
          : 'normal';
      const mode =
        typeof rec.mode === 'string' && VALID_MODES.has(rec.mode)
          ? (rec.mode as '1p' | '2p' | 'online')
          : '1p';
      valid.push({
        id: typeof rec.id === 'string' && rec.id.length <= 48 ? rec.id : crypto.randomUUID(),
        name,
        score,
        heroes: heroes.length > 0 ? heroes : ['vadek'],
        difficulty,
        mode,
        createdAt: typeof rec.createdAt === 'number' && Number.isFinite(rec.createdAt) ? rec.createdAt : Date.now(),
      });
    }
    leaderboardCache = sortLeaderboard(valid).slice(0, MAX_STORED_SCORES);
  } catch {
    leaderboardCache = [];
  }
}

function persistLeaderboardToDisk(snapshot: LeaderboardRecord[]): Promise<void> {
  const payload = JSON.stringify(snapshot, null, 2);
  leaderboardWriteChain = leaderboardWriteChain
    .then(async () => {
      await fs.mkdir(DATA_DIR, { recursive: true });
      const tmpPath = `${LEADERBOARD_FILE}.tmp`;
      await fs.writeFile(tmpPath, payload, 'utf8');
      await fs.rename(tmpPath, LEADERBOARD_FILE);
    })
    .catch((err) => {
      console.error('Failed to persist leaderboard:', err);
    });
  return leaderboardWriteChain;
}

function allowScoreSubmit(clientIp: string): boolean {
  const now = Date.now();
  if (submitRateMap.size > 500) {
    for (const [ip, times] of submitRateMap.entries()) {
      const fresh = times.filter((t) => now - t < SUBMIT_WINDOW_MS);
      if (fresh.length === 0) submitRateMap.delete(ip);
      else submitRateMap.set(ip, fresh);
    }
  }
  const prev = (submitRateMap.get(clientIp) ?? []).filter((t) => now - t < SUBMIT_WINDOW_MS);
  if (prev.length >= SUBMIT_MAX_PER_WINDOW) {
    submitRateMap.set(clientIp, prev);
    return false;
  }
  prev.push(now);
  submitRateMap.set(clientIp, prev);
  return true;
}

interface RoomState {
  code: string;
  phase: 'LOBBY' | 'CUTSCENE' | 'PLAYING' | 'STAGE_CLEAR' | 'GAME_OVER' | 'VICTORY';
  levelId: 1 | 2 | 3 | 4 | 5 | 6 | 7;
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

function isValidLevelId(n: unknown): n is 1 | 2 | 3 | 4 | 5 | 6 | 7 {
  return typeof n === 'number' && Number.isInteger(n) && n >= 1 && n <= 7;
}

async function startServer() {
  await loadLeaderboardFromDisk();

  const app = express();
  app.use(express.json({ limit: '32kb' }));
  app.use('/api', (_req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Accept');
    if (_req.method === 'OPTIONS') {
      res.status(204).end();
      return;
    }
    next();
  });

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true, rooms: rooms.size, leaderboardCount: leaderboardCache.length });
  });

  app.get('/api/leaderboard', (_req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    res.json({
      entries: leaderboardCache.slice(0, PUBLIC_TOP_LIMIT),
      total: leaderboardCache.length,
    });
  });

  app.post('/api/leaderboard', async (req, res) => {
    const clientIp = req.ip || req.socket.remoteAddress || 'unknown';
    if (!allowScoreSubmit(clientIp)) {
      res.status(429).json({ error: 'Слишком много отправок. Подождите пару минут.' });
      return;
    }

    const body = req.body as Record<string, unknown> | undefined;
    if (!body || typeof body !== 'object') {
      res.status(400).json({ error: 'Некорректные данные.' });
      return;
    }

    const name = sanitizePlayerName(body.name);
    if (!name) {
      res.status(400).json({ error: 'Введите имя от 1 до 18 символов.' });
      return;
    }

    if (typeof body.score !== 'number' || !Number.isFinite(body.score) || body.score < 0 || body.score > 99_999_999) {
      res.status(400).json({ error: 'Некорректное значение очков.' });
      return;
    }
    const score = Math.floor(body.score);

    const heroes = Array.isArray(body.heroes)
      ? body.heroes.filter((h): h is string => typeof h === 'string' && VALID_HEROES.has(h)).slice(0, 2)
      : [];
    const difficulty =
      typeof body.difficulty === 'string' && VALID_DIFFICULTIES.has(body.difficulty)
        ? (body.difficulty as 'easy' | 'normal' | 'hard')
        : 'normal';
    const mode =
      typeof body.mode === 'string' && VALID_MODES.has(body.mode)
        ? (body.mode as '1p' | '2p' | 'online')
        : '1p';

    const entry: LeaderboardRecord = {
      id: crypto.randomUUID(),
      name,
      score,
      heroes: heroes.length > 0 ? heroes : ['vadek'],
      difficulty,
      mode,
      createdAt: Date.now(),
    };

    const nextList = sortLeaderboard([...leaderboardCache, entry]).slice(0, MAX_STORED_SCORES);
    leaderboardCache = nextList;
    await persistLeaderboardToDisk(leaderboardCache);

    const rankIdx = leaderboardCache.findIndex((item) => item.id === entry.id);
    res.status(201).json({
      entry,
      rank: rankIdx >= 0 ? rankIdx + 1 : null,
      entries: leaderboardCache.slice(0, PUBLIC_TOP_LIMIT),
      total: leaderboardCache.length,
    });
  });

  const httpServer = http.createServer(app);
  const wss = new WebSocketServer({
    server: httpServer,
    path: '/ws',
    maxPayload: 64 * 1024,
    perMessageDeflate: false,
  });

  wss.on('connection', (ws, req) => {
    try {
      req.socket.setNoDelay(true);
    } catch {
      // Ignore if socket does not expose setNoDelay
    }
    clients.set(ws, { roomCode: null, slot: null, alive: true });
    safeSend(ws, { type: 'room:list', rooms: getOpenRoomsList() });

    ws.on('pong', () => {
      const m = clients.get(ws);
      if (m) m.alive = true;
    });

    ws.on('message', (raw) => {
      const meta = clients.get(ws);
      if (!meta) return;

      const rawText = raw.toString('utf8');

      // Fast-path zero-copy relay for high-frequency host game:frame packets!
      // Avoids server-side JSON.parse + JSON.stringify overhead AND drops stale frames if guest socket backs up.
      if (rawText.startsWith('{"type":"game:frame"')) {
        if (!meta.roomCode || meta.slot !== 1) return;
        const room = rooms.get(meta.roomCode);
        if (!room || !room.guestWs || room.guestWs.readyState !== WebSocket.OPEN) return;
        room.lastActivity = Date.now();
        // Backpressure protection: if guest outbound buffer already holds > 16 KB, drop intermediate visual frame
        // so the guest never builds up a multi-second lag queue!
        if (room.guestWs.bufferedAmount > 16384) return;
        try {
          room.guestWs.send(rawText);
        } catch {
          // Ignore transient send errors
        }
        return;
      }

      let msg: Record<string, unknown>;
      try {
        const parsed = JSON.parse(rawText);
        if (!parsed || typeof parsed !== 'object' || typeof parsed.type !== 'string') return;
        msg = parsed as Record<string, unknown>;
      } catch {
        return;
      }

      switch (msg.type) {
        case 'ping': {
          meta.alive = true;
          safeSend(ws, { type: 'pong' });
          break;
        }

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
          if (!/^[A-Z0-9]{4}$/.test(rawCode)) {
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
          if (!room || !room.hostWs || room.hostWs.readyState !== WebSocket.OPEN) return;
          const inp = msg.input as Record<string, unknown> | undefined;
          if (!inp || typeof inp !== 'object') return;
          room.lastActivity = Date.now();
          const hasAction = Boolean(inp.melee) || Boolean(inp.jump) || Boolean(inp.swap);
          if (!hasAction && room.hostWs.bufferedAmount > 12288) return;
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
          // Fallback relay when frame key ordering differs from fast-path prefix
          if (!meta.roomCode || meta.slot !== 1) return;
          const room = rooms.get(meta.roomCode);
          if (!room || !room.guestWs || room.guestWs.readyState !== WebSocket.OPEN) return;
          room.lastActivity = Date.now();
          if (room.guestWs.bufferedAmount > 16384) return;
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
      server: { middlewareMode: true, hmr: false, ws: false },
      appType: 'spa',
    });

    // Vite 8 injects /@vite/client even when hmr/ws are false, causing a failing
    // wss://<host>:24678 connection in proxied middleware mode. Serve a spec-compatible
    // no-WebSocket shim that preserves CSS injection (updateStyle/removeStyle) & HMR API.
    const NO_WS_VITE_CLIENT = `
const sheetsMap = new Map();
const linkSheetsMap = new Map();
if ("document" in globalThis) {
  document.querySelectorAll("style[data-vite-dev-id]").forEach((el) => {
    sheetsMap.set(el.getAttribute("data-vite-dev-id"), el);
  });
  document.querySelectorAll('link[rel="stylesheet"][data-vite-dev-id]').forEach((el) => {
    linkSheetsMap.set(el.getAttribute("data-vite-dev-id"), el);
  });
}
let lastInsertedStyle;
export function updateStyle(id, content) {
  if (linkSheetsMap.has(id)) return;
  let style = sheetsMap.get(id);
  if (!style) {
    style = document.createElement("style");
    style.setAttribute("type", "text/css");
    style.setAttribute("data-vite-dev-id", id);
    style.textContent = content;
    if (!lastInsertedStyle) {
      document.head.appendChild(style);
      setTimeout(() => { lastInsertedStyle = undefined; }, 0);
    } else {
      lastInsertedStyle.insertAdjacentElement("afterend", style);
    }
    lastInsertedStyle = style;
  } else if (style.textContent !== content) {
    style.textContent = content;
  }
  sheetsMap.set(id, style);
}
export function removeStyle(id) {
  if (linkSheetsMap.has(id)) {
    document.querySelectorAll('link[rel="stylesheet"][data-vite-dev-id="' + CSS.escape(id) + '"]').forEach((el) => el.remove());
    linkSheetsMap.delete(id);
  }
  const style = sheetsMap.get(id);
  if (style) {
    document.head.removeChild(style);
    sheetsMap.delete(id);
  }
}
export function createHotContext() {
  return {
    data: {},
    accept() {},
    acceptExports() {},
    dispose() {},
    prune() {},
    decline() {},
    invalidate() {},
    on() {},
    off() {},
    send() {},
  };
}
export function injectQuery(url, queryToInject) {
  if (url[0] !== "." && url[0] !== "/") return url;
  const pathname = url.replace(/[?#].*$/, "");
  const { search, hash } = new URL(url, "http://vite.dev");
  return pathname + "?" + queryToInject + (search ? "&" + search.slice(1) : "") + (hash || "");
}
export class ErrorOverlay {}
`;
    app.get('/@vite/client', (_req, res) => {
      res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
      res.setHeader('Cache-Control', 'no-cache');
      res.send(NO_WS_VITE_CLIENT);
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
