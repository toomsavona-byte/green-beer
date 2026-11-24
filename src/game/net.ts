import {
  DifficultyId,
  HeroId,
  LevelId,
  OnlineRole,
  OnlineRoomSnapshot,
  PublicRoomInfo,
  RemoteInputState,
  StageClearSummary,
} from './types';

export interface NetFramePayload {
  seq?: number;
  levelId: LevelId;
  camX: number;
  simTime: number;
  elevatorFloor: number;
  shakeIntensity: number;
  shakeTime: number;
  players: Array<{
    slot: 1 | 2;
    heroId: HeroId;
    x: number;
    y: number;
    z: number;
    vz: number;
    facing: 1 | -1;
    aimX: number;
    aimY: number;
    animTime: number;
    moving: boolean;
    meleeTimer: number;
    shootTimer: number;
    hurtTimer: number;
    invulnTimer: number;
    weaponId: string;
    alive: boolean;
  }>;
  enemies: Array<{
    id: number;
    kind: string;
    x: number;
    y: number;
    z: number;
    facing: 1 | -1;
    animTime: number;
    hurtTimer: number;
    stunTimer: number;
    burnTimer: number;
    hacked: boolean;
    telegraphTimer: number;
    hpRatio: number;
    phase: number;
  }>;
  projectiles: Array<{
    x: number;
    y: number;
    z: number;
    vx: number;
    vy: number;
    color: string;
    glowColor: string;
    radius: number;
    weaponId?: string;
    isEnemyBarrel?: boolean;
  }>;
  zones: Array<{
    kind: 'smoke' | 'vomit' | 'virus_beam';
    x: number;
    y: number;
    radius: number;
    timer: number;
  }>;
  pickups: Array<{
    kind: 'beer' | 'beer_bottle' | 'weapon';
    x: number;
    y: number;
    weaponId?: string;
  }>;
  particles: Array<{
    x: number;
    y: number;
    z: number;
    size: number;
    color: string;
  }>;
  texts: Array<{
    x: number;
    y: number;
    text: string;
    color: string;
  }>;
  hud?: unknown;
  musicTrack?: string;
  sfx?: Array<{ type: string; a?: string | number | boolean; b?: boolean; c?: number }>;
}

export interface NetGameMeta {
  phase: OnlineRoomSnapshot['phase'];
  levelId: LevelId;
  isVictoryCutscene: boolean;
  summary: StageClearSummary | null;
  score: number;
  continuesLeft: number;
}

type NetListeners = {
  onStatus?: (connected: boolean, detail?: string | null) => void;
  onRoomState?: (room: OnlineRoomSnapshot, role: OnlineRole) => void;
  onRoomList?: (rooms: PublicRoomInfo[]) => void;
  onError?: (message: string) => void;
  onPeerLeft?: (reason: string, hostLeft: boolean) => void;
  onRemoteInput?: (input: RemoteInputState) => void;
  onFrame?: (frame: NetFramePayload) => void;
  onGameMeta?: (meta: NetGameMeta) => void;
  onCutsceneSync?: (lineIndex: number) => void;
};

const CUSTOM_SERVER_KEY = 'green_beer_pizedes_server_url_v1';

function isPlainHttpHost(hostPart: string): boolean {
  const hostOnly = hostPart.split('/')[0].toLowerCase();
  if (hostOnly.startsWith('localhost') || hostOnly.startsWith('127.0.0.1')) return true;
  if (/^\d{1,3}(?:\.\d{1,3}){3}(?::\d+)?$/.test(hostOnly)) return true;
  if (/:\d+$/.test(hostOnly) && !hostOnly.endsWith(':443')) return true;
  return false;
}

function normalizeBaseHttpUrl(rawInput: string): string {
  let cleaned = rawInput.trim().replace(/\s+/g, '').replace(/\/+$/, '');
  if (!cleaned) return '';
  if (cleaned.endsWith('/ws')) {
    cleaned = cleaned.slice(0, -3).replace(/\/+$/, '');
  }
  if (cleaned.startsWith('ws://')) {
    return `http://${cleaned.slice('ws://'.length)}`;
  }
  if (cleaned.startsWith('wss://')) {
    return `https://${cleaned.slice('wss://'.length)}`;
  }
  if (cleaned.startsWith('http://') || cleaned.startsWith('https://')) {
    return cleaned;
  }
  const proto = isPlainHttpHost(cleaned) ? 'http://' : 'https://';
  return `${proto}${cleaned}`;
}

