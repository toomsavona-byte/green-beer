import { MusicTrack, soundEngine } from './audio';
import {
  ControlBindings,
  DEFAULT_CONTROL_BINDINGS,
  GamepadBinding,
  getGamepadBindingKey,
  isGamepadBindingActive,
  normalizeControlBindings,
} from './controls';
import { DIFFICULTY_MAP, HERO_MAP, LEVEL_MAP, WEAPON_MAP, WEAPONS } from './data';
import { NetFramePayload } from './net';
import {
  drawEnemySprite,
  drawHeroSprite,
  drawLevelBackground,
  drawPickupSprite,
  FLOOR_MAX_Y,
  FLOOR_MIN_Y,
  VIRTUAL_H,
  VIRTUAL_W,
} from './sprites';
import { getCameraOffsetY, getGroundElevation, getGroundSlope, randomizeLevelTerrain } from './terrain';
import {
  BossHudInfo,
  DifficultyId,
  EnemyKind,
  HeroId,
  HudSnapshot,
  LevelDef,
  LevelId,
  RemoteInputState,
  StageClearSummary,
  WeaponId,
} from './types';

const FLIGHT_MIN_Y = 56;
const FLIGHT_MAX_Y = 224;
const FLIGHT_ROOF_Y = 232;

interface SimPlayer {
  slot: 1 | 2;
  heroId: HeroId;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  facing: 1 | -1;
  aimX: number;
  aimY: number;
  hpSegments: number; // 0..3
  armorPips: number;
  maxArmorPips: number;
  lives: number; // 0..3
  weaponId: WeaponId;
  secondaryWeaponId: WeaponId | null;
  shootCd: number;
  meleeCd: number;
  boostCd: number;
  meleeTimer: number;
  shootTimer: number;
  hurtTimer: number;
  invulnTimer: number;
  rampLevel: number;
  animTime: number;
  moving: boolean;
  alive: boolean;
  score: number;
  hackCount: number;
}

interface SimEnemy {
  id: number;
  kind: EnemyKind;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  dashTimer: number;
  dashVx: number;
  dashVy: number;
  facing: 1 | -1;
  hp: number;
  maxHp: number;
  speed: number;
  attackCd: number;
  telegraphTimer: number;
  pendingAttack: 'none' | 'melee' | 'shoot' | 'vomit' | 'crate' | 'charge' | 'summon' | 'beam' | 'barrage';
  hurtTimer: number;
  stunTimer: number;
  burnTimer: number;
  burnTick: number;
  hacked: boolean;
  dead: boolean;
  animTime: number;
  phase: number;
  maxPhases: number;
  isBoss: boolean;
  scoreValue: number;
  shielded: boolean;
  dropping: boolean;
  bouncePause: number;
}

interface SimProjectile {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  damage: number;
  distLeft: number;
  fromPlayer: boolean;
  ownerSlot?: 1 | 2;
  weaponId?: WeaponId;
  pierce: boolean;
  hitIds: Set<number>;
  explosiveRadius: number;
  burnDuration: number;
  stunDuration: number;
  hacksTech: boolean;
  smokeCloud: boolean;
  color: string;
  glowColor: string;
  radius: number;
  isEnemyBarrel?: boolean;
  dead?: boolean;
}

interface SimZoneEffect {
  kind: 'smoke' | 'vomit' | 'virus_beam';
  x: number;
  y: number;
  radius: number;
  timer: number;
  maxTimer: number;
  tickCd: number;
  fromPlayer: boolean;
  ownerSlot?: 1 | 2;
}

interface SimPickup {
  id: number;
  kind: 'beer' | 'beer_bottle' | 'weapon';
  x: number;
  y: number;
  weaponId?: WeaponId;
  timer: number;
}

interface SimParticle {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  size: number;
  color: string;
  life: number;
  maxLife: number;
}

interface SimFloatingText {
  x: number;
  y: number;
  text: string;
  color: string;
  life: number;
}

interface PendingSpawn {
  kind: EnemyKind;
  x: number;
  y: number;
  delay: number;
  dropFromTop?: boolean;
}

export interface EngineCallbacks {
  onHudUpdate: (snapshot: HudSnapshot) => void;
  onStageClear: (summary: StageClearSummary) => void;
  onAllPlayersDead: (continuesLeft: number, score: number) => void;
  onPauseToggle: () => void;
  onNetFrame?: (frame: NetFramePayload) => void;
  canSendNetFrame?: () => boolean;
  onLocalGuestInput?: (input: RemoteInputState, urgent?: boolean) => void;
}

export interface EngineStartParams {
  levelId: LevelId;
  playerHeroes: HeroId[];
  continuesLeft: number;
  difficulty: DifficultyId;
  friendlyFire: boolean;
  carryScore?: number;
  onlineMode?: 'host' | 'guest';
}

export type VirtualButtonAction = 'shoot' | 'melee' | 'jump' | 'swap';

export interface EngineOptions {
  renderScale?: number;
  touchHints?: boolean;
  controls?: ControlBindings;
}

export class GameEngine {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private callbacks: EngineCallbacks;
  private renderScale = 2;
  private touchHints = false;
  private controls: ControlBindings = normalizeControlBindings(DEFAULT_CONTROL_BINDINGS);
  private boundKeySet = new Set<string>();
  private inputBlocked = false;

  private rafId: number | null = null;
  private lastTimestamp = 0;
  private paused = false;
  private running = false;

  private heldKeys = new Set<string>();
  private justPressedKeys = new Set<string>();

  // Virtual touch controls (for mobile/tablet P1)
  private virtualStickX = 0;
  private virtualStickY = 0;
  private virtualHeld = new Set<VirtualButtonAction>();
  private virtualJustPressed = new Set<VirtualButtonAction>();

  // Gamepad previous binding edge state (supports both buttons & analog axes/triggers)
  private prevPadBindings: Record<number, Record<string, boolean>> = {};

  private level!: LevelDef;
  private players: SimPlayer[] = [];
  private enemies: SimEnemy[] = [];
  private projectiles: SimProjectile[] = [];
  private zones: SimZoneEffect[] = [];
  private pickups: SimPickup[] = [];
  private particles: SimParticle[] = [];
  private texts: SimFloatingText[] = [];
  private pendingSpawns: PendingSpawn[] = [];

  private nextEntityId = 1;
  private camX = 0;
  private camLocked = false;
  private activeZoneIndex = 0;
  private bossSpawned = false;
  private bossDefeated = false;
  private bossDeathX = 0;
  private bossDeathY = 0;
  private bossExplosionTick = 0;
  private clearArenaPending = false;
  private stageClearDelay = 0;
  private checkpointReached = false;
  private checkpointCamX = 0;
  private nextCheckpointIdx = 0;
  private clearedHazards = new Set<string>();
  private announcedLandmarks = new Set<number>();

  private continuesLeft = 3;
  private difficulty: DifficultyId = 'normal';
  private friendlyFire = false;
  private carryScore = 0;
  private enemiesDefeated = 0;

  private simTime = 0;
  private hitstopTimer = 0;
  private shakeTime = 0;
  private shakeIntensity = 0;
  private hudEmitTimer = 0;
  private announcement: string | null = null;
  private announcementTimer = 0;
  private highwayBarrelTimer = 2.5;
  private deadTriggered = false;

  // Elevator mode & hazard hints
  private elevatorFloor = 1;
  private elevatorWaveTimer = 0.8;
  private jumpHintCd: Record<number, number> = { 1: 0, 2: 0 };
  private harleyRevCd = 0;

  // Online 2P Co-Op sync state
  private onlineMode: 'host' | 'guest' | null = null;
  private remoteP2Input: RemoteInputState = {
    up: false,
    down: false,
    left: false,
    right: false,
    analogX: 0,
    analogY: 0,
    melee: false,
    jump: false,
    shoot: false,
    swap: false,
  };
  private prevRemoteP2Input: RemoteInputState = {
    up: false,
    down: false,
    left: false,
    right: false,
    analogX: 0,
    analogY: 0,
    melee: false,
    jump: false,
    shoot: false,
    swap: false,
  };
  private remoteP2Latched = { melee: false, jump: false, swap: false };
  private netFrameTimer = 0;
  private netFrameSeq = 0;
  private lastNetHudSig = '';
  private lastNetHudTime = -10;
  private lastSentMusicTrack: string | null = null;
  private guestInputTimer = 0;
  private lastGuestInputKey = '';
  private remoteFrame: NetFramePayload | null = null;
  private prevRemoteFrame: NetFramePayload | null = null;
  private remoteFrameAt = 0;
  private remoteFrameInterval = 48;
  private lastAppliedNetSeq = 0;
  private pendingRemoteHud: HudSnapshot | null = null;
  private pendingRemoteSfx: Array<{ type: string; a?: string | number | boolean; b?: boolean; c?: number }> = [];
  private sfxQueue: Array<{ type: string; a?: string | number | boolean; b?: boolean; c?: number }> = [];
  private currentMusicTrack: MusicTrack = 'level1';
  private lastGuestMusicTrack: string | null = null;

  constructor(canvas: HTMLCanvasElement, callbacks: EngineCallbacks, options?: EngineOptions) {
    this.canvas = canvas;
    this.renderScale = options?.renderScale ?? 2;
    this.touchHints = Boolean(options?.touchHints);
    this.setControls(options?.controls ?? DEFAULT_CONTROL_BINDINGS);
    this.canvas.width = Math.round(VIRTUAL_W * this.renderScale);
    this.canvas.height = Math.round(VIRTUAL_H * this.renderScale);
    const context = canvas.getContext('2d', { alpha: false });
    if (!context) throw new Error('2D Canvas context unavailable');
    context.imageSmoothingEnabled = true;
    this.ctx = context;
    this.callbacks = callbacks;

    window.addEventListener('keydown', this.handleKeyDown, { passive: false });
    window.addEventListener('keyup', this.handleKeyUp);
    window.addEventListener('blur', this.handleBlur);
    document.addEventListener('visibilitychange', this.handleVisibility);
  }

  public destroy(): void {
    this.stop();
    window.removeEventListener('keydown', this.handleKeyDown);
    window.removeEventListener('keyup', this.handleKeyUp);
    window.removeEventListener('blur', this.handleBlur);
    document.removeEventListener('visibilitychange', this.handleVisibility);
  }

  public setControls(bindings: ControlBindings): void {
    this.controls = normalizeControlBindings(bindings);
    const keys = new Set<string>([
      'Space',
      'Semicolon',
      'Quote',
      'Slash',
      'Period',
      ...Object.values(this.controls.p1Keyboard),
      ...Object.values(this.controls.p2Keyboard),
    ]);
    this.boundKeySet = keys;
  }

  public setInputBlocked(blocked: boolean): void {
    this.inputBlocked = blocked;
    if (blocked) {
      this.heldKeys.clear();
      this.justPressedKeys.clear();
      this.clearVirtualInput();
    }
  }

  private handleKeyDown = (e: KeyboardEvent): void => {
    if (this.inputBlocked) return;

    if (this.boundKeySet.has(e.code)) {
      e.preventDefault();
    }

    if ((e.code === 'Escape' || e.code === this.controls.p1Keyboard.pause) && !e.repeat && this.running) {
      this.callbacks.onPauseToggle();
      return;
    }

    if (!this.heldKeys.has(e.code)) {
      this.justPressedKeys.add(e.code);
    }
    this.heldKeys.add(e.code);
  };

  private handleKeyUp = (e: KeyboardEvent): void => {
    this.heldKeys.delete(e.code);
  };

  private handleBlur = (): void => {
    this.heldKeys.clear();
    this.justPressedKeys.clear();
    this.clearVirtualInput();
  };

  private handleVisibility = (): void => {
    if (document.hidden) {
      this.heldKeys.clear();
      this.justPressedKeys.clear();
      this.clearVirtualInput();
    }
  };

  public setVirtualStick(x: number, y: number): void {
    this.virtualStickX = Math.max(-1, Math.min(1, x));
    this.virtualStickY = Math.max(-1, Math.min(1, y));
  }

  public setVirtualButton(action: VirtualButtonAction, pressed: boolean): void {
    if (pressed) {
      if (!this.virtualHeld.has(action)) {
        this.virtualJustPressed.add(action);
      }
      this.virtualHeld.add(action);
    } else {
      this.virtualHeld.delete(action);
    }
  }

  public clearVirtualInput(): void {
    this.virtualStickX = 0;
    this.virtualStickY = 0;
    this.virtualHeld.clear();
    this.virtualJustPressed.clear();
  }

  public setTouchHints(enabled: boolean): void {
    this.touchHints = enabled;
  }

  public setRenderScale(scale: number): void {
    const clamped = Math.max(1, Math.min(2, scale));
    if (Math.abs(clamped - this.renderScale) < 0.05) return;
    this.renderScale = clamped;
    this.canvas.width = Math.round(VIRTUAL_W * this.renderScale);
    this.canvas.height = Math.round(VIRTUAL_H * this.renderScale);
    this.ctx.imageSmoothingEnabled = true;
  }

  public setDifficulty(difficulty: DifficultyId): void {
    this.difficulty = difficulty;
    this.emitHud();
  }

  public setFriendlyFire(enabled: boolean): void {
    this.friendlyFire = enabled;
  }

  public setPaused(paused: boolean): void {
    this.paused = paused;
    if (paused) {
      this.heldKeys.clear();
      this.justPressedKeys.clear();
      this.clearVirtualInput();
    } else {
      this.lastTimestamp = performance.now();
    }
  }

  public setRemoteP2Input(input: RemoteInputState): void {
    if (input.melee && !this.remoteP2Input.melee) this.remoteP2Latched.melee = true;
    if (input.jump && !this.remoteP2Input.jump) this.remoteP2Latched.jump = true;
    if (input.swap && !this.remoteP2Input.swap) this.remoteP2Latched.swap = true;
    this.remoteP2Input = { ...input };
  }

  public applyRemoteFrame(frame: NetFramePayload): void {
    if (frame.seq !== undefined && frame.seq > 0) {
      if (frame.seq <= this.lastAppliedNetSeq && this.remoteFrame?.levelId === frame.levelId) {
        return;
      }
      this.lastAppliedNetSeq = frame.seq;
    }
    const now = performance.now();
    if (this.remoteFrame && this.remoteFrame.levelId === frame.levelId) {
      const dtMs = now - this.remoteFrameAt;
      if (dtMs >= 16 && dtMs <= 220) {
        this.remoteFrameInterval = this.remoteFrameInterval * 0.72 + dtMs * 0.28;
      }
      this.prevRemoteFrame = this.remoteFrame;
    } else {
      this.prevRemoteFrame = null;
      this.remoteFrameInterval = 48;
    }
    this.remoteFrame = frame;
    this.remoteFrameAt = now;

    if (frame.levelId && (!this.level || this.level.id !== frame.levelId)) {
      this.level = LEVEL_MAP[frame.levelId];
    }
    if (frame.musicTrack && frame.musicTrack !== this.lastGuestMusicTrack) {
      this.lastGuestMusicTrack = frame.musicTrack;
      soundEngine.playMusic(frame.musicTrack as MusicTrack);
    }
    if (frame.sfx && frame.sfx.length > 0) {
      // Queue SFX with hard cap so network packet bursts never stall Web Audio
      for (const cue of frame.sfx) {
        if (this.pendingRemoteSfx.length >= 8) this.pendingRemoteSfx.shift();
        this.pendingRemoteSfx.push(cue);
      }
    }
    if (frame.hud) {
      // Defer React HUD state update to RAF loop so burst packets never trigger synchronous React storms
      this.pendingRemoteHud = frame.hud as HudSnapshot;
    }
  }

  private queueSfx(type: string, a?: string | number | boolean, b?: boolean, c?: number): void {
    if (this.onlineMode === 'host' && this.sfxQueue.length < 18) {
      this.sfxQueue.push({ type, a, b, c });
    }
  }

  private setMusic(track: MusicTrack): void {
    this.currentMusicTrack = track;
    soundEngine.playMusic(track);
  }

  private replaySfxCue(cue: { type: string; a?: string | number | boolean; b?: boolean; c?: number }): void {
    switch (cue.type) {
      case 'weapon':
        soundEngine.playWeaponSfx(String(cue.a ?? 'pm') as WeaponId, Boolean(cue.b), Number(cue.c ?? 0));
        break;
      case 'melee':
        soundEngine.playMelee(Boolean(cue.a));
        break;
      case 'hit':
        soundEngine.playHit(Boolean(cue.a));
        break;
      case 'explosion':
        soundEngine.playExplosion();
        break;
      case 'jump':
        soundEngine.playJump();
        break;
      case 'beer':
        soundEngine.playPickupBeer();
        break;
      case 'pickup_weapon':
        soundEngine.playPickupWeapon();
        break;
      case 'hurt':
        soundEngine.playPlayerHurt();
        break;
      case 'life_lost':
        soundEngine.playLifeLost();
        break;
      case 'hack':
        soundEngine.playHack();
        break;
      case 'boss_warn':
        soundEngine.playBossWarn();
        break;
      case 'stage_clear':
        soundEngine.playStageClear();
        break;
      case 'harley':
        soundEngine.playHarleyThrottle(Boolean(cue.a));
        break;
    }
  }

