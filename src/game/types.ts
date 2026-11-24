import { ControlBindings } from './controls';

export type ScreenState =
  | 'TITLE_MENU'
  | 'ONLINE_LOBBY'
  | 'CHAR_SELECT'
  | 'CUTSCENE'
  | 'PLAYING'
  | 'PAUSED'
  | 'CONTINUE'
  | 'STAGE_CLEAR'
  | 'GAME_OVER'
  | 'VICTORY';

export type HeroId =
  | 'vadek'
  | 'vano'
  | 'koren'
  | 'hooper'
  | 'sandro'
  | 'zavod_killer'
  | 'bo'
  | 'ded';

export type WeaponId =
  | 'chaindog'
  | 'spinning'
  | 'rc_launcher'
  | 'blast_beat'
  | 'bass_beam'
  | 'domna'
  | 'firewall'
  | 'dymok';

export type LevelId = 1 | 2 | 3 | 4 | 5 | 6;

export type EnemyKind =
  | 'drunk'
  | 'acid_punk'
  | 'buffalo'
  | 'guard_gunner'
  | 'guard_shield'
  | 'turret'
  | 'drone'
  | 'biker'
  | 'beer_truck'
  | 'elite'
  | 'boss_drunk'
  | 'boss_buffalo'
  | 'boss_chief'
  | 'boss_caravan'
  | 'boss_elevator'
  | 'boss_director';

export interface HeroStats {
  speed: number; // 1..5
  hp: number; // 1..5 (armor toughness & i-frames over 3 HP segments)
  damage: number; // 1..5
  fireRate: number; // 1..5
  specialLabel: string;
  specialValue: number; // 1..5
}

export interface HeroPalette {
  skin: string;
  hair: string;
  jacket: string;
  shirt: string;
  pants: string;
  accent: string;
  boots: string;
  bikeMain: string;
  bikeAccent: string;
}

export interface HeroDef {
  id: HeroId;
  name: string;
  subtitle: string;
  role: string;
  bio: string;
  nativeWeaponId: WeaponId;
  stats: HeroStats;
  bodyWidth: 'lean' | 'athletic' | 'stocky' | 'heavy';
  palette: HeroPalette;
  perk: string;
}

export interface WeaponDef {
  id: WeaponId;
  name: string;
  ownerId: HeroId;
  shortTag: string;
  description: string;
  nativeBonusDesc: string;
  damage: number;
  cooldown: number; // seconds
  speed: number; // px/s
  range: number; // px
  pellets: number;
  spread: number; // radians
  pierce: boolean;
  explosiveRadius: number;
  burnDuration: number;
  stunDuration: number;
  hacksTech: boolean;
  smokeCloud: boolean;
  rampsUp: boolean;
  color: string;
  glowColor: string;
}

export interface WaveSpawn {
  kind: EnemyKind;
  offsetX: number; // relative to zone lockX
  y: number;
  delay?: number;
  dropFromTop?: boolean; // for elevator roof drops
}

export interface ArenaZone {
  lockX: number;
  spawns: WaveSpawn[];
  dropWeapon?: WeaponId;
  dropBeer?: boolean;
}

export type LandmarkKind =
  | 'statue_brewer'
  | 'wrecked_beer_truck'
  | 'quarantine_skull_arch'
  | 'statue_cyber_bull'
  | 'beached_cargo_ship'
  | 'market_van_wreck'
  | 'titan_mech_bay'
  | 'wrecked_apc'
  | 'cracked_reactor_dome'
  | 'burning_semi_truck'
  | 'bridge_hole'
  | 'factory_welcome_arch'
  | 'bio_leviathan_tank'
  | 'director_statue'
  | 'pized_world_globe';

export interface LevelLandmark {
  kind: LandmarkKind;
  x: number;
  label?: string;
}

export type HazardKind =
  | 'bridge_hole'
  | 'barrier'
  | 'boom_gate'
  | 'crate_row'
  | 'slime_river'
  | 'laser_gate';

export interface RoadHazard {
  id: string;
  kind: HazardKind;
  x: number; // world X center
  y: number; // floor Y center
  w: number; // width
  h: number; // height (depth on road)
  solid?: boolean; // true = physically blocks grounded players until jumped over
  pulseOffset?: number;
}