function httpToWsUrl(httpBase: string): string {
  const cleaned = httpBase.replace(/\/+$/, '');
  if (cleaned.startsWith('https://')) {
    return `wss://${cleaned.slice('https://'.length)}/ws`;
  }
  if (cleaned.startsWith('http://')) {
    return `ws://${cleaned.slice('http://'.length)}/ws`;
  }
  return `${isPlainHttpHost(cleaned) ? 'ws' : 'wss'}://${cleaned}/ws`;
}

class OnlineClient {
  private ws: WebSocket | null = null;
  private listeners: NetListeners = {};
  private reconnectTimer: number | null = null;
  private connectWatchdog: number | null = null;
  private pingTimer: number | null = null;
  private shouldStayConnected = false;
  private lastStatusDetail: string | null = null;
  private pendingOnOpen: unknown[] = [];

  constructor() {
    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => {
        if (this.shouldStayConnected && !this.isConnected()) {
          this.forceReconnect();
        }
      });
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible' && this.shouldStayConnected && !this.isConnected()) {
          this.forceReconnect();
        }
      });
    }
  }

  public getEnvServerUrl(): string {
    const raw = (import.meta.env.VITE_SERVER_URL as string | undefined)?.trim() ?? '';
    return raw ? normalizeBaseHttpUrl(raw) : '';
  }

  public getCustomServerUrl(): string {
    try {
      const saved = window.localStorage.getItem(CUSTOM_SERVER_KEY)?.trim() ?? '';
      return saved ? normalizeBaseHttpUrl(saved) : '';
    } catch {
      return '';
    }
  }

  public setCustomServerUrl(rawUrl: string): string {
    const normalized = normalizeBaseHttpUrl(rawUrl);
    try {
      if (normalized) {
        window.localStorage.setItem(CUSTOM_SERVER_KEY, normalized);
      } else {
        window.localStorage.removeItem(CUSTOM_SERVER_KEY);
      }
    } catch {
      // Ignore storage errors
    }
    if (this.shouldStayConnected) {
      this.forceReconnect();
    }
    return this.getEffectiveServerDisplay();
  }

  public getHttpBaseUrl(): string {
    const custom = this.getCustomServerUrl();
    if (custom) return custom;
    const envUrl = this.getEnvServerUrl();
    if (envUrl) return envUrl;
    if (typeof window !== 'undefined' && window.location.origin && window.location.origin !== 'null') {
      return window.location.origin.replace(/\/+$/, '');
    }
    return '';
  }

  public getEffectiveServerDisplay(): string {
    return this.getHttpBaseUrl() || 'localhost';
  }

  public getLastStatusDetail(): string | null {
    return this.lastStatusDetail;
  }

  public resolveWsUrl(): string {
    const custom = this.getCustomServerUrl();
    if (custom) return httpToWsUrl(custom);
    const envUrl = this.getEnvServerUrl();
    if (envUrl) return httpToWsUrl(envUrl);
    const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    return `${proto}//${window.location.host}/ws`;
  }

  private clearTimers(): void {
    if (this.reconnectTimer !== null) {
      window.clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.connectWatchdog !== null) {
      window.clearTimeout(this.connectWatchdog);
      this.connectWatchdog = null;
    }
    if (this.pingTimer !== null) {
      window.clearInterval(this.pingTimer);
      this.pingTimer = null;
    }
  }

  public forceReconnect(): void {
    this.clearTimers();
    const prev = this.ws;
    this.ws = null;
    if (prev) {
      try {
        prev.close();
      } catch {
        // Ignore
      }
    }
    this.connect();
  }

  public connect(): void {
    this.shouldStayConnected = true;

    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.lastStatusDetail = null;
      this.listeners.onStatus?.(true, null);
      this.send({ type: 'room:list' });
      return;
    }

    if (this.ws && this.ws.readyState === WebSocket.CONNECTING) {
      return;
    }

    this.clearTimers();
    const url = this.resolveWsUrl();

    // Detect browser Mixed-Content block early so user gets clear feedback instead of silent WifiOff
    const pageIsHttps = typeof window !== 'undefined' && window.location.protocol === 'https:';
    const targetIsInsecureWs = url.startsWith('ws://') && !url.startsWith('ws://localhost') && !url.startsWith('ws://127.0.0.1');
    if (pageIsHttps && targetIsInsecureWs) {
      const msg = `Браузер на HTTPS блокирует подключение к ${url}. Откройте игру по HTTP или укажите HTTPS-адрес сервера.`;
      this.lastStatusDetail = msg;
      this.listeners.onStatus?.(false, msg);
      return;
    }

    try {
      const ws = new WebSocket(url);
      this.ws = ws;

      // Abort hung CONNECTING sockets after 6s so reconnect loop recovers cleanly
      this.connectWatchdog = window.setTimeout(() => {
        if (this.ws === ws && ws.readyState === WebSocket.CONNECTING) {
          this.lastStatusDetail = `Сервер не отвечает (${this.getEffectiveServerDisplay()})`;
          this.listeners.onStatus?.(false, this.lastStatusDetail);
          try {
            ws.close();
          } catch {
            // Ignore
          }
        }
      }, 6000);

      ws.onopen = () => {
        if (this.ws !== ws) return;
        if (this.connectWatchdog !== null) {
          window.clearTimeout(this.connectWatchdog);
          this.connectWatchdog = null;
        }
        this.lastStatusDetail = null;
        this.listeners.onStatus?.(true, null);
        this.send({ type: 'room:list' });

        // Flush any queued room create/join sent right before socket opened
        if (this.pendingOnOpen.length > 0) {
          const queued = this.pendingOnOpen.splice(0, this.pendingOnOpen.length);
          for (const item of queued) {
            this.send(item);
          }
        }

        // Application-level keepalive ping every 20s for mobile NAT & reverse proxies
        if (this.pingTimer !== null) window.clearInterval(this.pingTimer);
        this.pingTimer = window.setInterval(() => {
          if (this.ws === ws && ws.readyState === WebSocket.OPEN) {
            this.send({ type: 'ping' });
          }
        }, 20000);
      };

      ws.onmessage = (ev) => {
        if (this.ws !== ws) return;
        try {
          const msg = JSON.parse(String(ev.data)) as Record<string, unknown>;
          switch (msg.type) {
            case 'pong':
              break;
            case 'room:state':
              this.listeners.onRoomState?.(
                msg.room as OnlineRoomSnapshot,
                msg.role as OnlineRole
              );
              break;
            case 'room:list':
              this.listeners.onRoomList?.((msg.rooms as PublicRoomInfo[]) ?? []);
              break;
            case 'room:error':
              this.listeners.onError?.(String(msg.message ?? 'Ошибка подключения'));
              break;
            case 'peer:left':
              this.listeners.onPeerLeft?.(
                String(msg.reason ?? 'Напарник отключился'),
                Boolean(msg.hostLeft)
              );
              break;
            case 'game:input':
              if (msg.input) {
                this.listeners.onRemoteInput?.(msg.input as RemoteInputState);
              }
              break;
            case 'game:frame':
              if (msg.frame) {
                this.listeners.onFrame?.(msg.frame as NetFramePayload);
              }
              break;
            case 'game:meta':
              this.listeners.onGameMeta?.(msg as unknown as NetGameMeta);
              break;
            case 'game:cutscene_sync':
              this.listeners.onCutsceneSync?.(Number(msg.lineIndex ?? 0));
              break;
          }
        } catch {
          // Ignore malformed message
        }
      };

      ws.onclose = () => {
        // Ignore close events from superseded sockets!
        if (this.ws !== ws) return;
        this.clearTimers();
        this.ws = null;
        if (!this.lastStatusDetail) {
          const isLocalApkOrigin =
            typeof window !== 'undefined' &&
            (window.location.hostname === 'localhost' || window.location.protocol === 'capacitor:') &&
            !this.getCustomServerUrl() &&
            !this.getEnvServerUrl();
          this.lastStatusDetail = isLocalApkOrigin
            ? 'Укажите адрес игрового сервера (например http://137.22.149.135:3002)'
            : `Нет соединения с ${this.getEffectiveServerDisplay()}`;
        }
        this.listeners.onStatus?.(false, this.lastStatusDetail);
        if (this.shouldStayConnected) {
          this.scheduleReconnect();
        }
      };

      ws.onerror = () => {
        if (this.ws !== ws) return;
        this.lastStatusDetail = `Не удалось подключиться к ${this.getEffectiveServerDisplay()}`;
      };
    } catch {
      this.lastStatusDetail = `Ошибка адреса сервера (${url})`;
      this.listeners.onStatus?.(false, this.lastStatusDetail);
      this.scheduleReconnect();
    }
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer !== null) return;
    this.reconnectTimer = window.setTimeout(() => {
      this.reconnectTimer = null;
      if (this.shouldStayConnected) {
        this.connect();
      }
    }, 2200);
  }

  public disconnect(): void {
    this.shouldStayConnected = false;
    this.pendingOnOpen = [];
    this.clearTimers();
    const prev = this.ws;
    this.ws = null;
    if (prev) {
      if (prev.readyState === WebSocket.OPEN) {
        try {
          prev.send(JSON.stringify({ type: 'room:leave' }));
        } catch {
          // Ignore
        }
      }
      try {
        prev.close();
      } catch {
        // Ignore
      }
    }
    this.listeners.onStatus?.(false, null);
  }

  public setListeners(partial: NetListeners): void {
    this.listeners = { ...this.listeners, ...partial };
    if (partial.onStatus) {
      partial.onStatus(this.isConnected(), this.isConnected() ? null : this.lastStatusDetail);
    }
  }

  public isConnected(): boolean {
    return Boolean(this.ws && this.ws.readyState === WebSocket.OPEN);
  }

  private send(payload: unknown, queueIfConnecting = false): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      if (queueIfConnecting && this.ws && this.ws.readyState === WebSocket.CONNECTING) {
        this.pendingOnOpen.push(payload);
      }
      return;
    }
    try {
      this.ws.send(JSON.stringify(payload));
    } catch {
      // Ignore transient send failures
    }
  }

  public requestRoomList(): void {
    this.send({ type: 'room:list' });
  }

  public createRoom(opts: {
    heroId: HeroId;
    difficulty: DifficultyId;
    levelId: LevelId;
    friendlyFire: boolean;
  }): void {
    this.send({ type: 'room:create', ...opts }, true);
  }

  public joinRoom(code: string): void {
    this.send({ type: 'room:join', code }, true);
  }

  public leaveRoom(): void {
    this.send({ type: 'room:leave' });
  }

  public selectHero(heroId: HeroId): void {
    this.send({ type: 'lobby:hero', heroId });
  }

  public setReady(ready: boolean): void {
    this.send({ type: 'lobby:ready', ready });
  }

  public updateLobbySettings(partial: {
    difficulty?: DifficultyId;
    levelId?: LevelId;
    friendlyFire?: boolean;
  }): void {
    this.send({ type: 'lobby:settings', ...partial });
  }

  public sendPhase(payload: {
    phase: OnlineRoomSnapshot['phase'];
    levelId: LevelId;
    isVictoryCutscene?: boolean;
    summary?: StageClearSummary | null;
    score?: number;
    continuesLeft?: number;
  }): void {
    this.send({ type: 'game:phase', ...payload });
  }

  public canSendFrame(): boolean {
    return Boolean(this.ws && this.ws.readyState === WebSocket.OPEN && this.ws.bufferedAmount < 16384);
  }

  public sendInput(input: RemoteInputState, urgent = false): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    // Drop non-urgent periodic movement heartbeats if outbound socket is temporarily backed up
    if (!urgent && this.ws.bufferedAmount > 8192) return;
    this.send({ type: 'game:input', input });
  }

  public sendFrame(frame: NetFramePayload): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    // Never pile up stale visual snapshots into the TCP send buffer
    if (this.ws.bufferedAmount > 24576) return;
    this.send({ type: 'game:frame', frame });
  }

  public sendCutsceneSync(lineIndex: number): void {
    this.send({ type: 'game:cutscene_sync', lineIndex });
  }
}

export const onlineClient = new OnlineClient();