  public startLevel(params: EngineStartParams): void {
    this.level = LEVEL_MAP[params.levelId];
    this.continuesLeft = params.continuesLeft;
    this.difficulty = params.difficulty;
    this.friendlyFire = params.friendlyFire;
    this.carryScore = params.carryScore ?? 0;
    this.onlineMode = params.onlineMode ?? null;
    this.enemiesDefeated = 0;

    this.enemies = [];
    this.projectiles = [];
    this.zones = [];
    this.pickups = [];
    this.particles = [];
    this.texts = [];
    this.pendingSpawns = [];
    this.sfxQueue = [];
    this.remoteFrame = null;
    this.prevRemoteFrame = null;
    this.remoteFrameAt = 0;
    this.remoteFrameInterval = 48;
    this.lastAppliedNetSeq = 0;
    this.pendingRemoteHud = null;
    this.pendingRemoteSfx = [];
    this.lastGuestMusicTrack = null;
    this.lastSentMusicTrack = null;
    this.netFrameTimer = 0;
    this.netFrameSeq = 0;
    this.lastNetHudSig = '';
    this.lastNetHudTime = -10;
    this.guestInputTimer = 0;
    this.lastGuestInputKey = '';
    this.remoteP2Latched = { melee: false, jump: false, swap: false };

    this.camX = 0;
    this.camLocked = this.level.mode === 'elevator';
    randomizeLevelTerrain(
      this.level.id,
      this.level.length,
      this.onlineMode ? this.level.id * 9187 + 1337 : undefined
    );
    this.activeZoneIndex = 0;
    this.bossSpawned = false;
    this.bossDefeated = false;
    this.clearArenaPending = false;
    this.stageClearDelay = 0;
    this.bossExplosionTick = 0;
    this.checkpointReached = false;
    this.checkpointCamX = 0;
    this.nextCheckpointIdx = 0;
    this.clearedHazards.clear();
    this.announcedLandmarks.clear();
    this.simTime = 0;
    this.hitstopTimer = 0;
    this.shakeTime = 0;
    this.deadTriggered = false;
    this.highwayBarrelTimer = 2.6;
    this.elevatorFloor = 1;
    this.elevatorWaveTimer = 0.9;
    this.jumpHintCd = { 1: 0, 2: 0 };

    this.players = params.playerHeroes.map((heroId, idx) => this.createPlayer((idx + 1) as 1 | 2, heroId));

    if (this.onlineMode !== 'guest') {
      this.showAnnouncement(
        this.level.mode === 'flight'
          ? 'ПОЛЁТ НАД КРЫШАМИ · УНИЧТОЖЬ ПОДСТАНЦИЮ!'
          : this.level.mode === 'highway'
            ? 'ХАЙВЕЙ! 8-НАПРАВЛЕННАЯ СТРЕЛЬБА НА БАЙКАХ!'
            : this.level.mode === 'elevator'
              ? 'ЛИФТ К ДИРЕКТОРУ! ВРАГИ ПРЫГАЮТ СВЕРХУ!'
              : `${this.level.name.toUpperCase()}`,
        2.6
      );
      this.setMusic(this.level.musicTrack);
    } else {
      soundEngine.playMusic(this.level.musicTrack);
      this.lastGuestMusicTrack = this.level.musicTrack;
    }

    this.paused = false;
    this.running = true;
    if (this.onlineMode !== 'guest') {
      this.emitHud();
    }
    this.startLoop();
  }

  private createPlayer(slot: 1 | 2, heroId: HeroId): SimPlayer {
    const hero = HERO_MAP[heroId];
    const maxArmorPips = Math.max(0, hero.stats.hp - 2);
    const isFlight = this.level?.mode === 'flight';
    return {
      slot,
      heroId,
      x: 75 + (slot === 2 ? 24 : 0),
      y: isFlight ? (slot === 1 ? 116 : 162) : slot === 1 ? 188 : 226,
      z: 0,
      vx: 0,
      vy: 0,
      vz: 0,
      facing: 1,
      aimX: 1,
      aimY: 0,
      hpSegments: 3, // Strictly 3 HP segments per life
      armorPips: maxArmorPips,
      maxArmorPips,
      lives: 3, // Strictly 3 lives
      weaponId: hero.nativeWeaponId,
      secondaryWeaponId: null,
      shootCd: 0,
      meleeCd: 0,
      boostCd: 0,
      meleeTimer: 0,
      shootTimer: 0,
      hurtTimer: 0,
      invulnTimer: 1.5,
      rampLevel: 0,
      animTime: 0,
      moving: false,
      alive: true,
      score: 0,
      hackCount: 0,
    };
  }

  public useContinue(): void {
    if (this.continuesLeft <= 0) return;
    this.continuesLeft -= 1;
    this.deadTriggered = false;

    this.projectiles = this.projectiles.filter((p) => p.fromPlayer);
    this.zones = this.zones.filter((z) => z.fromPlayer);

    const spawnBaseX = Math.max(this.camX + 68, this.checkpointReached ? this.checkpointCamX + 68 : this.camX + 68);
    const isFlight = this.level.mode === 'flight';
    this.players.forEach((p, idx) => {
      p.alive = true;
      p.lives = 3;
      p.hpSegments = 3;
      p.armorPips = p.maxArmorPips;
      p.x = spawnBaseX + idx * 24;
      p.y = isFlight ? (idx === 0 ? 116 : 162) : idx === 0 ? 188 : 226;
      p.z = isFlight ? 0 : 70;
      p.vz = 0;
      p.invulnTimer = 2.8;
      p.hurtTimer = 0;
    });

    this.showAnnouncement(`КОНТИНЬЮ! ОСТАЛОСЬ ПОПЫТОК: ${this.continuesLeft}`, 2.2);
    soundEngine.playPickupBeer();
    this.paused = false;
    this.lastTimestamp = performance.now();
    this.emitHud();
  }

  public stop(): void {
    this.running = false;
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  }

  private startLoop(): void {
    if (this.rafId !== null) cancelAnimationFrame(this.rafId);
    this.lastTimestamp = performance.now();
    const tick = (now: number) => {
      if (!this.running) return;
      const rawDt = (now - this.lastTimestamp) / 1000;
      this.lastTimestamp = now;
      const dt = Math.min(Math.max(rawDt, 0.001), 0.05);

      try {
        this.pollGamepadPause();
        if (this.onlineMode === 'guest') {
          this.updateGuestClient(dt);
        } else if (!this.paused) {
          this.update(dt);
          if (this.onlineMode === 'host') {
            this.netFrameTimer += dt;
            // ~22 Hz compact snapshots + backpressure guard: skip building/sending if socket buffer is backed up
            if (this.netFrameTimer >= 0.045) {
              if (!this.callbacks.canSendNetFrame || this.callbacks.canSendNetFrame()) {
                this.netFrameTimer = 0;
                this.callbacks.onNetFrame?.(this.buildNetFrame());
              } else {
                // Keep timer primed so we flush immediately on the very next free frame
                this.netFrameTimer = 0.045;
              }
            }
          }
        }
        this.render();
      } catch (err) {
        // Guard against any unexpected simulation error freezing the RAF loop
        console.error('GameEngine frame error:', err);
      } finally {
        this.justPressedKeys.clear();
        this.virtualJustPressed.clear();
        this.snapshotGamepadButtons();
        if (this.running) {
          this.rafId = requestAnimationFrame(tick);
        }
      }
    };
    this.rafId = requestAnimationFrame(tick);
  }

  private updateGuestClient(dt: number): void {
    // Flush at most 1 coalesced HUD update per animation frame (zero React re-render storms!)
    if (this.pendingRemoteHud) {
      const hud = this.pendingRemoteHud;
      this.pendingRemoteHud = null;
      this.callbacks.onHudUpdate(hud);
    }
    // Replay up to 4 queued SFX cues per frame so packet bursts never choke Web Audio
    if (this.pendingRemoteSfx.length > 0) {
      const batch = this.pendingRemoteSfx.splice(0, 4);
      for (const cue of batch) {
        this.replaySfxCue(cue);
      }
    }

    this.guestInputTimer += dt;
    // Guest uses primary local controls (custom P1 keys, Touch, or Gamepad 1) to drive P2 online!
    const ctrl = this.readLocalSlot1Controls();
    const gp = this.controls.gamepad;
    const pad = this.getConnectedPads()[0];
    const p1 = this.controls.p1Keyboard;
    const input: RemoteInputState = {
      up: ctrl.up,
      down: ctrl.down,
      left: ctrl.left,
      right: ctrl.right,
      analogX: Math.round(ctrl.analogX * 100) / 100,
      analogY: Math.round(ctrl.analogY * 100) / 100,
      melee:
        this.heldKeys.has(p1.melee) ||
        this.virtualHeld.has('melee') ||
        isGamepadBindingActive(pad, gp.melee) ||
        ctrl.melee,
      jump:
        this.heldKeys.has(p1.jump) ||
        this.virtualHeld.has('jump') ||
        isGamepadBindingActive(pad, gp.jump) ||
        ctrl.jump,
      shoot: ctrl.shoot,
      swap:
        this.heldKeys.has(p1.swap) ||
        this.virtualHeld.has('swap') ||
        isGamepadBindingActive(pad, gp.swap) ||
        ctrl.swap,
    };
    const key = `${input.up?1:0}${input.down?1:0}${input.left?1:0}${input.right?1:0}${input.melee?1:0}${input.jump?1:0}${input.shoot?1:0}${input.swap?1:0}:${Math.round(input.analogX*10)},${Math.round(input.analogY*10)}`;
    const edgeChanged = key !== this.lastGuestInputKey;
    // Send immediately on any input change, otherwise lightweight 10 Hz heartbeat
    if (edgeChanged || this.guestInputTimer >= 0.1) {
      this.guestInputTimer = 0;
      this.lastGuestInputKey = key;
      this.callbacks.onLocalGuestInput?.(input, edgeChanged);
    }
  }

  private showAnnouncement(text: string, duration = 2.0): void {
    this.announcement = text;
    this.announcementTimer = duration;
  }

  private triggerShake(intensity: number, duration: number): void {
    this.shakeIntensity = Math.max(this.shakeIntensity, intensity);
    this.shakeTime = Math.max(this.shakeTime, duration);
  }

  private spawnParticles(x: number, y: number, z: number, color: string, count: number, speed = 85): void {
    for (let i = 0; i < count; i++) {
      if (this.particles.length > 280) this.particles.shift();
      const ang = Math.random() * Math.PI * 2;
      const spd = speed * (0.35 + Math.random() * 0.85);
      this.particles.push({
        x,
        y,
        z: z + Math.random() * 14,
        vx: Math.cos(ang) * spd,
        vy: Math.sin(ang) * spd * 0.45,
        vz: 40 + Math.random() * 95,
        size: Math.random() < 0.45 ? 2 : 3,
        color,
        life: 0.25 + Math.random() * 0.34,
        maxLife: 0.59,
      });
    }
  }

  private addFloatingText(x: number, y: number, text: string, color: string): void {
    this.texts.push({ x, y, text, color, life: 0.95 });
  }

  private flushClearedEntities(): void {
    if (this.clearArenaPending) {
      this.clearArenaPending = false;
      this.enemies = [];
      this.projectiles = [];
      this.zones = [];
      this.pendingSpawns = [];
      return;
    }
    this.enemies = this.enemies.filter((e) => !e.dead && e.hp > 0);
    this.projectiles = this.projectiles.filter((p) => !p.dead);
  }