export interface LevelDef {
  id: LevelId;
  name: string;
  shortName: string;
  location: string;
  mode: 'beatemup' | 'highway' | 'elevator';
  length: number;
  checkpointX: number;
  checkpoints: number[];
  bossKind: EnemyKind;
  bossName: string;
  bossSubtitle: string;
  musicTrack: 'level1' | 'level2' | 'level3' | 'level4' | 'elevator' | 'level5';
  skyTop: string;
  skyBottom: string;
  accentColor: string;
  zones: ArenaZone[];
  landmarks: LevelLandmark[];
  roadHazards?: RoadHazard[];
}

export interface CutsceneLine {
  speakerId: HeroId;
  stageAction: string;
  text: string;
}

export interface CutsceneDef {
  id: string;
  levelId: LevelId | 'victory';
  title: string;
  locationLabel: string;
  sceneTheme: 'van_street' | 'market_crates' | 'factory_gate' | 'highway_bikes' | 'factory_lift' | 'city_dawn';
  epilogueAction: string;
  lines: CutsceneLine[];
}

export type TouchControlsMode = 'auto' | 'on' | 'off';

export type DifficultyId = 'easy' | 'normal' | 'hard';

export interface DifficultyConfig {
  id: DifficultyId;
  label: string;
  shortLabel: string;
  description: string;
  enemyCountMult: number;
  fireCooldownMult: number;
  telegraphMult: number;
  projectileSpeedMult: number;
  bossSummonCap: number;
  extraBossShots: number;
}

export interface GameSettings {
  players: 1 | 2;
  startLevel: LevelId;
  difficulty: DifficultyId;
  friendlyFire: boolean;
  crtScanlines: boolean;
  muted: boolean;
  touchControlsMode: TouchControlsMode;
  controls: ControlBindings;
}

export interface SaveData {
  unlockedLevel: LevelId;
  highScore: number;
  difficulty: DifficultyId;
  friendlyFire: boolean;
  crtScanlines: boolean;
  touchControlsMode: TouchControlsMode;
  controls: ControlBindings;
}

export interface PlayerHudInfo {
  slot: 1 | 2;
  heroId: HeroId;
  heroName: string;
  hpSegments: number; // 0..3
  maxSegments: 3;
  armorPips: number;
  maxArmorPips: number;
  lives: number; // 0..3
  maxLives: 3;
  weaponId: WeaponId;
  weaponName: string;
  isNativeWeapon: boolean;
  secondaryWeaponId: WeaponId | null;
  alive: boolean;
  score: number;
  rampLevel: number; // 0..1 for Hooper minigun
  hackCount: number;
}

export interface BossHudInfo {
  name: string;
  subtitle: string;
  hp: number;
  maxHp: number;
  phase: number;
  maxPhases: number;
}

export interface HudSnapshot {
  levelId: LevelId;
  levelName: string;
  difficulty: DifficultyId;
  mode: 'beatemup' | 'highway' | 'elevator';
  elevatorFloor?: number;
  totalScore: number;
  continuesLeft: number;
  maxContinues: 3;
  showGoArrow: boolean;
  checkpointReached: boolean;
  announcement: string | null;
  players: PlayerHudInfo[];
  boss: BossHudInfo | null;
}

export interface StageClearSummary {
  levelId: LevelId;
  levelName: string;
  bossName: string;
  score: number;
  enemiesDefeated: number;
  continuesLeft: number;
}

// ==================== ONLINE 2P CO-OP MULTIPLAYER TYPES ====================

export type OnlineRole = 'host' | 'guest';

export interface RemoteInputState {
  up: boolean;
  down: boolean;
  left: boolean;
  right: boolean;
  analogX: number;
  analogY: number;
  melee: boolean;
  jump: boolean;
  shoot: boolean;
  swap: boolean;
}

export interface OnlineRoomSnapshot {
  code: string;
  phase: 'LOBBY' | 'CUTSCENE' | 'PLAYING' | 'STAGE_CLEAR' | 'GAME_OVER' | 'VICTORY';
  levelId: LevelId;
  difficulty: DifficultyId;
  friendlyFire: boolean;
  hostHero: HeroId;
  guestHero: HeroId;
  hostReady: boolean;
  guestReady: boolean;
  guestConnected: boolean;
  isVictoryCutscene: boolean;
}

export interface PublicRoomInfo {
  code: string;
  hostHero: HeroId;
  difficulty: DifficultyId;
  levelId: LevelId;
  players: number;
}

