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
    kind: 'beer' | 'weapon';
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
  hud: unknown;
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
  onStatus?: (connected: boolean) => void;
  onRoomState?: (room: OnlineRoomSnapshot, role: OnlineRole) => void;
  onRoomList?: (rooms: PublicRoomInfo[]) => void;
  onError?: (message: string) => void;
  onPeerLeft?: (reason: string, hostLeft: boolean) => void;
  onRemoteInput?: (input: RemoteInputState) => void;
  onFrame?: (frame: NetFramePayload) => void;
  onGameMeta?: (meta: NetGameMeta) => void;
  onCutsceneSync?: (lineIndex: number) => void;
};

class OnlineClient {
  private ws: WebSocket | null = null;
  private listeners: NetListeners = {};
  private reconnectTimer: number | null = null;
  private shouldStayConnected = false;

  public connect(): void {
    this.shouldStayConnected = true;
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      return;
    }

    const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const url = `${proto}//${window.location.host}/ws`;

    try {
      const ws = new WebSocket(url);
      this.ws = ws;

      ws.onopen = () => {
        this.listeners.onStatus?.(true);
        this.send({ type: 'room:list' });
      };

      ws.onmessage = (ev) => {
        try {
          const msg = JSON.parse(String(ev.data)) as Record<string, unknown>;
          switch (msg.type) {
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
        this.listeners.onStatus?.(false);
        this.ws = null;
        if (this.shouldStayConnected) {
          this.scheduleReconnect();
        }
      };

      ws.onerror = () => {
        // Handled cleanly by onclose
      };
    } catch {
      this.listeners.onStatus?.(false);
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
    if (this.reconnectTimer !== null) {
      window.clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.ws) {
      this.send({ type: 'room:leave' });
      try {
        this.ws.close();
      } catch {
        // Ignore
      }
      this.ws = null;
    }
  }

  public setListeners(partial: NetListeners): void {
    this.listeners = { ...this.listeners, ...partial };
  }

  public isConnected(): boolean {
    return Boolean(this.ws && this.ws.readyState === WebSocket.OPEN);
  }

  private send(payload: unknown): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
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
    this.send({ type: 'room:create', ...opts });
  }

  public joinRoom(code: string): void {
    this.send({ type: 'room:join', code });
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

  public sendInput(input: RemoteInputState): void {
    this.send({ type: 'game:input', input });
  }

  public sendFrame(frame: NetFramePayload): void {
    this.send({ type: 'game:frame', frame });
  }

  public sendCutsceneSync(lineIndex: number): void {
    this.send({ type: 'game:cutscene_sync', lineIndex });
  }
}

export const onlineClient = new OnlineClient();