  private update(dt: number): void {
    this.simTime += dt;

    if (this.announcementTimer > 0) {
      this.announcementTimer -= dt;
      if (this.announcementTimer <= 0) this.announcement = null;
    }

    if (this.shakeTime > 0) {
      this.shakeTime -= dt;
      if (this.shakeTime <= 0) this.shakeIntensity = 0;
    }

    if (this.hitstopTimer > 0) {
      this.hitstopTimer -= dt;
      return;
    }

    // Contra Hard Corps chained boss explosion sequence before Stage Clear!
    if (this.bossDefeated) {
      this.stageClearDelay -= dt;
      this.bossExplosionTick -= dt;
      if (this.bossExplosionTick <= 0 && this.stageClearDelay > 0.3) {
        this.bossExplosionTick = 0.24;
        const ox = (Math.random() - 0.5) * 64;
        const oy = (Math.random() - 0.5) * 44;
        this.spawnParticles(this.bossDeathX + ox, this.bossDeathY + oy, 22, '#FFB000', 14, 130);
        this.spawnParticles(this.bossDeathX + ox, this.bossDeathY + oy, 18, '#39FF14', 12, 110);
        this.spawnParticles(this.bossDeathX + ox, this.bossDeathY + oy, 28, '#FFFFFF', 6, 90);
        this.triggerShake(5, 0.16);
        soundEngine.playExplosion();
        this.queueSfx('explosion');
      }
      this.updateParticles(dt);
      this.updateTexts(dt);
      if (this.stageClearDelay <= 0) {
        this.paused = true;
        const totalScore = this.getTotalScore();
        this.callbacks.onStageClear({
          levelId: this.level.id,
          levelName: this.level.name,
          bossName: this.level.bossName,
          score: totalScore,
          enemiesDefeated: this.enemiesDefeated,
          continuesLeft: this.continuesLeft,
        });
      }
      return;
    }

    // Flight auto-scroll over city rooftops toward the factory substation
    if (this.level.mode === 'flight' && !this.camLocked && !this.bossSpawned) {
      const scrollStep = 82 * dt;
      this.camX = Math.min(this.level.length - VIRTUAL_W, this.camX + scrollStep);
      this.players.forEach((p) => {
        if (p.alive) p.x += scrollStep;
      });
    }

    // Highway auto-scroll (deliberate cruiser pacing)
    if (this.level.mode === 'highway' && !this.camLocked && !this.bossSpawned) {
      const scrollStep = 104 * dt;
      this.camX = Math.min(this.level.length - VIRTUAL_W, this.camX + scrollStep);
      this.players.forEach((p) => {
        if (p.alive) p.x += scrollStep;
      });

      this.highwayBarrelTimer -= dt;
      if (this.highwayBarrelTimer <= 0) {
        const diff = DIFFICULTY_MAP[this.difficulty];
        this.highwayBarrelTimer = (2.6 + Math.random() * 1.5) * diff.fireCooldownMult;
        const laneY = FLOOR_MIN_Y + 14 + Math.random() * (FLOOR_MAX_Y - FLOOR_MIN_Y - 26);
        this.projectiles.push({
          x: this.camX + VIRTUAL_W + 18,
          y: laneY,
          z: 0,
          vx: -152 * diff.projectileSpeedMult,
          vy: 0,
          damage: 1,
          distLeft: VIRTUAL_W + 90,
          fromPlayer: false,
          pierce: false,
          hitIds: new Set(),
          explosiveRadius: 0,
          burnDuration: 0,
          stunDuration: 0,
          hacksTech: false,
          smokeCloud: false,
          color: '#39FF14',
          glowColor: '#86EFAC',
          radius: 9,
          isEnemyBarrel: true,
        });
      }
    }

    // Decrement jump hint & Harley throttle cooldowns
    if (this.jumpHintCd[1] > 0) this.jumpHintCd[1] = Math.max(0, this.jumpHintCd[1] - dt);
    if (this.jumpHintCd[2] > 0) this.jumpHintCd[2] = Math.max(0, this.jumpHintCd[2] - dt);
    if (this.harleyRevCd > 0) this.harleyRevCd = Math.max(0, this.harleyRevCd - dt);

    // Update players
    this.players.forEach((p) => this.updatePlayer(p, dt));
    this.flushClearedEntities();

    // Beat 'em up camera follow (smooth arcade scroll — NEVER yanks or teleports the trailing player in 2P!)
    const alivePlayers = this.players.filter((p) => p.alive);
    if (alivePlayers.length > 0 && !this.camLocked && this.level.mode === 'beatemup') {
      const maxX = Math.max(...alivePlayers.map((p) => p.x));
      const minX = Math.min(...alivePlayers.map((p) => p.x));
      // In 2P co-op: advance gently on midpoint and never scroll past the trailing player (24px margin),
      // so the leading player simply waits at the right edge instead of dragging P2!
      const desiredCamX =
        alivePlayers.length > 1
          ? Math.min(minX - 24, (minX + maxX) * 0.5 - VIRTUAL_W * 0.42)
          : maxX - VIRTUAL_W * 0.42;
      const targetCamX = Math.max(this.camX, Math.min(this.level.length - VIRTUAL_W, desiredCamX));
      const step = (targetCamX - this.camX) * Math.min(1, dt * 4.5);
      this.camX += Math.min(step, 150 * dt);
    }

    // Clamp players cleanly (elevator platform has tighter side rails; flight uses full sky band)
    const minPlayX = this.level.mode === 'elevator' ? 28 : this.camX + 20;
    const maxPlayX = this.level.mode === 'elevator' ? VIRTUAL_W - 28 : this.camX + VIRTUAL_W - 22;
    const minPlayY = this.level.mode === 'flight' ? FLIGHT_MIN_Y : FLOOR_MIN_Y + 4;
    const maxPlayY = this.level.mode === 'flight' ? FLIGHT_MAX_Y : FLOOR_MAX_Y;
    this.players.forEach((p) => {
      if (!p.alive) return;
      p.x = Math.max(minPlayX, Math.min(maxPlayX, p.x));
      p.y = Math.max(minPlayY, Math.min(maxPlayY, p.y));
    });

    // Multi-Checkpoints with dynamic HP / armor top-up & supply weapon crate!
    const checkpoints = this.level.checkpoints;
    if (this.level.mode !== 'elevator' && this.nextCheckpointIdx < checkpoints.length && this.camX >= checkpoints[this.nextCheckpointIdx]) {
      this.nextCheckpointIdx += 1;
      this.checkpointReached = true;
      this.checkpointCamX = this.camX;
      this.players.forEach((p) => {
        if (!p.alive) return;
        p.hpSegments = Math.min(3, p.hpSegments + 1);
        p.armorPips = p.maxArmorPips;
        this.spawnParticles(p.x, p.y, 18, '#FFB000', 10, 75);
      });
      const dropCheckpointWeapon = this.level.mode !== 'flight' && this.nextCheckpointIdx % 2 === 1;
      if (dropCheckpointWeapon) {
        const heldSet = new Set(this.players.map((p) => p.weaponId));
        const freshPool = WEAPONS.filter((w) => !heldSet.has(w.id));
        const pickPool = freshPool.length > 0 ? freshPool : WEAPONS;
        const bonusWpn = pickPool[Math.floor(Math.random() * pickPool.length)].id;
        this.pickups.push({
          id: this.nextEntityId++,
          kind: 'weapon',
          x: this.camX + 260,
          y: 204,
          weaponId: bonusWpn,
          timer: 32,
        });
      }
      this.showAnnouncement(
        `ЧЕКПОЙНТ ${this.nextCheckpointIdx}/${checkpoints.length}! ${dropCheckpointWeapon ? '+1 HP И ОРУЖИЕ!' : '+1 HP И БРОНЯ!'}`,
        2.2
      );
      soundEngine.playPickupBeer();
      this.queueSfx('beer');
      this.emitHud();
    }

    // Monumental landmark atmospheric alerts
    for (let li = 0; li < this.level.landmarks.length; li++) {
      if (this.announcedLandmarks.has(li)) continue;
      const lm = this.level.landmarks[li];
      if (this.camX + VIRTUAL_W - 40 >= lm.x - 120) {
        this.announcedLandmarks.add(li);
        if (lm.kind === 'bridge_hole') {
          this.showAnnouncement('ОСТОРОЖНО! ПРОВАЛЫ В МОСТУ — ПРЫГАЙТЕ ИЛИ ОБЪЕЗЖАЙТЕ!', 2.4);
          soundEngine.playBossWarn();
          this.queueSfx('boss_warn');
        } else if (lm.label && !this.announcement) {
          this.showAnnouncement(`ЛОКАЦИЯ: ${lm.label}`, 1.7);
        }
      }
    }

    // Interactive Road Obstacles & Hazards (Jump-required barriers, boom gates, crate rows, slime rivers, laser gates, bridge holes!)
    if (this.level.roadHazards && this.level.roadHazards.length > 0) {
      for (const hz of this.level.roadHazards) {
        for (const p of this.players) {
          if (!p.alive) continue;
          const dx = Math.abs(p.x - hz.x);
          const dy = Math.abs(p.y - hz.y);
          const key = `${hz.id}_${p.slot}`;
          const isSolid = hz.solid || hz.kind === 'barrier' || hz.kind === 'boom_gate' || hz.kind === 'crate_row';

          if (isSolid) {
            const halfW = hz.w * 0.5 + 8;
            const halfH = hz.h * 0.52;
            if (dx < halfW && dy < halfH) {
              if (p.z >= 14) {
                if (!this.clearedHazards.has(key)) {
                  this.clearedHazards.add(key);
                  p.score += 150;
                  this.addFloatingText(p.x, p.y - 46, 'ПРЫЖОК! +150', '#39FF14');
                  soundEngine.playPickupWeapon();
                  this.queueSfx('pickup_weapon');
                }
              } else {
                // Solid roadblock: physically blocks grounded movement — must jump over!
                const pushDir = p.x < hz.x ? -1 : 1;
                p.x = hz.x + pushDir * halfW;
                if (this.jumpHintCd[p.slot] <= 0) {
                  this.jumpHintCd[p.slot] = 1.6;
                  this.addFloatingText(p.x, p.y - 46, 'ПРЫГАЙ!', '#FFB000');
                }
              }
            }
          } else if (hz.kind === 'slime_river') {
            if (dx < hz.w * 0.45 && dy < hz.h * 0.52) {
              if (p.z >= 8) {
                if (!this.clearedHazards.has(key)) {
                  this.clearedHazards.add(key);
                  p.score += 200;
                  this.addFloatingText(p.x, p.y - 46, 'НАД ЖИЖЕЙ! +200', '#39FF14');
                  soundEngine.playPickupWeapon();
                  this.queueSfx('pickup_weapon');
                }
              } else if (p.invulnTimer <= 0) {
                this.damagePlayer(p, 1, 'ЗЕЛЁНАЯ ЖИЖА!');
                p.vz = 215;
                p.z = 10;
                this.spawnParticles(p.x, p.y, 6, '#39FF14', 14, 95);
              }
            }
          } else if (hz.kind === 'laser_gate') {
            const laserOn = (this.simTime + (hz.pulseOffset ?? 0)) % 2.8 < 2.0;
            if (dx < hz.w * 0.46 + 5 && dy < hz.h * 0.52) {
              if (p.z >= 14) {
                if (laserOn && !this.clearedHazards.has(key)) {
                  this.clearedHazards.add(key);
                  p.score += 250;
                  this.addFloatingText(p.x, p.y - 46, 'НАД ЛАЗЕРОМ! +250', '#00E5FF');
                  soundEngine.playPickupWeapon();
                  this.queueSfx('pickup_weapon');
                }
              } else if (laserOn && p.invulnTimer <= 0) {
                this.damagePlayer(p, 1, 'ЛАЗЕР!');
                p.x += p.x < hz.x ? -16 : 16;
                p.vz = 175;
                p.z = 8;
                this.spawnParticles(p.x, p.y, 14, '#FF2A85', 14, 110);
                this.spawnParticles(p.x, p.y, 16, '#00E5FF', 8, 90);
              }
            }
          } else {
            // bridge_hole
            if (dx < hz.w * 0.44 && dy < hz.h * 0.44) {
              if (p.z >= 10) {
                if (!this.clearedHazards.has(key)) {
                  this.clearedHazards.add(key);
                  p.score += 250;
                  this.addFloatingText(p.x, p.y - 46, 'ПРЫЖОК! +250', '#00E5FF');
                  soundEngine.playPickupWeapon();
                  this.queueSfx('pickup_weapon');
                }
              } else if (p.invulnTimer <= 0) {
                this.damagePlayer(p, 1, 'ПРОВАЛ В МОСТУ!');
                p.vz = 265;
                p.z = 12;
                this.spawnParticles(p.x, p.y, 4, '#FF2A85', 14, 110);
                this.spawnParticles(p.x, p.y, 8, '#FACC15', 10, 95);
              }
            }
          }
        }
      }
    }

    // Level 5 Vertical Freight Elevator Progression (enemies drop from top, floors climb 1F -> 88F!)
    const coopCountMult = this.players.length === 2 ? 1.35 : 1.0;
    if (this.level.mode === 'elevator') {
      this.camX = 0;
      this.camLocked = true;
      const targetFloor = this.bossSpawned
        ? 88
        : Math.min(84, Math.max(1, Math.round(1 + (this.activeZoneIndex / Math.max(1, this.level.zones.length)) * 84)));
      if (this.elevatorFloor < targetFloor) {
        this.elevatorFloor = Math.min(targetFloor, this.elevatorFloor + dt * 7.5);
      } else if (!this.bossSpawned) {
        // Gentle steady climb while fighting
        this.elevatorFloor = Math.min(86, this.elevatorFloor + dt * 1.1);
      }

      const hostileRemaining =
        this.enemies.filter((e) => !e.hacked && !e.dead).length + this.pendingSpawns.length;

      if (!this.bossSpawned && hostileRemaining === 0) {
        this.elevatorWaveTimer -= dt;
        if (this.elevatorWaveTimer <= 0) {
          if (this.activeZoneIndex < this.level.zones.length) {
            const zone = this.level.zones[this.activeZoneIndex];
            const diff = DIFFICULTY_MAP[this.difficulty];
            const waveNum = this.activeZoneIndex + 1;
            const floorNum = Math.min(86, Math.round(this.elevatorFloor));
            this.showAnnouncement(`ЭТАЖ ${floorNum}F · ВОЛНА ${waveNum}/${this.level.zones.length} — СВЕРХУ!`, 1.9);
            this.queueWaveSpawns(zone, diff.enemyCountMult * coopCountMult, true);
            this.activeZoneIndex += 1;
            this.elevatorWaveTimer = 1.6;
            // Mid-elevator checkpoint heal after Wave 4
            if (waveNum === 5) {
              this.players.forEach((p) => {
                if (!p.alive) return;
                p.hpSegments = Math.min(3, p.hpSegments + 1);
                p.armorPips = p.maxArmorPips;
              });
              soundEngine.playPickupBeer();
              this.queueSfx('beer');
            }
          } else {
            this.bossSpawned = true;
            this.elevatorFloor = 88;
            this.checkpointReached = true;
            this.spawnEnemy(this.level.bossKind, VIRTUAL_W * 0.65, 206, true);
            this.showAnnouncement(`ЭТАЖ 88F! БОСС СВЕРХУ: ${this.level.bossName}`, 3.2);
            soundEngine.playBossWarn();
            this.queueSfx('boss_warn');
            this.setMusic('boss');
            this.emitHud();
          }
        }
      }
    } else {
      // Standard Beat 'em up / Highway Arena zone locks
      if (!this.camLocked && this.activeZoneIndex < this.level.zones.length) {
        const zone = this.level.zones[this.activeZoneIndex];
        if (this.camX >= zone.lockX) {
          this.camLocked = true;
          this.camX = zone.lockX;
          const diff = DIFFICULTY_MAP[this.difficulty];
          this.queueWaveSpawns(zone, diff.enemyCountMult * coopCountMult, false);
        }
      }
    }

    // Pending spawns
    for (let i = this.pendingSpawns.length - 1; i >= 0; i--) {
      this.pendingSpawns[i].delay -= dt;
      if (this.pendingSpawns[i].delay <= 0) {
        const sp = this.pendingSpawns.splice(i, 1)[0];
        this.spawnEnemy(sp.kind, sp.x, sp.y, Boolean(sp.dropFromTop));
      }
    }

    // Zone unlock when clear (non-elevator)
    if (this.level.mode !== 'elevator') {
      const hostileRemaining =
        this.enemies.filter((e) => !e.hacked && !e.dead).length + this.pendingSpawns.length;
      if (this.camLocked && !this.bossSpawned && hostileRemaining === 0) {
        this.camLocked = false;
        this.activeZoneIndex += 1;
        this.showAnnouncement('ЧИСТО! ВПЕРЁД ->', 1.5);
      }

      // Boss arena trigger (reliable 24px threshold)
      if (
        !this.bossSpawned &&
        this.activeZoneIndex >= this.level.zones.length &&
        this.camX >= this.level.length - VIRTUAL_W - 24
      ) {
        this.bossSpawned = true;
        this.camLocked = true;
        this.camX = this.level.length - VIRTUAL_W;
        this.checkpointReached = true;
        this.checkpointCamX = this.camX;
        const bossSpawnX =
          this.level.bossKind === 'boss_electrician'
            ? this.camX + VIRTUAL_W - 112
            : this.camX + VIRTUAL_W - 72;
        const bossSpawnY =
          this.level.bossKind === 'boss_electrician' ? FLIGHT_ROOF_Y : 206;
        this.spawnEnemy(this.level.bossKind, bossSpawnX, bossSpawnY, false);
        this.showAnnouncement(
          this.level.bossKind === 'boss_electrician'
            ? `БОСС: ${this.level.bossName}! ВЫРУБИ ЕГО И ВЗОРВИ ПОДСТАНЦИЮ!`
            : `ВНИМАНИЕ! БОСС: ${this.level.bossName}`,
          3.4
        );
        soundEngine.playBossWarn();
        this.queueSfx('boss_warn');
        this.setMusic('boss');
        this.emitHud();
      }
    }

    this.updateEnemies(dt);
    this.flushClearedEntities();

    this.updateProjectiles(dt);
    this.flushClearedEntities();

    this.updateZones(dt);
    this.flushClearedEntities();

    this.updatePickups(dt);
    this.updateParticles(dt);
    this.updateTexts(dt);

    // Total defeat check
    if (!this.deadTriggered && this.players.every((p) => !p.alive)) {
      this.deadTriggered = true;
      this.paused = true;
      this.callbacks.onAllPlayersDead(this.continuesLeft, this.getTotalScore());
    }

    this.hudEmitTimer += dt;
    if (this.hudEmitTimer >= 0.08) {
      this.hudEmitTimer = 0;
      this.emitHud();
    }
  }

  private getConnectedPads(): Gamepad[] {
    if (typeof navigator === 'undefined' || !navigator.getGamepads) return [];
    try {
      const raw = navigator.getGamepads();
      const pads: Gamepad[] = [];
      for (let i = 0; i < raw.length; i++) {
        const gp = raw[i];
        if (gp && gp.connected) pads.push(gp);
      }
      return pads;
    } catch {
      return [];
    }
  }

  private isPadBindingJustPressed(pad: Gamepad | undefined, binding: GamepadBinding): boolean {
    if (!pad) return false;
    const key = getGamepadBindingKey(binding);
    const cur = isGamepadBindingActive(pad, binding);
    const prev = Boolean(this.prevPadBindings[pad.index]?.[key]);
    return cur && !prev;
  }

  private pollGamepadPause(): void {
    if (this.inputBlocked) return;
    const pads = this.getConnectedPads();
    for (const pad of pads) {
      if (this.isPadBindingJustPressed(pad, this.controls.gamepad.pause)) {
        this.callbacks.onPauseToggle();
        break;
      }
    }
  }

  private snapshotGamepadButtons(): void {
    const pads = this.getConnectedPads();
    const gpBindings = Object.values(this.controls.gamepad);
    for (const pad of pads) {
      const state: Record<string, boolean> = {};
      for (const b of gpBindings) {
        state[getGamepadBindingKey(b)] = isGamepadBindingActive(pad, b);
      }
      this.prevPadBindings[pad.index] = state;
    }
  }

  private queueWaveSpawns(
    zone: LevelDef['zones'][number],
    totalCountMult: number,
    forceDropFromTop: boolean
  ): void {
    zone.spawns.forEach((sp) => {
      const drop = forceDropFromTop || Boolean(sp.dropFromTop);
      const spawnX = forceDropFromTop
        ? Math.max(46, Math.min(VIRTUAL_W - 46, sp.offsetX))
        : this.camX + sp.offsetX;
      this.pendingSpawns.push({
        kind: sp.kind,
        x: spawnX,
        y: sp.y,
        delay: sp.delay ?? 0,
        dropFromTop: drop,
      });
    });

    // Scale enemy count cleanly for Difficulty (Medium +40% / Hard +85%) AND 2P Co-Op (+35% stacked)!
    const isFlight = this.level.mode === 'flight';
    const extraCount = Math.round(zone.spawns.length * (totalCountMult - 1));
    if (extraCount > 0) {
      const mobilePool = zone.spawns.filter((s) => s.kind !== 'turret');
      const fallbackPool = mobilePool.length > 0 ? mobilePool : zone.spawns;
      for (let ex = 0; ex < extraCount; ex++) {
        const template = fallbackPool[ex % fallbackPool.length];
        const laneY = isFlight
          ? FLIGHT_MIN_Y + 14 + ((ex * 37 + 19) % (FLIGHT_MAX_Y - FLIGHT_MIN_Y - 34))
          : FLOOR_MIN_Y + 18 + ((ex * 29 + 13) % Math.max(24, FLOOR_MAX_Y - FLOOR_MIN_Y - 26));
        if (forceDropFromTop) {
          const dropX = 64 + ((ex * 73 + 31) % (VIRTUAL_W - 128));
          this.pendingSpawns.push({
            kind: template.kind,
            x: dropX,
            y: laneY,
            delay: 1.55 + ex * 0.75,
            dropFromTop: true,
          });
        } else {
          const fromLeft = ex % 2 === 1;
          const flankOffsetX = fromLeft ? -24 - (ex % 3) * 10 : 456 + (ex % 3) * 12;
          this.pendingSpawns.push({
            kind: template.kind,
            x: this.camX + flankOffsetX,
            y: laneY,
            delay: 1.65 + ex * 0.85,
            dropFromTop: false,
          });
        }
      }
    }

    if (zone.dropWeapon && !isFlight && this.activeZoneIndex % 2 === 0) {
      this.pickups.push({
        id: this.nextEntityId++,
        kind: 'weapon',
        x: (forceDropFromTop ? 0 : this.camX) + 190 + Math.random() * 90,
        y: 192 + Math.random() * 36,
        weaponId: zone.dropWeapon,
        timer: 26,
      });
    }
    if (zone.dropBeer) {
      this.pickups.push({
        id: this.nextEntityId++,
        kind: 'beer',
        x: (forceDropFromTop ? 0 : this.camX) + 150 + Math.random() * 120,
        y: isFlight ? 90 + Math.random() * 92 : 185 + Math.random() * 40,
        timer: 26,
      });
    }
  }

  private readLocalSlot1Controls() {
    const pads = this.getConnectedPads();
    const pad = pads[0];
    const gp = this.controls.gamepad;
    const p1 = this.controls.p1Keyboard;

    const padAxisX = pad && Math.abs(pad.axes[0] ?? 0) > 0.28 ? pad.axes[0] : 0;
    const padAxisY = pad && Math.abs(pad.axes[1] ?? 0) > 0.28 ? pad.axes[1] : 0;
    const padUp = isGamepadBindingActive(pad, gp.up) || padAxisY < -0.28;
    const padDown = isGamepadBindingActive(pad, gp.down) || padAxisY > 0.28;
    const padLeft = isGamepadBindingActive(pad, gp.left) || padAxisX < -0.28;
    const padRight = isGamepadBindingActive(pad, gp.right) || padAxisX > 0.28;
    const padJump = this.isPadBindingJustPressed(pad, gp.jump);
    const padMelee = this.isPadBindingJustPressed(pad, gp.melee);
    const padShoot = isGamepadBindingActive(pad, gp.shoot);
    const padSwap = this.isPadBindingJustPressed(pad, gp.swap);

    const stickDead = 0.22;
    const vx = Math.abs(this.virtualStickX) > stickDead ? this.virtualStickX : 0;
    const vy = Math.abs(this.virtualStickY) > stickDead ? this.virtualStickY : 0;
    return {
      up: this.heldKeys.has(p1.up) || vy < -stickDead || padUp,
      down: this.heldKeys.has(p1.down) || vy > stickDead || padDown,
      left: this.heldKeys.has(p1.left) || vx < -stickDead || padLeft,
      right: this.heldKeys.has(p1.right) || vx > stickDead || padRight,
      analogX: vx !== 0 ? vx : padAxisX,
      analogY: vy !== 0 ? vy : padAxisY,
      melee: this.justPressedKeys.has(p1.melee) || this.virtualJustPressed.has('melee') || padMelee,
      jump: this.justPressedKeys.has(p1.jump) || this.virtualJustPressed.has('jump') || padJump,
      shoot: this.heldKeys.has(p1.shoot) || this.virtualHeld.has('shoot') || padShoot,
      swap: this.justPressedKeys.has(p1.swap) || this.virtualJustPressed.has('swap') || padSwap,
    };
  }

  private getPlayerControls(slot: 1 | 2) {
    if (slot === 1) {
      return this.readLocalSlot1Controls();
    }

    // Online Host drives P2 directly from live WebSocket guest input!
    if (this.onlineMode === 'host') {
      const cur = this.remoteP2Input;
      const prev = this.prevRemoteP2Input;
      const melee = (cur.melee && !prev.melee) || this.remoteP2Latched.melee;
      const jump = (cur.jump && !prev.jump) || this.remoteP2Latched.jump;
      const swap = (cur.swap && !prev.swap) || this.remoteP2Latched.swap;
      this.remoteP2Latched.melee = false;
      this.remoteP2Latched.jump = false;
      this.remoteP2Latched.swap = false;
      this.prevRemoteP2Input = { ...cur };
      return {
        up: cur.up,
        down: cur.down,
        left: cur.left,
        right: cur.right,
        analogX: cur.analogX,
        analogY: cur.analogY,
        melee,
        jump,
        shoot: cur.shoot,
        swap,
      };
    }

    const pads = this.getConnectedPads();
    const pad = pads[1];
    const gp = this.controls.gamepad;
    const p2 = this.controls.p2Keyboard;

    const padAxisX = pad && Math.abs(pad.axes[0] ?? 0) > 0.28 ? pad.axes[0] : 0;
    const padAxisY = pad && Math.abs(pad.axes[1] ?? 0) > 0.28 ? pad.axes[1] : 0;
    const padUp = isGamepadBindingActive(pad, gp.up) || padAxisY < -0.28;
    const padDown = isGamepadBindingActive(pad, gp.down) || padAxisY > 0.28;
    const padLeft = isGamepadBindingActive(pad, gp.left) || padAxisX < -0.28;
    const padRight = isGamepadBindingActive(pad, gp.right) || padAxisX > 0.28;
    const padJump = this.isPadBindingJustPressed(pad, gp.jump);
    const padMelee = this.isPadBindingJustPressed(pad, gp.melee);
    const padShoot = isGamepadBindingActive(pad, gp.shoot);
    const padSwap = this.isPadBindingJustPressed(pad, gp.swap);

    return {
      up: this.heldKeys.has(p2.up) || padUp,
      down: this.heldKeys.has(p2.down) || padDown,
      left: this.heldKeys.has(p2.left) || padLeft,
      right: this.heldKeys.has(p2.right) || padRight,
      analogX: padAxisX,
      analogY: padAxisY,
      melee:
        this.justPressedKeys.has(p2.melee) ||
        (p2.melee === 'Numpad1' && this.justPressedKeys.has('Semicolon')) ||
        padMelee,
      jump:
        this.justPressedKeys.has(p2.jump) ||
        (p2.jump === 'Numpad2' && this.justPressedKeys.has('Quote')) ||
        padJump,
      shoot:
        this.heldKeys.has(p2.shoot) ||
        (p2.shoot === 'Numpad3' && this.heldKeys.has('Slash')) ||
        padShoot,
      swap:
        this.justPressedKeys.has(p2.swap) ||
        (p2.swap === 'Numpad4' && this.justPressedKeys.has('Period')) ||
        padSwap,
    };
  }

  private updatePlayer(p: SimPlayer, dt: number): void {
    if (!p.alive) return;
    const hero = HERO_MAP[p.heroId];
    const ctrl = this.getPlayerControls(p.slot);

    p.animTime += dt;
    if (p.shootCd > 0) p.shootCd -= dt;
    if (p.meleeCd > 0) p.meleeCd -= dt;
    if (p.boostCd > 0) p.boostCd -= dt;
    if (p.meleeTimer > 0) p.meleeTimer -= dt;
    if (p.shootTimer > 0) p.shootTimer -= dt;
    if (p.hurtTimer > 0) p.hurtTimer -= dt;
    if (p.invulnTimer > 0) p.invulnTimer -= dt;

    const keyDx = (ctrl.right ? 1 : 0) - (ctrl.left ? 1 : 0);
    const keyDy = (ctrl.down ? 1 : 0) - (ctrl.up ? 1 : 0);
    const useAnalog = Math.hypot(ctrl.analogX, ctrl.analogY) > 0.22;
    const dx = useAnalog ? ctrl.analogX : keyDx;
    const dy = useAnalog ? ctrl.analogY : keyDy;

    // Deliberate classic 16-bit pacing (~28% slower so stages aren't sprinted through)
    const baseSpeed = 62 + hero.stats.speed * 12;
    const isHighway = this.level.mode === 'highway';
    const isFlight = this.level.mode === 'flight';
    const len = Math.hypot(dx, dy);
    if (len > 0) {
      const nx = dx / len;
      const ny = dy / len;
      const throttle = useAnalog ? Math.min(1, len) : 1;
      p.vx = nx * baseSpeed * throttle * (isFlight ? 1.18 : isHighway ? 1.15 : 1);
      p.vy = ny * baseSpeed * throttle * (isFlight ? 1.04 : 0.72);
      p.moving = true;

      if (isHighway) {
        // Harley always faces forward (right) while rider aims freely in all 8 directions (including backwards)!
        p.facing = 1;
        const aimAngle = Math.round(Math.atan2(ny, nx) / (Math.PI / 4)) * (Math.PI / 4);
        p.aimX = Math.cos(aimAngle);
        p.aimY = Math.sin(aimAngle);
        if (dx > 0.16 && this.harleyRevCd <= 0) {
          this.harleyRevCd = 0.16;
          soundEngine.playHarleyThrottle(true);
          this.queueSfx('harley', true);
          this.spawnParticles(p.x - 24, p.y - 2, p.z + 6, '#CBD5E1', 1, 40);
        }
      } else {
        // Both ground combat & unmanned quadcopter flight turn cleanly left/right so firing forward AND backward works effortlessly!
        if (Math.abs(dx) > 0.14) p.facing = dx > 0 ? 1 : -1;
        // Snap aim cleanly to 8 arcade directions for reliable run 'n' gun feel
        const snapAngle = Math.round(Math.atan2(ny, nx) / (Math.PI / 4)) * (Math.PI / 4);
        p.aimX = Math.cos(snapAngle);
        p.aimY = Math.sin(snapAngle);
      }
    } else {
      p.vx = 0;
      p.vy = 0;
      p.moving = false;
      if (isHighway) p.facing = 1;
      p.aimX = p.facing;
      p.aimY = 0;
    }

    p.x += p.vx * dt;
    p.y += p.vy * dt;

    // Jump (disabled in flight mode — quadcopter flies freely in 2D without jumping)
    if (isFlight) {
      p.z = 0;
      p.vz = 0;
    } else {
      if (ctrl.jump && p.z <= 0.1) {
        p.vz = p.heroId === 'vano' ? 245 : 215;
        soundEngine.playJump();
        this.queueSfx('jump');
        this.spawnParticles(p.x, p.y, 0, '#94A3B8', 5, 45);
      }
      if (p.z > 0 || p.vz > 0) {
        p.z += p.vz * dt;
        p.vz -= 640 * dt;
        if (p.z <= 0) {
          p.z = 0;
          p.vz = 0;
        }
      }
    }

    // Pickup / Swap weapon (disabled in unmanned quadcopter flight stage)
    if (ctrl.swap && !isFlight) {
      const nearbyIdx = this.pickups.findIndex(
        (pk) => pk.kind === 'weapon' && Math.hypot(pk.x - p.x, pk.y - p.y) < 36
      );
      if (nearbyIdx >= 0) {
        const pk = this.pickups.splice(nearbyIdx, 1)[0];
        if (pk.weaponId) {
          const oldPrimary = p.weaponId;
          if (p.secondaryWeaponId && p.secondaryWeaponId !== pk.weaponId) {
            this.pickups.push({
              id: this.nextEntityId++,
              kind: 'weapon',
              x: p.x,
              y: p.y + 4,
              weaponId: p.secondaryWeaponId,
              timer: 25,
            });
          }
          p.secondaryWeaponId = oldPrimary !== pk.weaponId ? oldPrimary : p.secondaryWeaponId;
          p.weaponId = pk.weaponId;
          const wDef = WEAPON_MAP[pk.weaponId];
          const isNative = pk.weaponId === hero.nativeWeaponId;
          soundEngine.playPickupWeapon();
          this.addFloatingText(
            p.x,
            p.y - 42,
            isNative ? `${wDef.shortTag} +10%!` : wDef.shortTag,
            isNative ? '#39FF14' : '#00E5FF'
          );
        }
      } else if (p.secondaryWeaponId) {
        const tmp = p.weaponId;
        p.weaponId = p.secondaryWeaponId;
        p.secondaryWeaponId = tmp;
        soundEngine.playPickupWeapon();
        this.addFloatingText(p.x, p.y - 42, WEAPON_MAP[p.weaponId].shortTag, '#FFB000');
      }
    }

    // Melee Attack (or Heavy Micro-Rocket Burst on Unmanned Quadcopter!)
    if (ctrl.melee && p.meleeCd <= 0) {
      if (isFlight) {
        p.meleeCd = 0.56;
        p.meleeTimer = 0.18;
        const baseAngle = Math.atan2(p.aimY, p.aimX);
        const rocketDmg = Math.round(40 * (0.92 + hero.stats.damage * 0.04));
        this.projectiles.push({
          x: p.x + Math.cos(baseAngle) * 18,
          y: p.y + Math.sin(baseAngle) * 8 + 3,
          z: 10,
          vx: Math.cos(baseAngle) * 395,
          vy: Math.sin(baseAngle) * 395,
          damage: rocketDmg,
          distLeft: 430,
          fromPlayer: true,
          ownerSlot: p.slot,
          weaponId: 'rc_launcher',
          pierce: false,
          hitIds: new Set(),
          explosiveRadius: 52,
          burnDuration: 0,
          stunDuration: 0.16,
          hacksTech: false,
          smokeCloud: false,
          color: '#F97316',
          glowColor: '#FEF08A',
          radius: 4.8,
        });
        soundEngine.playWeaponSfx('rc_launcher', true, 0);
        this.queueSfx('weapon', 'rc_launcher', true, 0);
        this.spawnParticles(p.x + Math.cos(baseAngle) * 16, p.y + 3, 12, '#FEF08A', 5, 70);
      } else {
        const isHeavyMelee = p.heroId === 'zavod_killer' || p.heroId === 'sandro';
        p.meleeCd = isHeavyMelee ? 0.34 : 0.28;
        p.meleeTimer = 0.16;
        soundEngine.playMelee(isHeavyMelee);
        this.queueSfx('melee', isHeavyMelee);
        const meleeDmg = (p.heroId === 'zavod_killer' ? 36 : p.heroId === 'sandro' ? 28 : 22) + hero.stats.damage * 2;
        const reach = p.heroId === 'zavod_killer' ? 52 : 44;

        const strikeDir = isHighway && p.aimX < -0.2 ? -1 : p.facing;
        const snapshot = [...this.enemies];
        for (const e of snapshot) {
          if (e.hacked || e.dead || (e.dropping && e.z > 36)) continue;
          const relX = (e.x - p.x) * strikeDir;
          const relY = Math.abs(e.y - p.y);
          if (relX > -14 && relX < reach + (e.isBoss ? 18 : 0) && relY < 28) {
            this.damageEnemy(e, meleeDmg, p.slot, true, strikeDir * (isHeavyMelee ? 92 : 54), 0.18, 0, false);
          }
        }

        if (this.friendlyFire) {
          this.players.forEach((other) => {
            if (other.slot === p.slot || !other.alive) return;
            const relX = (other.x - p.x) * strikeDir;
            if (relX > -4 && relX < reach - 4 && Math.abs(other.y - p.y) < 22 && Math.abs(other.z - p.z) < 24) {
              this.damagePlayer(other, 1, 'ОГОНЬ ПО СВОИМ!');
            }
          });
        }
      }
    }

    // Shooting
    const weapon = WEAPON_MAP[p.weaponId];
    const isNative = p.weaponId === hero.nativeWeaponId;
    if (ctrl.shoot) {
      if (isFlight) {
        // Unmanned Combat Quadcopter Twin Gimbal Plasma Autocannon (consistent high DPS forwards & backwards!)
        p.rampLevel = Math.min(1, p.rampLevel + dt * 0.5);
        if (p.shootCd <= 0) {
          const rateFactor = 0.92 + hero.stats.fireRate * 0.04;
          p.shootCd = 0.145 / rateFactor;
          p.shootTimer = 0.1;

          const baseAngle = Math.atan2(p.aimY, p.aimX);
          const cosA = Math.cos(baseAngle);
          const sinA = Math.sin(baseAngle);
          const perpX = -sinA;
          const perpY = cosA;
          const shellDmg = Math.round(11 * (0.92 + hero.stats.damage * 0.04));

          // Twin parallel high-velocity plasma rounds along exact aim vector (forward, backward, or diagonal!)
          for (const barrelOff of [-3.5, 3.5]) {
            this.projectiles.push({
              x: p.x + cosA * 18 + perpX * barrelOff,
              y: p.y + sinA * 10 + perpY * barrelOff + 2,
              z: 10,
              vx: cosA * 545,
              vy: sinA * 545,
              damage: shellDmg,
              distLeft: 445,
              fromPlayer: true,
              ownerSlot: p.slot,
              weaponId: 'spinning',
              pierce: false,
              hitIds: new Set(),
              explosiveRadius: 0,
              burnDuration: 0,
              stunDuration: 0,
              hacksTech: p.heroId === 'bo',
              smokeCloud: false,
              color: p.slot === 2 ? '#39FF14' : '#38BDF8',
              glowColor: '#E0F2FE',
              radius: 3.3,
            });
          }

          soundEngine.playWeaponSfx('spinning', true, p.rampLevel * 0.4);
          this.queueSfx('weapon', 'spinning', true, p.rampLevel * 0.4);
          this.spawnParticles(p.x + cosA * 20, p.y + sinA * 10 + 2, 12, '#38BDF8', 2, 65);
        }
      } else {
        if (weapon.rampsUp || p.heroId === 'hooper') {
          p.rampLevel = Math.min(1, p.rampLevel + dt * (p.heroId === 'hooper' ? 0.9 : 0.55));
        } else {
          p.rampLevel = Math.max(0, p.rampLevel - dt * 1.5);
        }

        if (p.shootCd <= 0) {
          const nativeMult = isNative ? 1.1 : 1.0;
          const heroRateFactor = 0.85 + hero.stats.fireRate * 0.06;
          const rampFactor = 1 + p.rampLevel * 0.85;
          p.shootCd = weapon.cooldown / (nativeMult * heroRateFactor * rampFactor);
          p.shootTimer = 0.11;

          const baseAngle = Math.atan2(p.aimY, p.aimX);
          const dmg = Math.round(weapon.damage * (0.86 + hero.stats.damage * 0.06) * nativeMult);
          const blastRadius =
            weapon.explosiveRadius > 0 && p.heroId === 'koren'
              ? weapon.explosiveRadius + 18
              : weapon.explosiveRadius;

          for (let i = 0; i < weapon.pellets; i++) {
            const offset =
              weapon.pellets === 1
                ? (Math.random() - 0.5) * weapon.spread
                : ((i / (weapon.pellets - 1)) - 0.5) * weapon.spread + (Math.random() - 0.5) * 0.05;
            const ang = baseAngle + offset;
            this.projectiles.push({
              x: p.x + Math.cos(baseAngle) * 18,
              y: p.y + Math.sin(baseAngle) * 6,
              z: p.z + 22,
              vx: Math.cos(ang) * weapon.speed,
              vy: Math.sin(ang) * weapon.speed * 0.72,
              damage: dmg,
              distLeft: weapon.range * (p.heroId === 'koren' ? 1.12 : 1),
              fromPlayer: true,
              ownerSlot: p.slot,
              weaponId: weapon.id,
              pierce: weapon.pierce,
              hitIds: new Set(),
              explosiveRadius: blastRadius,
              burnDuration: weapon.burnDuration,
              stunDuration: weapon.stunDuration,
              hacksTech: weapon.hacksTech || p.heroId === 'bo',
              smokeCloud: weapon.smokeCloud,
              color: weapon.color,
              glowColor: weapon.glowColor,
              radius: weapon.id === 'bass_beam' ? 6 : weapon.id === 'rc_launcher' || weapon.id === 'dymok' ? 5 : 3.5,
            });
          }

          soundEngine.playWeaponSfx(weapon.id, isNative, p.rampLevel);
          this.queueSfx('weapon', weapon.id, isNative, p.rampLevel);
          // Ejected brass shell + muzzle spark!
          this.spawnParticles(p.x + Math.cos(baseAngle) * 20, p.y, p.z + 22, weapon.glowColor, 3, 60);
          this.spawnParticles(p.x - p.facing * 4, p.y, p.z + 24, '#FACC15', 1, 55);
        }
      }
    } else {
      p.rampLevel = Math.max(0, p.rampLevel - dt * 1.8);
    }
  }

  private spawnEnemy(kind: EnemyKind, x: number, y: number, dropFromTop = false): void {
    const isBoss = kind.startsWith('boss_');
    // 2P Co-Op dynamic toughness scaling: mobs x1.45, bosses x1.55
    const coopScale = this.players.length === 2 ? (isBoss ? 1.55 : 1.45) : 1.0;

    const presets: Record<
      EnemyKind,
      { hp: number; speed: number; score: number; shielded?: boolean; phases?: number }
    > = {
      drunk: { hp: 42, speed: 33, score: 150 },
      buffalo: { hp: 82, speed: 39, score: 260 },
      acid_punk: { hp: 62, speed: 64, score: 265 },
      guard_gunner: { hp: 58, speed: 44, score: 240 },
      guard_shield: { hp: 96, speed: 32, score: 320, shielded: true },
      turret: { hp: 75, speed: 0, score: 280 },
      drone: { hp: 48, speed: 60, score: 250 },
      mini_heli: { hp: 46, speed: 70, score: 260 },
      heavy_heli: { hp: 96, speed: 48, score: 420 },
      biker: { hp: 64, speed: 74, score: 300 },
      beer_truck: { hp: 145, speed: 48, score: 480 },
      elite: { hp: 108, speed: 63, score: 420 },
      boss_drunk: { hp: 910, speed: 50, score: 2800, phases: 2 },
      boss_buffalo: { hp: 1120, speed: 48, score: 3600, phases: 2 },
      boss_electrician: { hp: 1205, speed: 62, score: 4100, phases: 3 },
      boss_substation: { hp: 320, speed: 0, score: 2500, phases: 1 },
      boss_chief: { hp: 1350, speed: 55, score: 4500, shielded: true, phases: 3 },
      boss_caravan: { hp: 1585, speed: 64, score: 5600, phases: 3 },
      boss_elevator: { hp: 1715, speed: 58, score: 6500, phases: 3 },
      boss_director: { hp: 2185, speed: 68, score: 9000, phases: 3 },
    };

    const cfg = presets[kind];
    // Dynamic enemy HP escalation along the mega-level + difficulty tier
    const progress = this.level ? Math.min(1, this.activeZoneIndex / Math.max(1, this.level.zones.length)) : 0;
    const progressHpMult = isBoss ? 1.0 : 1 + progress * 0.45;
    const diffHpMult =
      this.difficulty === 'hard'
        ? isBoss
          ? 1.32
          : 1.24
        : this.difficulty === 'normal'
          ? isBoss
            ? 1.15
            : 1.1
          : 1.0;
    const maxHp = Math.round(cfg.hp * coopScale * progressHpMult * diffHpMult);

    const isFlight = this.level?.mode === 'flight';
    const startZ = dropFromTop
      ? (isBoss ? 235 : 205 + Math.random() * 35)
      : kind === 'drone' && !isFlight
        ? 20
        : 0;

    const clampedY =
      kind === 'boss_electrician'
        ? FLIGHT_ROOF_Y
        : kind === 'boss_substation'
          ? 184
          : isFlight
            ? Math.max(FLIGHT_MIN_Y + 8, Math.min(FLIGHT_MAX_Y - 12, y))
            : Math.max(FLOOR_MIN_Y + 8, Math.min(FLOOR_MAX_Y - 4, y));

    this.enemies.push({
      id: this.nextEntityId++,
      kind,
      x,
      y: clampedY,
      z: startZ,
      vx: 0,
      vy: 0,
      vz: dropFromTop ? -45 : 0,
      dashTimer: 0,
      dashVx: 0,
      dashVy: 0,
      facing: -1,
      hp: maxHp,
      maxHp,
      speed: cfg.speed,
      attackCd: dropFromTop ? 1.2 : 1.0 + Math.random() * 0.8,
      telegraphTimer: 0,
      pendingAttack: 'none',
      hurtTimer: 0,
      stunTimer: 0,
      burnTimer: 0,
      burnTick: 0,
      hacked: false,
      dead: false,
      animTime: Math.random() * 5,
      phase: 1,
      maxPhases: cfg.phases ?? 1,
      isBoss,
      scoreValue: cfg.score,
      shielded: Boolean(cfg.shielded),
      dropping: dropFromTop,
      bouncePause: kind === 'boss_electrician' ? 0.35 : 0,
    });
  }

  private updateEnemies(dt: number): void {
    const alivePlayers = this.players.filter((p) => p.alive);
    const snapshot = [...this.enemies];

    for (const e of snapshot) {
      if (e.dead || e.hp <= 0 || this.bossDefeated) continue;
      e.animTime += dt;
      if (e.hurtTimer > 0) e.hurtTimer -= dt;
      if (e.stunTimer > 0) e.stunTimer -= dt;

      // Vertical ceiling-drop physics (Level 5 Elevator & top-drop summons!)
      if (e.dropping) {
        e.vz -= 560 * dt;
        e.z += e.vz * dt;
        const floorZ = e.kind === 'drone' ? 20 : 0;
        if (e.z <= floorZ) {
          e.z = floorZ;
          e.vz = 0;
          e.dropping = false;
          this.spawnParticles(e.x, e.y, 4, e.isBoss ? '#FACC15' : '#94A3B8', e.isBoss ? 22 : 8, e.isBoss ? 120 : 65);
          soundEngine.playMelee(e.isBoss);
          this.queueSfx('melee', e.isBoss);
          if (e.isBoss) {
            this.triggerShake(7, 0.32);
            // Shockwave knocks nearby grounded players slightly
            for (const pl of alivePlayers) {
              if (pl.z < 18 && Math.hypot(pl.x - e.x, pl.y - e.y) < 58) {
                this.damagePlayer(pl, 1, 'УДАРНАЯ ВОЛНА!');
              }
            }
          }
        }
        continue;
      }

      // Burn DoT
      if (e.burnTimer > 0) {
        e.burnTimer -= dt;
        e.burnTick -= dt;
        if (e.burnTick <= 0) {
          e.burnTick = 0.45;
          this.damageEnemy(e, 7, 1, false, 0, 0, 0, false);
          if (e.dead || e.hp <= 0 || this.bossDefeated) continue;
        }
      }

      if (e.stunTimer > 0) continue;

      // Smooth Dash / Lunge Movement (Bosses & Acid Punks!)
      if (e.dashTimer > 0) {
        e.dashTimer -= dt;
        e.x += e.dashVx * dt;
        e.y += e.dashVy * dt;
        e.x = Math.max(this.camX + 24, Math.min(this.camX + VIRTUAL_W - 24, e.x));
        e.y = Math.max(FLOOR_MIN_Y + 8, Math.min(FLOOR_MAX_Y - 4, e.y));
        this.spawnParticles(e.x, e.y, 14, e.kind === 'acid_punk' ? '#39FF14' : '#FF2A85', 1, 35);
        for (const pl of alivePlayers) {
          if (pl.z < 24 && Math.hypot(pl.x - e.x, pl.y - e.y) < (e.isBoss ? 38 : 26)) {
            this.damagePlayer(pl, e.isBoss ? 2 : 1);
          }
        }
        continue;
      }

      const inSmoke = this.zones.some(
        (z) => z.kind === 'smoke' && Math.hypot(z.x - e.x, z.y - e.y) < z.radius
      );
      const slowMult = inSmoke ? 0.52 : 1.0;

      // Hacked turret/drone fires at enemies
      if (e.hacked) {
        const hostile = this.enemies.find((other) => !other.hacked && !other.dead && other.hp > 0);
        if (hostile) {
          e.facing = hostile.x >= e.x ? 1 : -1;
          e.attackCd -= dt;
          if (e.attackCd <= 0) {
            e.attackCd = 0.65;
            const ang = Math.atan2(hostile.y - e.y, hostile.x - e.x);
            this.projectiles.push({
              x: e.x + e.facing * 12,
              y: e.y,
              z: e.kind === 'drone' ? 28 : 16,
              vx: Math.cos(ang) * 320,
              vy: Math.sin(ang) * 230,
              damage: 16,
              distLeft: 360,
              fromPlayer: true,
              ownerSlot: 1,
              pierce: false,
              hitIds: new Set(),
              explosiveRadius: 0,
              burnDuration: 0,
              stunDuration: 0.15,
              hacksTech: false,
              smokeCloud: false,
              color: '#00E5FF',
              glowColor: '#A5F3FC',
              radius: 4,
            });
          }
        }
        continue;
      }

      if (alivePlayers.length === 0) continue;

      let target = alivePlayers[0];
      let bestDist = Math.hypot(target.x - e.x, target.y - e.y);
      for (const pl of alivePlayers) {
        const d = Math.hypot(pl.x - e.x, pl.y - e.y);
        if (d < bestDist) {
          bestDist = d;
          target = pl;
        }
      }

      // Stationary destructible power substation — pulses ambient high-voltage arcs until blown up!
      if (e.kind === 'boss_substation') {
        if (Math.random() < dt * 7) {
          this.spawnParticles(
            e.x + (Math.random() - 0.5) * 34,
            e.y - 24 + (Math.random() - 0.5) * 44,
            14,
            Math.random() < 0.5 ? '#38BDF8' : '#FEF08A',
            2,
            65
          );
        }
        continue;
      }

      // Crazy Electrician Boss: spring-loaded boots bouncing high off the rooftop!
      if (e.kind === 'boss_electrician') {
        const ratio = e.hp / e.maxHp;
        const desiredPhase = ratio < 0.36 ? 3 : ratio < 0.7 ? 2 : 1;
        if (desiredPhase > e.phase) {
          e.phase = desiredPhase;
          this.triggerShake(6, 0.35);
          soundEngine.playBossWarn();
          this.showAnnouncement(`${this.level.bossName} · ФАЗА ${e.phase}!`, 1.8);
          this.spawnParticles(e.x, e.y, 18, '#38BDF8', 24, 145);
        }

        e.facing = target.x >= e.x ? 1 : -1;

        if (e.y >= FLIGHT_ROOF_Y && e.vy >= 0) {
          e.y = FLIGHT_ROOF_Y;
          e.vx = 0;
          e.bouncePause -= dt;
          if (e.bouncePause <= 0) {
            // BOING! Launch high off the roof on coil springs!
            e.vy = -(285 + Math.random() * 68 + (e.phase - 1) * 22);
            const arenaMinX = this.camX + 78;
            const arenaMaxX = this.camX + VIRTUAL_W - 86;
            const aimSpotX = Math.max(
              arenaMinX,
              Math.min(arenaMaxX, target.x + (Math.random() < 0.5 ? 72 : -58))
            );
            e.vx = Math.max(-125, Math.min(125, (aimSpotX - e.x) * 1.08));
            soundEngine.playJump();
            this.queueSfx('jump');
            this.spawnParticles(e.x, FLIGHT_ROOF_Y, 6, '#38BDF8', 8, 80);
            this.spawnParticles(e.x, FLIGHT_ROOF_Y, 4, '#FEF08A', 6, 70);
          }
        } else {
          e.x += e.vx * slowMult * dt;
          e.y += e.vy * dt;
          e.vy += 385 * dt;
          if (e.x < this.camX + 68) {
            e.x = this.camX + 68;
            e.vx = Math.abs(e.vx);
          } else if (e.x > this.camX + VIRTUAL_W - 82) {
            e.x = this.camX + VIRTUAL_W - 82;
            e.vx = -Math.abs(e.vx);
          }
          if (e.y < FLIGHT_MIN_Y + 14) {
            e.y = FLIGHT_MIN_Y + 14;
            e.vy = Math.abs(e.vy) * 0.35;
          }
          if (e.y >= FLIGHT_ROOF_Y) {
            e.y = FLIGHT_ROOF_Y;
            e.vy = 0;
            e.vx = 0;
            e.bouncePause = Math.max(0.3, 0.46 - (e.phase - 1) * 0.06);
            this.spawnParticles(e.x, FLIGHT_ROOF_Y, 4, '#FEF08A', 7, 65);
            this.triggerShake(2.2, 0.1);
          }
        }

        // Electric contact shock if a flying player crashes directly into him
        for (const pl of alivePlayers) {
          if (Math.hypot(pl.x - e.x, pl.y - (e.y - 16)) < 24) {
            this.damagePlayer(pl, 1, 'ТОК!');
          }
        }

        if (e.telegraphTimer > 0) {
          e.telegraphTimer -= dt;
          if (e.telegraphTimer <= 0) {
            this.executeEnemyAttack(e, target);
            e.pendingAttack = 'none';
          }
        } else {
          e.attackCd -= dt;
          if (e.attackCd <= 0) {
            this.chooseEnemyTelegraph(e, target, bestDist);
          }
        }
        continue;
      }

      // Boss phase transitions
      if (e.isBoss && e.maxPhases > 1) {
        const ratio = e.hp / e.maxHp;
        const desiredPhase =
          e.maxPhases === 3 ? (ratio < 0.36 ? 3 : ratio < 0.7 ? 2 : 1) : ratio < 0.52 ? 2 : 1;
        if (desiredPhase > e.phase) {
          e.phase = desiredPhase;
          this.triggerShake(6, 0.35);
          soundEngine.playBossWarn();
          this.showAnnouncement(`${this.level.bossName} · ФАЗА ${e.phase}!`, 1.8);
          this.spawnParticles(e.x, e.y, 26, '#FF2A85', 22, 130);
        }
      }

      if (e.telegraphTimer > 0) {
        e.telegraphTimer -= dt;
        if (e.telegraphTimer <= 0) {
          this.executeEnemyAttack(e, target);
          e.pendingAttack = 'none';
        }
        continue;
      }

      const dx = target.x - e.x;
      const dy = target.y - e.y;
      if (e.kind !== 'boss_caravan' && e.kind !== 'beer_truck') {
        e.facing = dx >= 0 ? 1 : -1;
      } else {
        e.facing = -1;
      }

      const isFlight = this.level.mode === 'flight';
      if (e.kind === 'turret') {
        // Stationary
      } else if (e.kind === 'mini_heli') {
        const orbitX =
          e.id % 3 === 0
            ? this.camX + VIRTUAL_W - 88 - Math.sin(e.animTime * 1.4 + e.id) * 44
            : target.x + (e.id % 2 === 0 ? 128 : -118);
        const clampedOrbitX = Math.max(this.camX + 46, Math.min(this.camX + VIRTUAL_W - 36, orbitX));
        const mdx = clampedOrbitX - e.x;
        e.x += Math.sign(mdx) * Math.min(Math.abs(mdx), e.speed * slowMult * dt);
        const hoverY = target.y + Math.sin(e.animTime * 2.8 + e.id) * 34;
        const mdy = hoverY - e.y;
        e.y += Math.sign(mdy) * Math.min(Math.abs(mdy), e.speed * 0.78 * slowMult * dt);
      } else if (e.kind === 'heavy_heli') {
        const hoverX = this.camX + VIRTUAL_W - 74 - (e.id % 3) * 28;
        const mdx = hoverX - e.x;
        e.x += Math.sign(mdx) * Math.min(Math.abs(mdx), e.speed * slowMult * dt);
        const hoverY = target.y * 0.65 + (115 + Math.sin(e.animTime * 1.6 + e.id) * 42) * 0.35;
        const mdy = hoverY - e.y;
        e.y += Math.sign(mdy) * Math.min(Math.abs(mdy), e.speed * 0.72 * slowMult * dt);
      } else if (e.kind === 'boss_caravan' || e.kind === 'beer_truck') {
        const targetX = this.camX + VIRTUAL_W - (e.kind === 'boss_caravan' ? 92 : 66);
        e.x += (targetX - e.x) * Math.min(1, dt * 2.5);
        const desiredY = FLOOR_MIN_Y + 35 + Math.sin(e.animTime * 1.4) * 38;
        e.y += (desiredY - e.y) * Math.min(1, dt * 2.2);
      } else if (e.kind === 'biker') {
        const desiredX = target.x + (e.id % 2 === 0 ? 120 : -110);
        const mdx = desiredX - e.x;
        e.x += Math.sign(mdx) * Math.min(Math.abs(mdx), e.speed * slowMult * dt);
        e.y += Math.sign(dy) * Math.min(Math.abs(dy), e.speed * 0.7 * slowMult * dt);
      } else if (e.kind === 'guard_gunner' || e.kind === 'drone' || e.kind === 'boss_director') {
        const desiredDist = e.kind === 'boss_director' ? 160 : e.kind === 'drone' ? 115 : 132;
        if (Math.abs(dx) < desiredDist - 24) {
          e.x -= Math.sign(dx || 1) * e.speed * 0.65 * slowMult * dt;
        } else if (Math.abs(dx) > desiredDist + 32) {
          e.x += Math.sign(dx) * e.speed * slowMult * dt;
        }
        e.y += Math.sign(dy) * Math.min(Math.abs(dy), e.speed * (isFlight ? 0.85 : 0.68) * slowMult * dt);
      } else {
        if (Math.abs(dx) > 28) {
          e.x += Math.sign(dx) * e.speed * slowMult * dt;
        }
        if (Math.abs(dy) > 8) {
          e.y += Math.sign(dy) * e.speed * 0.65 * slowMult * dt;
        }
      }

      e.x = Math.max(this.camX + 20, Math.min(this.camX + VIRTUAL_W - 20, e.x));
      if (isFlight) {
        e.y = Math.max(FLIGHT_MIN_Y + 8, Math.min(FLIGHT_MAX_Y - 10, e.y));
      } else {
        e.y = Math.max(FLOOR_MIN_Y + 6, Math.min(FLOOR_MAX_Y - 2, e.y));
      }

      e.attackCd -= dt;
      if (e.attackCd <= 0) {
        this.chooseEnemyTelegraph(e, target, bestDist);
      }
    }
  }

  private chooseEnemyTelegraph(e: SimEnemy, target: SimPlayer, dist: number): void {
    const diff = DIFFICULTY_MAP[this.difficulty];
    const cdMult = diff.fireCooldownMult;
    const tgMult = diff.telegraphMult;
    const phaseAccel = 1 - (e.phase - 1) * 0.16;

    if (e.kind === 'drunk') {
      if (dist < 44 && Math.abs(target.y - e.y) < 22) {
        e.pendingAttack = Math.random() < 0.3 ? 'vomit' : 'melee';
        e.telegraphTimer = 0.38 * tgMult;
        e.attackCd = 1.45 * cdMult;
      } else {
        e.attackCd = 0.4 * cdMult;
      }
    } else if (e.kind === 'acid_punk') {
      if (dist < 48 && Math.abs(target.y - e.y) < 22) {
        e.pendingAttack = Math.random() < 0.36 ? 'vomit' : 'melee';
        e.telegraphTimer = 0.3 * tgMult;
        e.attackCd = 1.15 * cdMult;
      } else if (dist < 135 && Math.random() < 0.55) {
        e.pendingAttack = 'charge';
        e.telegraphTimer = 0.36 * tgMult;
        e.attackCd = 1.7 * cdMult;
      } else {
        e.attackCd = 0.38 * cdMult;
      }
    } else if (e.kind === 'buffalo') {
      if (dist < 50 && Math.abs(target.y - e.y) < 24) {
        e.pendingAttack = 'melee';
        e.telegraphTimer = 0.42 * tgMult;
        e.attackCd = 1.5 * cdMult;
      } else if (dist < 235) {
        e.pendingAttack = 'crate';
        e.telegraphTimer = 0.5 * tgMult;
        e.attackCd = 2.3 * cdMult;
      } else {
        e.attackCd = 0.45 * cdMult;
      }
    } else if (e.kind === 'drone' || e.kind === 'mini_heli') {
      // Combat drones & small helicopters lock on visibly and fire crisp bursts!
      e.pendingAttack = 'shoot';
      e.telegraphTimer = 0.4 * tgMult;
      e.attackCd = (1.35 + Math.random() * 0.4) * cdMult;
    } else if (e.kind === 'heavy_heli') {
      e.pendingAttack = 'barrage';
      e.telegraphTimer = 0.46 * tgMult;
      e.attackCd = (1.85 + Math.random() * 0.35) * cdMult;
    } else if (e.kind === 'guard_gunner' || e.kind === 'turret' || e.kind === 'biker') {
      e.pendingAttack = 'shoot';
      e.telegraphTimer = 0.35 * tgMult;
      e.attackCd = ((e.kind === 'turret' ? 1.55 : 1.75) + Math.random() * 0.4) * cdMult;
    } else if (e.kind === 'guard_shield') {
      e.pendingAttack = dist < 50 ? 'melee' : 'shoot';
      e.telegraphTimer = 0.42 * tgMult;
      e.attackCd = 1.8 * cdMult;
    } else if (e.kind === 'beer_truck') {
      e.pendingAttack = 'crate';
      e.telegraphTimer = 0.45 * tgMult;
      e.attackCd = 2.0 * cdMult;
    } else if (e.kind === 'elite') {
      e.pendingAttack = dist < 54 ? 'melee' : 'barrage';
      e.telegraphTimer = 0.34 * tgMult;
      e.attackCd = 1.35 * cdMult;
    } else if (e.kind === 'boss_drunk') {
      const r = Math.random();
      e.pendingAttack = r < 0.42 ? 'vomit' : r < 0.82 ? 'charge' : 'melee';
      e.telegraphTimer = 0.44 * phaseAccel * tgMult;
      e.attackCd = 1.38 * phaseAccel * cdMult;
    } else if (e.kind === 'boss_buffalo') {
      const r = Math.random();
      e.pendingAttack = r < 0.46 ? 'crate' : r < 0.78 ? 'charge' : 'summon';
      e.telegraphTimer = 0.46 * phaseAccel * tgMult;
      e.attackCd = 1.52 * phaseAccel * cdMult;
    } else if (e.kind === 'boss_electrician') {
      const r = Math.random();
      e.pendingAttack = r < 0.38 ? 'barrage' : r < 0.66 ? 'shoot' : r < 0.84 ? 'beam' : 'summon';
      e.telegraphTimer = 0.38 * phaseAccel * tgMult;
      e.attackCd = 1.28 * phaseAccel * cdMult;
    } else if (e.kind === 'boss_chief') {
      const r = Math.random();
      e.pendingAttack = r < 0.52 ? 'barrage' : r < 0.82 ? 'charge' : 'summon';
      e.telegraphTimer = 0.42 * phaseAccel * tgMult;
      e.attackCd = 1.32 * phaseAccel * cdMult;
    } else if (e.kind === 'boss_caravan') {
      const r = Math.random();
      e.pendingAttack = r < 0.48 ? 'barrage' : r < 0.82 ? 'crate' : 'summon';
      e.telegraphTimer = 0.43 * phaseAccel * tgMult;
      e.attackCd = 1.32 * phaseAccel * cdMult;
    } else if (e.kind === 'boss_elevator') {
      const r = Math.random();
      e.pendingAttack = r < 0.36 ? 'charge' : r < 0.72 ? 'barrage' : 'summon';
      e.telegraphTimer = 0.42 * phaseAccel * tgMult;
      e.attackCd = 1.28 * phaseAccel * cdMult;
    } else if (e.kind === 'boss_director') {
      const r = Math.random();
      if (e.phase >= 2 && r > 0.84) {
        e.pendingAttack = 'charge';
      } else {
        e.pendingAttack = r < 0.36 ? 'beam' : r < 0.72 ? 'barrage' : 'summon';
      }
      e.telegraphTimer = 0.41 * phaseAccel * tgMult;
      e.attackCd = 1.15 * phaseAccel * cdMult;
    }
  }

  private executeEnemyAttack(e: SimEnemy, target: SimPlayer): void {
    const diff = DIFFICULTY_MAP[this.difficulty];
    const projSpeed = diff.projectileSpeedMult;
    const ang = Math.atan2(target.y - e.y, target.x - e.x);

    switch (e.pendingAttack) {
      case 'melee': {
        soundEngine.playMelee(e.isBoss);
        const reach = e.isBoss ? 58 : 42;
        this.players.forEach((pl) => {
          if (!pl.alive || pl.z > 22) return;
          if (Math.hypot(pl.x - e.x, pl.y - e.y) < reach) {
            this.damagePlayer(pl, e.isBoss ? 2 : 1);
          }
        });
        break;
      }
      case 'charge': {
        // Smooth high-speed dash/lunge!
        const isPunk = e.kind === 'acid_punk';
        const isDirector = e.kind === 'boss_director';
        e.dashTimer = isPunk ? 0.22 : isDirector ? 0.38 : 0.36;
        const speedMult = isPunk ? 215 : isDirector ? 305 : 280;
        e.dashVx = Math.cos(ang) * speedMult * (0.92 + projSpeed * 0.14);
        e.dashVy = Math.sin(ang) * (isPunk ? 95 : 122) * (0.92 + projSpeed * 0.14);
        if (!isPunk) this.triggerShake(3.8, 0.2);
        soundEngine.playMelee(!isPunk);
        this.queueSfx('melee', !isPunk);
        break;
      }
      case 'vomit': {
        const puddleCount = e.isBoss && e.phase >= 2 ? 2 : 1;
        for (let pIdx = 0; pIdx < puddleCount; pIdx++) {
          const offsetX = pIdx === 0 ? e.facing * 44 : e.facing * 92;
          const offsetY = pIdx === 0 ? 0 : (target.y >= e.y ? 20 : -20);
          this.zones.push({
            kind: 'vomit',
            x: Math.max(this.camX + 24, Math.min(this.camX + VIRTUAL_W - 24, e.x + offsetX)),
            y: Math.max(FLOOR_MIN_Y + 12, Math.min(FLOOR_MAX_Y - 8, e.y + offsetY)),
            radius: e.isBoss ? 44 : 24,
            timer: 4.5,
            maxTimer: 4.5,
            tickCd: 0.14,
            fromPlayer: false,
          });
        }
        this.spawnParticles(e.x + e.facing * 26, e.y, 16, '#39FF14', 16, 85);
        break;
      }
      case 'crate': {
        const count = e.isBoss
          ? e.phase >= 2
            ? 3 + (diff.extraBossShots >= 2 ? 1 : 0)
            : 2
          : 1;
        for (let c = 0; c < count; c++) {
          const spread = (c - (count - 1) / 2) * 0.24;
          this.projectiles.push({
            x: e.x + e.facing * 18,
            y: e.y,
            z: 22,
            vx: Math.cos(ang + spread) * (e.isBoss ? 235 : 215) * projSpeed,
            vy: Math.sin(ang + spread) * (e.isBoss ? 160 : 145) * projSpeed,
            damage: e.isBoss ? 2 : 1,
            distLeft: 450,
            fromPlayer: false,
            pierce: false,
            hitIds: new Set(),
            explosiveRadius: 30,
            burnDuration: 0,
            stunDuration: 0,
            hacksTech: false,
            smokeCloud: false,
            color: '#39FF14',
            glowColor: '#A3E635',
            radius: 8,
            isEnemyBarrel: true,
          });
        }
        soundEngine.playMelee(true);
        this.queueSfx('melee', true);
        break;
      }
      case 'shoot': {
        const isFlight = this.level.mode === 'flight';
        const vyScale = isFlight ? 1.0 : 0.72;
        if (e.kind === 'boss_electrician') {
          // High-voltage twin/triple lightning orb burst straight from the bouncing electrician!
          const spreads = e.phase >= 2 ? [-0.16, 0, 0.16] : [-0.1, 0.1];
          for (const sp of spreads) {
            this.projectiles.push({
              x: e.x + e.facing * 14,
              y: e.y - 14,
              z: 14,
              vx: Math.cos(ang + sp) * 255 * projSpeed,
              vy: Math.sin(ang + sp) * 255 * projSpeed,
              damage: 1,
              distLeft: 460,
              fromPlayer: false,
              pierce: false,
              hitIds: new Set(),
              explosiveRadius: 0,
              burnDuration: 0,
              stunDuration: 0,
              hacksTech: false,
              smokeCloud: false,
              color: '#38BDF8',
              glowColor: '#FEF08A',
              radius: 5,
            });
          }
          this.spawnParticles(e.x + e.facing * 14, e.y - 14, 16, '#38BDF8', 8, 95);
          soundEngine.playWeaponSfx('firewall', false);
          this.queueSfx('weapon', 'firewall', false, 0);
        } else if (e.kind === 'drone' || e.kind === 'mini_heli') {
          // Helicopter/drone fires a crisp twin-bolt plasma burst!
          const spreads = this.level.id === 7 ? [-0.11, 0.11] : [-0.07, 0.07];
          const boltSpeed = e.kind === 'mini_heli' ? 235 : 245;
          for (const sp of spreads) {
            this.projectiles.push({
              x: e.x + e.facing * 12,
              y: e.y,
              z: isFlight ? 14 : 30,
              vx: Math.cos(ang + sp) * boltSpeed * projSpeed,
              vy: Math.sin(ang + sp) * boltSpeed * vyScale * projSpeed,
              damage: 1,
              distLeft: 430,
              fromPlayer: false,
              pierce: false,
              hitIds: new Set(),
              explosiveRadius: 0,
              burnDuration: 0,
              stunDuration: 0,
              hacksTech: false,
              smokeCloud: false,
              color: e.kind === 'mini_heli' ? '#FACC15' : '#FF2A85',
              glowColor: '#FEF08A',
              radius: 4.2,
            });
          }
          this.spawnParticles(e.x + e.facing * 14, e.y, isFlight ? 14 : 32, '#FF2A85', 5, 70);
          soundEngine.playWeaponSfx('firewall', false);
          this.queueSfx('weapon', 'firewall', false, 0);
        } else {
          this.projectiles.push({
            x: e.x + e.facing * 14,
            y: e.y,
            z: isFlight ? 14 : 20,
            vx: Math.cos(ang) * 230 * projSpeed,
            vy: Math.sin(ang) * 230 * vyScale * projSpeed,
            damage: 1,
            distLeft: 400,
            fromPlayer: false,
            pierce: false,
            hitIds: new Set(),
            explosiveRadius: 0,
            burnDuration: 0,
            stunDuration: 0,
            hacksTech: false,
            smokeCloud: false,
            color: '#39FF14',
            glowColor: '#FEF08A',
            radius: 4,
          });
          soundEngine.playWeaponSfx('spinning', false);
          this.queueSfx('weapon', 'spinning', false, 0);
        }
        break;
      }
      case 'barrage': {
        const isFlight = this.level.mode === 'flight';
        const isDirector = e.kind === 'boss_director';
        const isElectrician = e.kind === 'boss_electrician';
        const shots = isDirector
          ? 5 + e.phase + diff.extraBossShots
          : e.isBoss
            ? 4 + e.phase + diff.extraBossShots
            : 3 + (diff.extraBossShots >= 2 ? 1 : 0);
        const fanArc = isDirector ? 0.92 : isElectrician ? 0.84 : 0.76;
        const speedX = isDirector ? 268 : e.isBoss ? 252 : 230;
        const speedY = isFlight ? speedX : isDirector ? 195 : e.isBoss ? 185 : 175;
        for (let s = 0; s < shots; s++) {
          const offset = ((s / (shots - 1)) - 0.5) * fanArc;
          this.projectiles.push({
            x: e.x + e.facing * 16,
            y: isElectrician ? e.y - 14 : e.y,
            z: isFlight ? 14 : 24,
            vx: Math.cos(ang + offset) * speedX * projSpeed,
            vy: Math.sin(ang + offset) * speedY * projSpeed,
            damage: 1,
            distLeft: 460,
            fromPlayer: false,
            pierce: false,
            hitIds: new Set(),
            explosiveRadius: 0,
            burnDuration: 0,
            stunDuration: 0,
            hacksTech: false,
            smokeCloud: false,
            color: isElectrician
              ? '#38BDF8'
              : isDirector
                ? '#39FF14'
                : e.kind === 'boss_elevator' || e.kind === 'heavy_heli'
                  ? '#FACC15'
                  : '#FF2A85',
            glowColor: isElectrician ? '#E0F2FE' : '#FEF08A',
            radius: isDirector || isElectrician ? 5 : 4.5,
          });
        }
        soundEngine.playWeaponSfx('firewall', false);
        this.queueSfx('weapon', 'firewall', false, 0);
        break;
      }
      case 'beam': {
        const isFlight = this.level.mode === 'flight';
        // Director & Electrician scale beam pressure across phases!
        const beamCount =
          e.kind === 'boss_director' || e.kind === 'boss_electrician'
            ? Math.min(isFlight ? 2 : 3, e.phase)
            : 1;
        const offsets =
          beamCount === 1
            ? [[0, 0]]
            : beamCount === 2
              ? [
                  [0, 0],
                  [target.facing * 58, target.y > (FLOOR_MIN_Y + FLOOR_MAX_Y) * 0.5 ? -26 : 26],
                ]
              : [
                  [0, 0],
                  [-62, -24],
                  [62, 24],
                ];
        for (const [ox, oy] of offsets) {
          this.zones.push({
            kind: 'virus_beam',
            x: Math.max(this.camX + 34, Math.min(this.camX + VIRTUAL_W - 34, target.x + ox)),
            y: isFlight
              ? FLIGHT_ROOF_Y
              : Math.max(FLOOR_MIN_Y + 14, Math.min(FLOOR_MAX_Y - 10, target.y + oy)),
            radius: e.kind === 'boss_director' ? 46 : 38,
            timer: isFlight ? 1.45 : 1.75,
            maxTimer: isFlight ? 1.45 : 1.75,
            tickCd: 0.19 * Math.max(0.62, diff.fireCooldownMult),
            fromPlayer: false,
          });
        }
        this.triggerShake(5, 0.28);
        soundEngine.playWeaponSfx('bass_beam', false);
        this.queueSfx('weapon', 'bass_beam', false, 0);
        break;
      }
      case 'summon': {
        const effectiveCap = e.kind === 'boss_director' ? diff.bossSummonCap + 1 : diff.bossSummonCap;
        if (this.enemies.filter((x) => !x.dead).length < effectiveCap) {
          const dropTop = this.level.mode === 'elevator';
          const isFlight = this.level.mode === 'flight';
          const minionKind: EnemyKind =
            e.kind === 'boss_electrician'
              ? 'mini_heli'
              : e.kind === 'boss_buffalo'
                ? 'acid_punk'
                : e.kind === 'boss_chief'
                  ? 'guard_gunner'
                  : e.kind === 'boss_caravan'
                    ? 'biker'
                    : e.kind === 'boss_elevator'
                      ? (Math.random() < 0.65 ? 'acid_punk' : 'drone')
                      : e.kind === 'boss_director' && e.phase >= 2
                        ? 'elite'
                        : 'drone';
          const sx = dropTop ? 70 + Math.random() * (VIRTUAL_W - 140) : this.camX + VIRTUAL_W - 24;
          const sy = isFlight ? 76 + Math.random() * 105 : 172 + Math.random() * 68;
          this.spawnEnemy(minionKind, sx, sy, dropTop);
          const shouldSpawnPair =
            this.difficulty === 'hard' ||
            this.players.length === 2 ||
            (e.kind === 'boss_director' && e.phase >= 2);
          if (shouldSpawnPair && this.enemies.filter((x) => !x.dead).length < effectiveCap) {
            const secondKind: EnemyKind = e.kind === 'boss_director' ? 'drone' : minionKind;
            const sx2 = dropTop ? 70 + Math.random() * (VIRTUAL_W - 140) : this.camX + 24;
            const sy2 = isFlight ? 84 + Math.random() * 100 : 175 + Math.random() * 62;
            this.spawnEnemy(secondKind, sx2, sy2, dropTop);
          }
          this.addFloatingText(
            e.x,
            e.y - 62,
            dropTop ? 'ДЕСАНТ СВЕРХУ!' : isFlight ? 'ВЕРТОЛЁТЫ!' : 'ПОДМОГА!',
            isFlight ? '#38BDF8' : '#FF2A85'
          );
        }
        break;
      }
    }
  }

  private damageEnemy(
    e: SimEnemy,
    damage: number,
    attackerSlot: 1 | 2,
    isHeavy: boolean,
    knockbackX: number,
    stunDuration: number,
    burnDuration: number,
    hacksTech: boolean,
    piercing = false
  ): void {
    if (e.dead || e.hp <= 0) return;

    if (e.shielded && !piercing && e.stunTimer <= 0 && Math.sign(knockbackX) === -e.facing && !hacksTech) {
      damage = Math.max(2, Math.round(damage * 0.25));
      this.addFloatingText(e.x, e.y - 44, 'ЩИТ!', '#94A3B8');
      this.spawnParticles(e.x + e.facing * 10, e.y, 20, '#00E5FF', 4, 65);
    }

    if (hacksTech && (e.kind === 'turret' || e.kind === 'drone') && !e.hacked) {
      e.hacked = true;
      e.hp = Math.max(e.hp, Math.round(e.maxHp * 0.8));
      soundEngine.playHack();
      this.addFloatingText(e.x, e.y - 48, 'ВЗЛОМ!', '#00E5FF');
      this.spawnParticles(e.x, e.y, 20, '#00E5FF', 14, 95);
      const pl = this.players.find((p) => p.slot === attackerSlot);
      if (pl) {
        pl.hackCount += 1;
        pl.score += 300;
      }
      return;
    }

    e.hp -= damage;
    e.hurtTimer = 0.16;
    if (stunDuration > 0 && !e.isBoss) {
      e.stunTimer = Math.max(e.stunTimer, stunDuration);
    } else if (stunDuration > 0 && e.isBoss) {
      e.stunTimer = Math.max(e.stunTimer, stunDuration * 0.25);
    }
    if (burnDuration > 0) {
      e.burnTimer = Math.max(e.burnTimer, burnDuration);
    }
    if (!e.isBoss && e.kind !== 'turret' && e.kind !== 'beer_truck') {
      e.x += knockbackX * 0.16;
    }

    this.spawnParticles(
      e.x,
      e.y,
      20,
      e.kind === 'boss_substation' || e.kind === 'boss_electrician'
        ? '#38BDF8'
        : e.isBoss
          ? '#FF2A85'
          : '#39FF14',
      isHeavy ? 10 : 5,
      isHeavy ? 105 : 70
    );
    soundEngine.playHit(isHeavy);
    if (isHeavy) {
      this.hitstopTimer = 0.04;
      this.triggerShake(3.2, 0.12);
    }

    if (e.hp <= 0) {
      this.handleEnemyKilled(e, attackerSlot);
    }
  }

  private handleEnemyKilled(e: SimEnemy, attackerSlot: 1 | 2): void {
    if (e.dead) return;
    e.dead = true;
    e.hp = 0;

    this.enemiesDefeated += 1;
    const pl = this.players.find((p) => p.slot === attackerSlot) ?? this.players[0];
    if (pl) pl.score += e.scoreValue;

    this.spawnParticles(e.x, e.y, 20, '#39FF14', e.isBoss ? 36 : 14, e.isBoss ? 160 : 95);
    this.spawnParticles(e.x, e.y, 24, '#FFB000', e.isBoss ? 24 : 6, 125);
    this.addFloatingText(e.x, e.y - 38, `+${e.scoreValue}`, '#FACC15');

    if (e.isBoss) {
      // Stage 3 Post-Boss Objective: after Crazy Electrician falls, shoot the power substation until it explodes!
      if (e.kind === 'boss_electrician') {
        for (const other of this.enemies) {
          if (other.id !== e.id) other.dead = true;
        }
        for (const pr of this.projectiles) {
          if (!pr.fromPlayer) pr.dead = true;
        }
        this.pendingSpawns = [];
        this.zones = this.zones.filter((z) => z.fromPlayer);
        this.spawnParticles(e.x, e.y, 18, '#38BDF8', 32, 155);
        this.spawnParticles(e.x, e.y, 22, '#FEF08A', 22, 130);
        this.hitstopTimer = 0.065;
        this.triggerShake(7.5, 0.45);
        soundEngine.playExplosion();
        this.queueSfx('explosion');
        this.spawnEnemy('boss_substation', this.camX + VIRTUAL_W - 56, 184, false);
        this.showAnnouncement('ЭЛЕКТРИК ПОВЕРЖЕН! РАССТРЕЛЯЙ ПОДСТАНЦИЮ!', 3.6);
        this.emitHud();
        return;
      }

      this.bossDefeated = true;
      this.bossDeathX = e.x;
      this.bossDeathY = e.y;
      this.bossExplosionTick = 0.18;
      this.stageClearDelay = 2.2;
      this.hitstopTimer = 0.075;
      this.triggerShake(9, 0.65);
      soundEngine.playExplosion();
      soundEngine.playStageClear();
      this.queueSfx('explosion');
      this.queueSfx('stage_clear');
      this.showAnnouncement(
        e.kind === 'boss_substation'
          ? 'ПОДСТАНЦИЯ ВЗОРВАНА! ЗАБОР ОБЕСТОЧЕН!'
          : `${this.level.bossName} ПОВЕРЖЕН!`,
        2.4
      );
      // Defer array wipe until end of current phase so active loops NEVER crash!
      this.clearArenaPending = true;
      this.emitHud();
      return;
    }

    // Dynamic HP & Weapon Loot Director: boosts beer healing drops when players are wounded (and in 2P co-op)
    const alivePlayers = this.players.filter((p) => p.alive);
    const minHp = alivePlayers.length > 0 ? Math.min(...alivePlayers.map((p) => p.hpSegments)) : 3;
    const coopBeerBonus = this.players.length === 2 ? 0.06 : 0;
    const beerChance = (minHp <= 1 ? 0.34 : minHp === 2 ? 0.22 : 0.12) + coopBeerBonus;
    const weaponChance = this.level.mode === 'flight' ? 0 : 0.105;

    const roll = Math.random();
    if (roll < beerChance) {
      // Split HP pickups: 0.33L bottle (+1 HP) drops regularly; full frothy beer mug (Full HP) is rarer!
      const mugChance = minHp <= 1 ? 0.38 : 0.22;
      const dropKind: 'beer' | 'beer_bottle' = Math.random() < mugChance ? 'beer' : 'beer_bottle';
      this.pickups.push({
        id: this.nextEntityId++,
        kind: dropKind,
        x: e.x,
        y: e.y,
        timer: 20,
      });
    } else if (roll < beerChance + weaponChance) {
      const heldSet = new Set(alivePlayers.map((p) => p.weaponId));
      const freshPool = WEAPONS.filter((w) => !heldSet.has(w.id));
      const pool = freshPool.length > 0 ? freshPool : WEAPONS;
      const randomWeapon = pool[Math.floor(Math.random() * pool.length)].id;
      this.pickups.push({
        id: this.nextEntityId++,
        kind: 'weapon',
        x: e.x,
        y: e.y,
        weaponId: randomWeapon,
        timer: 22,
      });
    }
  }

  private damagePlayer(p: SimPlayer, hitPower: number, customLabel?: string): void {
    if (!p.alive || p.invulnTimer > 0) return;

    const inFriendlySmoke = this.zones.some(
      (z) => z.kind === 'smoke' && Math.hypot(z.x - p.x, z.y - p.y) < z.radius
    );
    if (inFriendlySmoke && !customLabel && Math.random() < 0.45) {
      this.addFloatingText(p.x, p.y - 44, 'ДЫМ-УКРЫТИЕ!', '#39FF14');
      p.invulnTimer = 0.45;
      return;
    }

    const hero = HERO_MAP[p.heroId];
    let remaining = hitPower;

    if (p.armorPips > 0 && remaining === 1) {
      p.armorPips -= 1;
      remaining = 0;
      this.addFloatingText(p.x, p.y - 44, 'БРОНЯ!', '#00E5FF');
    } else if (p.armorPips > 0 && remaining >= 2) {
      p.armorPips -= 1;
      remaining -= 1;
    }

    if (remaining > 0) {
      p.hpSegments = Math.max(0, p.hpSegments - remaining);
      this.addFloatingText(p.x, p.y - 44, customLabel ?? `-${remaining} HP`, '#FF2A85');
    }

    p.hurtTimer = 0.28;
    p.invulnTimer = 1.05 + hero.stats.hp * 0.12;
    this.hitstopTimer = 0.045;
    this.triggerShake(4.5, 0.22);
    this.spawnParticles(p.x, p.y, 20, '#FF2A85', 10, 90);

    if (p.hpSegments <= 0) {
      p.lives -= 1;
      soundEngine.playLifeLost();
      this.queueSfx('life_lost');
      if (p.lives > 0) {
        p.hpSegments = 3;
        p.armorPips = p.maxArmorPips;
        p.z = 85;
        p.vz = 0;
        p.invulnTimer = 2.6;
        this.addFloatingText(p.x, p.y - 50, `ЖИЗНЕЙ: ${p.lives}`, '#FFB000');
        this.enemies.forEach((en) => {
          if (!en.isBoss && !en.dead && Math.hypot(en.x - p.x, en.y - p.y) < 75) {
            en.x += Math.sign(en.x - p.x || 1) * 42;
            en.stunTimer = Math.max(en.stunTimer, 0.5);
          }
        });
      } else {
        p.alive = false;
        this.addFloatingText(p.x, p.y - 50, `${hero.name} ВЫБЫЛ!`, '#EF4444');
      }
    } else {
      soundEngine.playPlayerHurt();
      this.queueSfx('hurt');
    }

    this.emitHud();
  }

  private updateProjectiles(dt: number): void {
    const projSnapshot = [...this.projectiles];

    for (const pr of projSnapshot) {
      if (pr.dead || this.bossDefeated) continue;
      const stepX = pr.vx * dt;
      const stepY = pr.vy * dt;
      pr.x += stepX;
      pr.y += stepY;
      pr.distLeft -= Math.hypot(stepX, stepY);

      let remove = pr.distLeft <= 0 || pr.x < this.camX - 40 || pr.x > this.camX + VIRTUAL_W + 60;

      if (!remove && pr.fromPlayer) {
        const enemySnapshot = [...this.enemies];
        for (const e of enemySnapshot) {
          if (e.hacked || e.dead || (e.dropping && e.z > 75) || pr.hitIds.has(e.id)) continue;
          const { hitW, hitH, targetY } = this.getEnemyHitbox(e);
          if (Math.abs(pr.x - e.x) < hitW + pr.radius && Math.abs(pr.y - targetY) < hitH + pr.radius) {
            pr.hitIds.add(e.id);
            if (pr.explosiveRadius > 0 || pr.smokeCloud) {
              this.detonateProjectile(pr, e.id);
              remove = true;
              break;
            } else {
              this.damageEnemy(
                e,
                pr.damage,
                pr.ownerSlot ?? 1,
                pr.weaponId === 'bass_beam',
                Math.sign(pr.vx) * 35,
                pr.stunDuration,
                pr.burnDuration,
                pr.hacksTech,
                pr.pierce
              );
              if (!pr.pierce || this.bossDefeated) {
                remove = true;
                break;
              }
            }
          }
        }

        if (!remove && this.friendlyFire) {
          for (const pl of this.players) {
            if (!pl.alive || pl.slot === pr.ownerSlot) continue;
            if (Math.abs(pr.x - pl.x) < 12 + pr.radius && Math.abs(pr.y - pl.y) < 14 + pr.radius && Math.abs(pr.z - (pl.z + 20)) < 24) {
              this.damagePlayer(pl, 1, 'ОГОНЬ ПО СВОИМ!');
              remove = true;
              break;
            }
          }
        }
      } else if (!remove && !pr.fromPlayer) {
        for (const pl of this.players) {
          if (!pl.alive) continue;
          if (pr.isEnemyBarrel && pl.z > 18) continue;
          if (Math.abs(pr.x - pl.x) < 12 + pr.radius && Math.abs(pr.y - pl.y) < 14 + pr.radius) {
            this.damagePlayer(pl, pr.damage);
            if (pr.explosiveRadius > 0) {
              this.spawnParticles(pr.x, pr.y, 14, '#39FF14', 14, 95);
              soundEngine.playExplosion();
            }
            remove = true;
            break;
          }
        }
      }

      if (remove) {
        if (pr.fromPlayer && !this.bossDefeated && (pr.explosiveRadius > 0 || pr.smokeCloud) && pr.distLeft <= 0) {
          this.detonateProjectile(pr);
        }
        pr.dead = true;
      }
    }
  }

  private getEnemyHitbox(e: SimEnemy): { hitW: number; hitH: number; targetY: number } {
    const hitW =
      e.kind === 'boss_caravan'
        ? 58
        : e.kind === 'boss_substation'
          ? 46
          : e.kind === 'boss_electrician'
            ? 34
            : e.isBoss
              ? 36
              : e.kind === 'beer_truck'
                ? 34
                : e.kind === 'heavy_heli'
                  ? 28
                  : e.kind === 'mini_heli'
                    ? 22
                    : 18;
    const hitH =
      e.kind === 'boss_substation'
        ? 72
        : e.kind === 'boss_electrician'
          ? 46
          : e.isBoss
            ? 32
            : e.kind === 'heavy_heli'
              ? 22
              : 20;
    const targetY =
      e.kind === 'boss_electrician'
        ? e.y - 34
        : e.kind === 'boss_substation'
          ? e.y - 14
          : e.y;
    return { hitW, hitH, targetY };
  }

  private detonateProjectile(pr: SimProjectile, directHitEnemyId?: number): void {
    if (pr.smokeCloud) {
      this.zones.push({
        kind: 'smoke',
        x: pr.x,
        y: pr.y,
        radius: 48,
        timer: 4.8,
        maxTimer: 4.8,
        tickCd: 0.1,
        fromPlayer: true,
        ownerSlot: pr.ownerSlot,
      });
      this.spawnParticles(pr.x, pr.y, 12, '#39FF14', 16, 75);
      this.spawnParticles(pr.x, pr.y, 16, '#D946EF', 10, 60);
    } else {
      soundEngine.playExplosion();
      this.triggerShake(5.5, 0.24);
      this.hitstopTimer = 0.045;
      this.spawnParticles(pr.x, pr.y, 16, '#00E5FF', 18, 130);
      this.spawnParticles(pr.x, pr.y, 18, '#39FF14', 14, 110);
      const snapshot = [...this.enemies];
      for (const e of snapshot) {
        if (e.hacked || e.dead) continue;
        const { hitW, hitH, targetY } = this.getEnemyHitbox(e);
        const dx = Math.max(0, Math.abs(pr.x - e.x) - hitW);
        const dy = Math.max(0, Math.abs(pr.y - targetY) - hitH);
        if (e.id === directHitEnemyId || Math.hypot(dx, dy) <= pr.explosiveRadius) {
          this.damageEnemy(e, pr.damage, pr.ownerSlot ?? 1, true, Math.sign(e.x - pr.x || 1) * 70, pr.stunDuration, 0, pr.hacksTech, true);
        }
      }
    }
  }

  private updateZones(dt: number): void {
    for (let i = this.zones.length - 1; i >= 0; i--) {
      const z = this.zones[i];
      if (!z) continue;
      z.timer -= dt;
      z.tickCd -= dt;
      if (z.tickCd <= 0) {
        if (z.kind === 'smoke') {
          z.tickCd = 0.45;
          const snapshot = [...this.enemies];
          for (const e of snapshot) {
            if (!e.hacked && !e.dead && Math.hypot(e.x - z.x, e.y - z.y) <= z.radius) {
              this.damageEnemy(e, 9, z.ownerSlot ?? 1, false, 0, 0, 0, false, true);
            }
          }
        } else {
          z.tickCd = 0.5;
          const isFlightLightning = this.level.mode === 'flight' && z.kind === 'virus_beam';
          this.players.forEach((pl) => {
            if (!pl.alive) return;
            if (isFlightLightning) {
              if (Math.abs(pl.x - z.x) <= z.radius * 0.65) {
                this.damagePlayer(pl, 1, 'МОЛНИЯ!');
              }
            } else if (pl.z < 16 && Math.hypot(pl.x - z.x, pl.y - z.y) <= z.radius) {
              this.damagePlayer(pl, 1);
            }
          });
        }
      }
      if (z.timer <= 0) this.zones.splice(i, 1);
    }
  }

  private updatePickups(dt: number): void {
    for (let i = this.pickups.length - 1; i >= 0; i--) {
      const pk = this.pickups[i];
      pk.timer -= dt;
      if (pk.timer <= 0) {
        this.pickups.splice(i, 1);
        continue;
      }

      if (pk.kind === 'beer' || pk.kind === 'beer_bottle') {
        for (const pl of this.players) {
          if (!pl.alive) continue;
          if (Math.hypot(pl.x - pk.x, pl.y - pk.y) < 28) {
            if (pk.kind === 'beer') {
              // Full beer mug = 100% full HP & armor restore!
              pl.hpSegments = 3;
              pl.armorPips = pl.maxArmorPips;
              pl.score += 300;
              this.addFloatingText(pl.x, pl.y - 44, 'КРУЖКА! ПОЛНОЕ HP!', '#FFB000');
              this.spawnParticles(pl.x, pl.y, 16, '#FFB000', 16, 90);
            } else {
              // 0.33L bottle = +1 HP segment!
              pl.hpSegments = Math.min(3, pl.hpSegments + 1);
              pl.score += 150;
              this.addFloatingText(pl.x, pl.y - 44, '0.33 · +1 HP', '#FDE047');
              this.spawnParticles(pl.x, pl.y, 14, '#FDE047', 10, 72);
            }
            soundEngine.playPickupBeer();
            this.queueSfx('beer');
            this.pickups.splice(i, 1);
            this.emitHud();
            break;
          }
        }
      }
    }
  }

  private updateParticles(dt: number): void {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const pt = this.particles[i];
      pt.life -= dt;
      pt.x += pt.vx * dt;
      pt.y += pt.vy * dt;
      pt.z = Math.max(0, pt.z + pt.vz * dt);
      pt.vz -= 290 * dt;
      if (pt.life <= 0) this.particles.splice(i, 1);
    }
  }

  private updateTexts(dt: number): void {
    for (let i = this.texts.length - 1; i >= 0; i--) {
      this.texts[i].life -= dt;
      this.texts[i].y -= 22 * dt;
      if (this.texts[i].life <= 0) this.texts.splice(i, 1);
    }
  }

  private getTotalScore(): number {
    return this.carryScore + this.players.reduce((sum, p) => sum + p.score, 0);
  }

  private buildHudSnapshot(): HudSnapshot {
    const bossEntity = this.enemies.find((e) => e.isBoss && !e.dead);
    let boss: BossHudInfo | null = null;
    if (bossEntity) {
      const isSubstation = bossEntity.kind === 'boss_substation';
      boss = {
        name: isSubstation ? 'ПОДСТАНЦИЯ ЗАБОРА' : this.level.bossName,
        subtitle: isSubstation ? '10 000 ВОЛЬТ · СТРЕЛЯЙ, ЧТОБЫ ВЗОРВАТЬ!' : this.level.bossSubtitle,
        hp: Math.max(0, bossEntity.hp),
        maxHp: bossEntity.maxHp,
        phase: bossEntity.phase,
        maxPhases: bossEntity.maxPhases,
      };
    }

    return {
      levelId: this.level.id,
      levelName: this.level.name,
      difficulty: this.difficulty,
      mode: this.level.mode,
      elevatorFloor: this.level.mode === 'elevator' ? Math.round(this.elevatorFloor) : undefined,
      totalScore: this.getTotalScore(),
      continuesLeft: this.continuesLeft,
      maxContinues: 3,
      showGoArrow: !this.camLocked && !this.bossSpawned && this.level.mode === 'beatemup',
      checkpointReached: this.checkpointReached,
      announcement: this.announcement,
      players: this.players.map((p) => {
        const hero = HERO_MAP[p.heroId];
        const w = WEAPON_MAP[p.weaponId];
        return {
          slot: p.slot,
          heroId: p.heroId,
          heroName: hero.name,
          hpSegments: p.hpSegments,
          maxSegments: 3,
          armorPips: p.armorPips,
          maxArmorPips: p.maxArmorPips,
          lives: p.lives,
          maxLives: 3,
          weaponId: p.weaponId,
          weaponName: this.level.mode === 'flight' ? 'ДРОН-ПУШКА + РАКЕТЫ' : w.name,
          isNativeWeapon: this.level.mode === 'flight' ? true : p.weaponId === hero.nativeWeaponId,
          secondaryWeaponId: p.secondaryWeaponId,
          alive: p.alive,
          score: p.score,
          rampLevel: p.rampLevel,
          hackCount: p.hackCount,
        };
      }),
      boss,
    };
  }

  private emitHud(): void {
    this.callbacks.onHudUpdate(this.buildHudSnapshot());
  }

  private buildNetHudSig(): string {
    const bossEntity = this.enemies.find((e) => e.isBoss && !e.dead);
    const bossSig = bossEntity ? `${Math.round(bossEntity.hp)}:${bossEntity.phase}` : '0';
    const goFlag = !this.camLocked && !this.bossSpawned && this.level.mode === 'beatemup' ? 1 : 0;
    const pSig = this.players
      .map(
        (p) =>
          `${p.hpSegments}/${p.armorPips}/${p.lives}/${p.weaponId}/${p.secondaryWeaponId ?? ''}/${p.alive ? 1 : 0}/${p.score}/${Math.round(p.rampLevel * 10)}`
      )
      .join('|');
    return `${this.level.id}|${this.getTotalScore()}|${this.continuesLeft}|${Math.round(this.elevatorFloor)}|${goFlag}|${this.checkpointReached ? 1 : 0}|${this.announcement ?? ''}|${bossSig}|${pSig}`;
  }

  private buildNetFrame(): NetFramePayload {
    const sfx = this.sfxQueue.splice(0, 8);
    const minVisX = this.camX - 72;
    const maxVisX = this.camX + VIRTUAL_W + 72;

    const hudSig = this.buildNetHudSig();
    const shouldIncludeHud =
      hudSig !== this.lastNetHudSig || this.simTime - this.lastNetHudTime >= 0.65;
    if (shouldIncludeHud) {
      this.lastNetHudSig = hudSig;
      this.lastNetHudTime = this.simTime;
    }

    const shouldSendMusic =
      this.currentMusicTrack !== this.lastSentMusicTrack || this.netFrameSeq < 3;
    if (shouldSendMusic) {
      this.lastSentMusicTrack = this.currentMusicTrack;
    }

    const visibleParticles = this.particles.filter((pt) => pt.x >= minVisX && pt.x <= maxVisX);
    const particleSlice = visibleParticles.slice(-24);

    const visibleProjectiles = this.projectiles.filter(
      (pr) => !pr.dead && pr.x >= minVisX && pr.x <= maxVisX
    );
    const projectileSlice = visibleProjectiles.slice(-40);

    return {
      seq: ++this.netFrameSeq,
      levelId: this.level.id,
      camX: Math.round(this.camX * 10) / 10,
      simTime: Math.round(this.simTime * 100) / 100,
      elevatorFloor: Math.round(this.elevatorFloor),
      shakeIntensity: Math.round(this.shakeIntensity * 10) / 10,
      shakeTime: Math.round(this.shakeTime * 100) / 100,
      players: this.players.map((p) => ({
        slot: p.slot,
        heroId: p.heroId,
        x: Math.round(p.x * 10) / 10,
        y: Math.round(p.y * 10) / 10,
        z: Math.round(p.z * 10) / 10,
        vz: Math.round(p.vz),
        facing: p.facing,
        aimX: Math.round(p.aimX * 100) / 100,
        aimY: Math.round(p.aimY * 100) / 100,
        animTime: Math.round(p.animTime * 100) / 100,
        moving: p.moving,
        meleeTimer: Math.round(p.meleeTimer * 100) / 100,
        shootTimer: Math.round(p.shootTimer * 100) / 100,
        hurtTimer: Math.round(p.hurtTimer * 100) / 100,
        invulnTimer: Math.round(p.invulnTimer * 100) / 100,
        weaponId: p.weaponId,
        alive: p.alive,
      })),
      enemies: this.enemies
        .filter((e) => !e.dead && e.x >= minVisX && e.x <= maxVisX)
        .map((e) => ({
          id: e.id,
          kind: e.kind,
          x: Math.round(e.x),
          y: Math.round(e.y),
          z: Math.round(e.z),
          facing: e.facing,
          animTime: Math.round(e.animTime * 20) / 20,
          hurtTimer: Math.round(e.hurtTimer * 20) / 20,
          stunTimer: Math.round(e.stunTimer * 20) / 20,
          burnTimer: Math.round(e.burnTimer * 20) / 20,
          hacked: e.hacked,
          telegraphTimer: Math.round(e.telegraphTimer * 20) / 20,
          hpRatio: Math.round((e.hp / e.maxHp) * 50) / 50,
          phase: e.phase,
        })),
      projectiles: projectileSlice.map((pr) => ({
        x: Math.round(pr.x),
        y: Math.round(pr.y),
        z: Math.round(pr.z),
        vx: Math.round(pr.vx),
        vy: Math.round(pr.vy),
        color: pr.color,
        glowColor: pr.glowColor,
        radius: pr.radius,
        weaponId: pr.weaponId,
        isEnemyBarrel: pr.isEnemyBarrel,
      })),
      zones: this.zones
        .filter((z) => z.x >= minVisX && z.x <= maxVisX)
        .map((z) => ({
          kind: z.kind,
          x: Math.round(z.x),
          y: Math.round(z.y),
          radius: z.radius,
          timer: Math.round(z.timer * 10) / 10,
        })),
      pickups: this.pickups
        .filter((pk) => pk.x >= minVisX && pk.x <= maxVisX)
        .map((pk) => ({
          kind: pk.kind,
          x: Math.round(pk.x),
          y: Math.round(pk.y),
          weaponId: pk.weaponId,
        })),
      particles: particleSlice.map((pt) => ({
        x: Math.round(pt.x),
        y: Math.round(pt.y),
        z: Math.round(pt.z),
        size: pt.size,
        color: pt.color,
      })),
      texts: this.texts
        .filter((ft) => ft.x >= minVisX && ft.x <= maxVisX)
        .slice(-10)
        .map((ft) => ({
          x: Math.round(ft.x),
          y: Math.round(ft.y),
          text: ft.text,
          color: ft.color,
        })),
      hud: shouldIncludeHud ? this.buildHudSnapshot() : undefined,
      musicTrack: shouldSendMusic ? this.currentMusicTrack : undefined,
      sfx: sfx.length > 0 ? sfx : undefined,
    };
  }

  private render(): void {
    const ctx = this.ctx;
    ctx.save();
    ctx.scale(this.renderScale, this.renderScale);

    const rf = this.onlineMode === 'guest' ? this.remoteFrame : null;
    const prevRf =
      this.onlineMode === 'guest' &&
      this.prevRemoteFrame &&
      rf &&
      this.prevRemoteFrame.levelId === rf.levelId
        ? this.prevRemoteFrame
        : null;
    if (this.onlineMode === 'guest' && !rf) {
      drawLevelBackground(ctx, this.level, 0, this.simTime, 1);
      ctx.fillStyle = 'rgba(9,12,17,0.72)';
      ctx.fillRect(0, 0, VIRTUAL_W, VIRTUAL_H);
      ctx.fillStyle = '#00E5FF';
      ctx.font = 'bold 12px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('СИНХРОНИЗАЦИЯ С ХОСТОМ...', VIRTUAL_W / 2, VIRTUAL_H / 2);
      ctx.textAlign = 'left';
      ctx.restore();
      return;
    }

    // Smooth 60 FPS client-side interpolation between 22 Hz host snapshots on Guest!
    const guestElapsedMs = rf ? Math.max(0, performance.now() - this.remoteFrameAt) : 0;
    const guestLerpT = prevRf
      ? Math.max(0, Math.min(1, guestElapsedMs / Math.max(24, this.remoteFrameInterval)))
      : 1;
    const guestExtrapSec = rf ? Math.min(0.055, guestElapsedMs / 1000) : 0;

    const activeLevel = rf ? LEVEL_MAP[rf.levelId] : this.level;
    const camX =
      rf && prevRf && Math.abs(rf.camX - prevRf.camX) < 120
        ? prevRf.camX + (rf.camX - prevRf.camX) * guestLerpT
        : rf
          ? rf.camX
          : this.camX;
    const simTime = rf ? rf.simTime + guestExtrapSec : this.simTime;
    const elevatorFloor = rf ? rf.elevatorFloor : Math.round(this.elevatorFloor);
    const shakeIntensity = rf ? rf.shakeIntensity : this.shakeIntensity;
    const shakeTime = rf ? rf.shakeTime : this.shakeTime;

    if (shakeIntensity > 0 && shakeTime > 0) {
      const sx = (Math.random() - 0.5) * 2 * shakeIntensity;
      const sy = (Math.random() - 0.5) * 2 * shakeIntensity;
      ctx.translate(Math.round(sx), Math.round(sy));
    }

    const renderEnemies = rf ? rf.enemies : this.enemies.filter((e) => !e.dead);
    const hasLiveSubstation = renderEnemies.some((e) => e.kind === 'boss_substation');
    drawLevelBackground(ctx, activeLevel, camX, simTime, elevatorFloor, {
      substationLive: hasLiveSubstation,
      substationDestroyed: !rf ? this.bossDefeated : false,
    });

    const camY = getCameraOffsetY(activeLevel.id, camX);
    const elevAt = (wx: number) => getGroundElevation(activeLevel.id, wx) - camY;

    const renderZones = rf ? rf.zones : this.zones;
    for (const z of renderZones) {
      const sx = Math.round(z.x - camX);
      const sy = Math.round(z.y + elevAt(z.x));
      const alpha = Math.min(1, z.timer / 0.8);
      if (z.kind === 'smoke') {
        ctx.fillStyle = `rgba(57, 255, 20, ${0.24 * alpha})`;
        ctx.beginPath();
        ctx.ellipse(sx, sy - 6, z.radius, z.radius * 0.42, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = `rgba(217, 70, 239, ${0.2 * alpha})`;
        ctx.beginPath();
        ctx.ellipse(sx + Math.sin(simTime * 5) * 6, sy - 14, z.radius * 0.72, z.radius * 0.32, 0, 0, Math.PI * 2);
        ctx.fill();
      } else if (z.kind === 'vomit') {
        ctx.fillStyle = `rgba(132, 204, 22, ${0.55 * alpha})`;
        ctx.beginPath();
        ctx.ellipse(sx, sy, z.radius, z.radius * 0.38, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = `rgba(57, 255, 20, ${0.88 * alpha})`;
        ctx.lineWidth = 1.5;
        ctx.stroke();
      } else if (activeLevel.mode === 'flight') {
        // High-voltage lightning pillar from the Crazy Electrician!
        ctx.fillStyle = `rgba(56, 189, 248, ${0.28 * alpha})`;
        ctx.fillRect(sx - z.radius * 0.55, 0, z.radius * 1.1, sy);
        ctx.strokeStyle = `rgba(254, 240, 138, ${0.95 * alpha})`;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(sx, 0);
        for (let ly = 18; ly <= sy; ly += 18) {
          const jag = Math.sin(simTime * 42 + ly * 0.3) * 8;
          ctx.lineTo(sx + jag, ly);
        }
        ctx.stroke();
        ctx.strokeStyle = `rgba(255, 255, 255, ${0.85 * alpha})`;
        ctx.lineWidth = 1.2;
        ctx.stroke();
      } else {
        ctx.fillStyle = `rgba(57, 255, 20, ${0.3 * alpha})`;
        ctx.fillRect(sx - z.radius * 0.65, 0, z.radius * 1.3, sy);
        ctx.fillStyle = `rgba(255, 255, 255, ${0.48 * alpha})`;
        ctx.fillRect(sx - 6, 0, 12, sy);
        ctx.strokeStyle = '#39FF14';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.ellipse(sx, sy, z.radius, z.radius * 0.36, 0, 0, Math.PI * 2);
        ctx.stroke();
      }
    }

    const prevEnemyMap = prevRf ? new Map(prevRf.enemies.map((pe) => [pe.id, pe])) : null;
    const prevPlayerMap = prevRf ? new Map(prevRf.players.map((pp) => [pp.slot, pp])) : null;

    // Draw landing reticles for enemies dropping from elevator shaft ceiling!
    for (const e of renderEnemies) {
      const pe = prevEnemyMap?.get(e.id);
      const ex = pe && Math.abs(e.x - pe.x) < 90 ? pe.x + (e.x - pe.x) * guestLerpT : e.x;
      const ey = pe && Math.abs(e.y - pe.y) < 90 ? pe.y + (e.y - pe.y) * guestLerpT : e.y;
      const ez = pe && Math.abs(e.z - pe.z) < 90 ? pe.z + (e.z - pe.z) * guestLerpT : e.z;
      if (
        ez > 32 &&
        e.kind !== 'drone' &&
        e.kind !== 'mini_heli' &&
        e.kind !== 'heavy_heli' &&
        e.kind !== 'boss_electrician' &&
        e.kind !== 'boss_substation'
      ) {
        const sx = Math.round(ex - camX);
        const sy = Math.round(ey + elevAt(ex));
        const pulse = 0.55 + Math.sin(simTime * 18) * 0.35;
        const rad = e.kind.startsWith('boss_') ? 26 : 13;
        ctx.strokeStyle = `rgba(255, 42, 133, ${pulse})`;
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.ellipse(sx, sy, rad, rad * 0.42, 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.fillStyle = `rgba(250, 204, 21, ${pulse * 0.6})`;
        ctx.fillRect(sx - 4, sy - 1, 8, 2);
        ctx.fillRect(sx - 1, sy - 3, 2, 6);
      }
    }

    type RenderItem = { y: number; draw: () => void };
    const items: RenderItem[] = [];

    const renderPlayers = rf ? rf.players : this.players;
    const renderPickups = rf ? rf.pickups : this.pickups;

    for (const pk of renderPickups) {
      const pkElev = elevAt(pk.x);
      items.push({
        y: pk.y,
        draw: () => {
          const sx = pk.x - camX;
          const sy = pk.y + pkElev;
          drawPickupSprite(ctx, pk.kind, sx, sy, simTime, pk.weaponId as WeaponId | undefined);
          if (pk.kind === 'weapon' && pk.weaponId) {
            const near = renderPlayers.some((p) => p.alive && Math.hypot(p.x - pk.x, p.y - pk.y) < 36);
            if (near) {
              const label = this.touchHints ? 'ОРУЖИЕ · ВЗЯТЬ' : 'ВЗЯТЬ ОРУЖИЕ';
              ctx.fillStyle = '#090C11';
              ctx.fillRect(Math.round(sx - 30), Math.round(sy - 33), 60, 10);
              ctx.fillStyle = '#39FF14';
              ctx.font = 'bold 6px monospace';
              ctx.textAlign = 'center';
              ctx.fillText(label, Math.round(sx), Math.round(sy - 26));
              ctx.textAlign = 'left';
            }
          }
        },
      });
    }

    for (const p of renderPlayers) {
      if (!p.alive) continue;
      const pp = prevPlayerMap?.get(p.slot);
      const pxPos = pp && Math.abs(p.x - pp.x) < 90 ? pp.x + (p.x - pp.x) * guestLerpT : p.x;
      const pyPos = pp && Math.abs(p.y - pp.y) < 90 ? pp.y + (p.y - pp.y) * guestLerpT : p.y;
      const pzPos = pp && Math.abs(p.z - pp.z) < 90 ? pp.z + (p.z - pp.z) * guestLerpT : p.z;
      const pElev = elevAt(pxPos);
      const bikePitch = activeLevel.mode === 'highway' ? getGroundSlope(activeLevel.id, pxPos) : 0;
      const isThrottling =
        activeLevel.mode === 'highway' &&
        p.moving &&
        ('vx' in p && typeof p.vx === 'number' ? p.vx > 8 : pp ? p.x - pp.x > 0.4 : true);
      const isFlightMode = activeLevel.mode === 'flight';
      const rawVx = 'vx' in p && typeof p.vx === 'number' ? p.vx : pp ? (p.x - pp.x) * 35 : 0;
      const quadTilt = isFlightMode
        ? Math.max(-0.18, Math.min(0.2, rawVx * p.facing * 0.0012))
        : 0;
      items.push({
        y: pyPos,
        draw: () =>
          drawHeroSprite(ctx, {
            heroId: p.heroId,
            x: pxPos - camX,
            y: pyPos + pElev,
            z: pzPos,
            vz: p.vz,
            facing: activeLevel.mode === 'highway' ? 1 : p.facing,
            aimX: p.aimX,
            aimY: p.aimY,
            animTime: rf ? p.animTime + guestExtrapSec : p.animTime,
            moving: p.moving || activeLevel.mode === 'highway' || isFlightMode,
            meleeTimer: p.meleeTimer,
            shootTimer: p.shootTimer,
            hurtTimer: p.hurtTimer,
            invulnTimer: p.invulnTimer,
            weaponId: p.weaponId as WeaponId,
            onBike: activeLevel.mode === 'highway',
            onQuadcopter: isFlightMode,
            quadTilt,
            bikePitch,
            throttling: isThrottling,
            playerSlot: p.slot,
          }),
      });
    }

    for (const e of renderEnemies) {
      const pe = prevEnemyMap?.get(e.id);
      const ex = pe && Math.abs(e.x - pe.x) < 90 ? pe.x + (e.x - pe.x) * guestLerpT : e.x;
      const ey = pe && Math.abs(e.y - pe.y) < 90 ? pe.y + (e.y - pe.y) * guestLerpT : e.y;
      const ez = pe && Math.abs(e.z - pe.z) < 90 ? pe.z + (e.z - pe.z) * guestLerpT : e.z;
      const eElev = elevAt(ex);
      items.push({
        y: ey,
        draw: () =>
          drawEnemySprite(ctx, {
            kind: e.kind as EnemyKind,
            x: ex - camX,
            y: ey + eElev,
            z: ez,
            facing: e.facing,
            animTime: rf ? e.animTime + guestExtrapSec : e.animTime,
            hurtTimer: e.hurtTimer,
            stunTimer: e.stunTimer,
            burnTimer: e.burnTimer,
            hacked: e.hacked,
            telegraphTimer: e.telegraphTimer,
            hpRatio: 'hpRatio' in e ? e.hpRatio : e.hp / e.maxHp,
            phase: e.phase,
            variant: e.id % 3,
          }),
      });
    }

    items.sort((a, b) => a.y - b.y);
    for (const item of items) item.draw();

    const renderProjectiles = rf ? rf.projectiles : this.projectiles.filter((pr) => !pr.dead);
    for (const pr of renderProjectiles) {
      const prX = rf ? pr.x + pr.vx * guestExtrapSec : pr.x;
      const prY = rf ? pr.y + pr.vy * guestExtrapSec : pr.y;
      const sx = Math.round(prX - camX);
      const sy = Math.round(prY + elevAt(prX) - pr.z);
      if (pr.isEnemyBarrel) {
        ctx.fillStyle = '#07090E';
        ctx.fillRect(sx - 8, sy - 8, 16, 16);
        ctx.fillStyle = '#14532D';
        ctx.fillRect(sx - 7, sy - 7, 14, 14);
        ctx.fillStyle = '#39FF14';
        ctx.fillRect(sx - 5, sy - 2, 10, 4);
      } else if (pr.weaponId === 'bass_beam') {
        ctx.strokeStyle = pr.glowColor;
        ctx.lineWidth = 5;
        ctx.beginPath();
        ctx.moveTo(sx, sy);
        ctx.lineTo(sx - pr.vx * 0.048, sy - pr.vy * 0.048);
        ctx.stroke();
        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = 2;
        ctx.stroke();
      } else if (pr.weaponId === 'domna') {
        ctx.fillStyle = pr.color;
        ctx.beginPath();
        ctx.arc(sx, sy, 5.5 + Math.random() * 2, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#FEF08A';
        ctx.beginPath();
        ctx.arc(sx, sy, 2.5, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.fillStyle = '#07090E';
        ctx.fillRect(sx - pr.radius - 1, sy - pr.radius - 1, pr.radius * 2 + 2, pr.radius * 2 + 2);
        ctx.fillStyle = pr.glowColor;
        ctx.fillRect(sx - pr.radius, sy - pr.radius, pr.radius * 2, pr.radius * 2);
        ctx.fillStyle = pr.color;
        ctx.fillRect(sx - pr.radius + 1, sy - pr.radius + 1, pr.radius * 2 - 2, pr.radius * 2 - 2);
      }
    }

    const renderParticles = rf ? rf.particles : this.particles;
    for (const pt of renderParticles) {
      const sx = Math.round(pt.x - camX);
      const sy = Math.round(pt.y + elevAt(pt.x) - pt.z);
      ctx.fillStyle = pt.color;
      ctx.fillRect(sx, sy, pt.size, pt.size);
    }

    const renderTexts = rf ? rf.texts : this.texts;
    ctx.font = 'bold 7px monospace';
    ctx.textAlign = 'center';
    for (const ft of renderTexts) {
      const sx = Math.round(ft.x - camX);
      const sy = Math.round(ft.y + elevAt(ft.x));
      ctx.fillStyle = '#07090E';
      ctx.fillText(ft.text, sx + 1, sy + 1);
      ctx.fillStyle = ft.color;
      ctx.fillText(ft.text, sx, sy);
    }
    ctx.textAlign = 'left';

    ctx.restore();
  }
}
