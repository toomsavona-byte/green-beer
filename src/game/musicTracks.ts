export type MusicTrack =
  | 'none'
  | 'title'
  | 'cutscene'
  | 'level1'
  | 'level2'
  | 'sky_raid'
  | 'level3'
  | 'level4'
  | 'elevator'
  | 'level5'
  | 'boss'
  | 'victory'
  | 'synthwave';

export type LeadType =
  | 'hoover'
  | 'fm_shred'
  | 'siren'
  | 'funk_brass'
  | 'guitar_lead'
  | 'arp_pulse'
  | 'organ_lead';

export type BassStyle = 'acid' | 'slap_funk' | 'industrial' | 'rock_gallop';
export type StabChord = 'minor' | 'major7' | 'power5' | 'dim';

// Drum grid tokens per 16th-note step:
// K = Hardcore Sub-Kick, S = Crunchy Sega DAC Snare, g = Amen Ghost Snare,
// H = Closed Hat, O = Open Hat, C = Crash/Drop Hit, T = Industrial Tom, M = Metallic Anvil/Clang
export interface TrackSection {
  bass: number[]; // 32 steps (2 bars)
  lead?: number[]; // 32 steps (optional — omit for intro/breakdown focus)
  counter?: number[]; // 32 steps (secondary harmony / counter-riff / shimmering arp)
  stab?: number[]; // 32 steps (root MIDI note for chord stab or 0)
  drums: string[]; // 32 steps
  acidAccent?: number[]; // 32 steps (falls back to pattern.acidAccent)
  padChords?: number[][]; // 2 chords (1 per bar) for atmospheric breakdown/chorus pads
  leadType?: LeadType; // per-section timbre switch (e.g. solo lead or arp)
  leadOctave?: number; // +12 or -12 octave shift
  filterMult?: number; // dynamic cutoff multiplier (0.45..1.35)
  filterRampTo?: number; // smoothly sweep filterMult across the 32 steps (buildups!)
  stabChord?: StabChord;
  intense?: boolean; // climax gain/brightness boost
}

export interface TrackPattern {
  bpm: number;
  bassA: number[]; // 32 steps (fallback/legacy)
  bassB: number[]; // 32 steps
  acidAccent: number[]; // 32 steps
  leadA: number[]; // 32 steps
  leadB: number[]; // 32 steps
  stab: number[]; // 32 steps
  drumsA: string[]; // 32 steps
  drumsB: string[]; // 32 steps
  sections?: Record<string, TrackSection>;
  arrangement?: string[]; // sequence of 2-bar section keys (20-26 bars = 32-44 sec!)
  loopStart?: number; // arrangement index to loop back to after the full cycle
  muffled?: boolean;
  acidQ?: number;
  leadType?: LeadType;
  bassStyle?: BassStyle;
  stabChord?: StabChord;
  drive?: number;
  isSynthwave?: boolean;
  padChords?: number[][];
}

// Reusable dynamic drum patterns (all 32 steps = 2 bars)
const DRUMS_INTRO_PULSE = [
  'K', 'H', 'H', 'H', 'KH', 'H', 'O', 'H', 'K', 'H', 'H', 'H', 'KH', 'H', 'O', 'H',
  'K', 'H', 'KH', 'H', 'KH', 'H', 'O', 'H', 'K', 'H', 'S', 'H', 'S', 'T', 'S', 'KC',
];

const DRUMS_BREAK_HALFTIME = [
  'KC', 'H', '', 'H', '', 'H', 'O', 'H', 'S', 'H', '', 'g', 'K', 'H', 'O', 'H',
  'K', 'H', '', 'H', '', 'H', 'O', 'H', 'S', 'H', '', 'g', 'K', 'T', 'O', 'H',
];

const DRUMS_BUILDUP_ROLL = [
  'K', 'H', 'O', 'H', 'KS', 'H', 'O', 'H', 'K', 'H', 'KS', 'H', 'KS', 'H', 'KS', 'H',
  'KS', 'S', 'KS', 'S', 'S', 'S', 'KS', 'S', 'S', 'T', 'S', 'T', 'S', 'S', 'KT', 'KSC',
];

const DRUMS_FUNK_BREAK = [
  'KC', 'H', 'O', 'H', '', 'H', 'O', 'g', 'K', 'H', 'O', 'H', 'g', 'H', 'O', 'H',
  'K', 'H', 'O', 'H', '', 'H', 'O', 'g', 'K', 'H', 'KO', 'H', 'S', 'g', 'T', 'O',
];

const DRUMS_IND_INTRO = [
  'KC', '', 'M', '', 'K', '', 'M', '', 'K', '', 'M', '', 'K', '', 'M', 'H',
  'K', 'H', 'M', 'H', 'SM', 'H', 'K', 'H', 'K', 'H', 'M', 'H', 'SM', 'T', 'S', 'KT',
];

const DRUMS_IND_BREAK = [
  'KC', '', '', '', 'M', '', '', 'H', 'K', '', '', '', 'M', '', 'O', '',
  'K', '', '', 'H', 'M', '', 'K', '', 'K', 'H', 'M', 'H', 'SM', 'T', 'T', 'KT',
];

const DRUMS_ROCK_INTRO = [
  'KC', 'O', 'K', 'O', 'KC', 'O', 'K', 'O', 'KC', 'O', 'K', 'O', 'S', 'O', 'S', 'O',
  'KC', 'O', 'K', 'O', 'SO', 'K', 'K', 'O', 'K', 'S', 'K', 'S', 'T', 'T', 'KT', 'KSC',
];

const DRUMS_ROCK_CRUISE = [
  'KC', 'H', 'O', 'H', 'K', 'H', 'O', 'H', 'SO', 'H', 'K', 'H', 'K', 'H', 'O', 'H',
  'K', 'H', 'O', 'H', 'K', 'H', 'O', 'H', 'SO', 'H', 'K', 'T', 'S', 'T', 'S', 'KT',
];

const DRUMS_TECHNO_INTRO = [
  'K', 'H', 'O', 'H', 'K', 'H', 'O', 'H', 'K', 'H', 'O', 'H', 'K', 'H', 'O', 'H',
  'K', 'H', 'O', 'H', 'K', 'H', 'O', 'H', 'K', 'H', 'KO', 'H', 'K', 'H', 'M', 'O',
];

const DRUMS_TECHNO_FLOAT = [
  'KC', 'H', 'O', 'H', '', 'H', 'O', 'H', '', 'H', 'O', 'H', '', 'H', 'O', 'H',
  'K', 'H', 'O', 'H', '', 'H', 'O', 'H', '', 'H', 'O', 'H', 'M', 'H', 'O', 'H',
];

const DRUMS_GOTHIC_INTRO = [
  'KC', '', '', '', 'T', '', 'T', '', 'KC', '', '', '', 'T', '', 'KT', '',
  'KC', 'H', 'K', 'H', 'ST', 'H', 'KO', 'H', 'K', 'T', 'S', 'T', 'S', 'T', 'KT', 'KSC',
];

const DRUMS_GOTHIC_BREAK = [
  'KC', '', 'H', '', 'T', '', 'O', '', 'K', '', 'H', '', 'T', '', 'O', '',
  'K', '', 'H', '', 'ST', '', 'O', '', 'K', 'T', 'K', 'T', 'S', 'T', 'KT', 'C',
];

const DRUMS_BOSS_BREAK = [
  'KC', '', 'K', '', 'M', '', 'K', '', 'K', '', 'K', '', 'SM', '', 'KO', '',
  'KC', '', 'K', '', 'M', '', 'K', 'g', 'K', 'S', 'K', 'S', 'S', 'T', 'KT', 'KSC',
];

const ACCENT_SPARSE = [
  1, 0, 0, 0, 0, 0, 1, 0, 1, 0, 0, 0, 0, 0, 1, 0,
  1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 1, 0, 1, 1, 1, 0,
];

const ACCENT_BUILD = [
  1, 0, 1, 0, 1, 0, 1, 0, 1, 1, 1, 0, 1, 1, 1, 0,
  1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1,
];

// ============================================================================
// TRACK COMPOSITIONS (Multi-section 18-26 bar arrangements, ~30-42s per cycle)
// ============================================================================

const TITLE_BASS_A = [
  36, 36, 48, 39, 36, 36, 43, 42, 36, 36, 41, 39, 36, 48, 46, 43,
  36, 36, 48, 39, 41, 42, 43, 46, 36, 36, 48, 46, 43, 42, 41, 39,
];
const TITLE_BASS_B = [
  36, 48, 36, 39, 42, 36, 43, 48, 36, 48, 41, 42, 43, 46, 48, 51,
  36, 36, 51, 48, 46, 43, 42, 39, 36, 48, 46, 43, 42, 41, 39, 38,
];
const TITLE_LEAD_A = [
  60, 0, 63, 66, 67, 0, 66, 63, 60, 0, 65, 63, 60, 0, 58, 60,
  60, 63, 66, 67, 70, 0, 67, 66, 63, 60, 72, 0, 70, 67, 66, 63,
];
const TITLE_LEAD_B = [
  72, 0, 75, 78, 79, 78, 75, 72, 72, 75, 77, 75, 72, 70, 67, 70,
  72, 75, 78, 79, 82, 79, 78, 75, 72, 75, 78, 79, 84, 82, 79, 75,
];
const TITLE_STAB = [
  48, 0, 0, 48, 0, 0, 51, 0, 0, 0, 54, 0, 0, 0, 51, 0,
  48, 0, 0, 48, 0, 0, 55, 0, 54, 0, 51, 0, 54, 0, 55, 0,
];
const TITLE_DRUMS_A = [
  'KC', 'H', 'KH', 'g', 'SH', 'K', 'KO', 'gH', 'KH', 'gH', 'KH', 'H', 'SH', 'K', 'KO', 'g',
  'KH', 'H', 'KH', 'g', 'SH', 'K', 'KH', 'H', 'KO', 'g', 'KH', 'M', 'S', 'T', 'S', 'KT',
];
const TITLE_DRUMS_B = [
  'KC', 'K', 'KH', 'g', 'SM', 'K', 'KO', 'gH', 'KH', 'K', 'KH', 'g', 'SM', 'K', 'KO', 'g',
  'KH', 'K', 'KH', 'g', 'SH', 'K', 'KO', 'M', 'KH', 'S', 'KH', 'S', 'S', 'S', 'KT', 'KS',
];

const L1_BASS_A = [
  38, 0, 50, 38, 0, 41, 45, 0, 44, 0, 41, 38, 0, 40, 45, 44,
  38, 0, 50, 38, 41, 0, 45, 48, 0, 45, 41, 40, 38, 0, 45, 0,
];
const L1_BASS_B = [
  38, 50, 0, 38, 41, 53, 0, 45, 38, 50, 48, 0, 44, 41, 40, 38,
  38, 0, 50, 48, 45, 0, 48, 50, 53, 0, 50, 48, 45, 44, 41, 40,
];
const L1_LEAD_A = [
  62, 0, 65, 69, 0, 0, 74, 0, 72, 0, 69, 65, 62, 0, 0, 0,
  62, 65, 69, 0, 74, 0, 77, 0, 74, 72, 69, 0, 65, 0, 69, 0,
];
const L1_LEAD_B = [
  74, 0, 77, 81, 0, 86, 0, 84, 81, 0, 77, 74, 72, 0, 74, 0,
  74, 77, 81, 0, 86, 84, 81, 77, 81, 0, 77, 74, 72, 69, 65, 0,
];
const L1_STAB = [
  50, 0, 0, 0, 0, 0, 53, 0, 0, 0, 55, 0, 0, 0, 53, 0,
  50, 0, 0, 50, 0, 0, 57, 0, 0, 0, 55, 0, 53, 0, 57, 0,
];
const L1_DRUMS_A = [
  'KC', 'H', 'KH', 'g', 'SH', 'H', 'KH', 'gH', 'KO', 'H', 'KH', 'H', 'SH', 'K', 'KO', 'g',
  'KH', 'H', 'KH', 'g', 'SH', 'H', 'KO', 'H', 'KH', 'g', 'KH', 'H', 'SH', 'T', 'S', 'KT',
];
const L1_DRUMS_B = [
  'KC', 'K', 'KH', 'g', 'SM', 'K', 'KO', 'gH', 'KH', 'K', 'KH', 'g', 'SM', 'K', 'KO', 'g',
  'KH', 'K', 'KH', 'g', 'SH', 'K', 'KO', 'M', 'KH', 'S', 'KH', 'S', 'S', 'T', 'KT', 'KS',
];

const L2_BASS_A = [
  40, 0, 0, 40, 52, 0, 47, 0, 43, 0, 45, 0, 47, 50, 0, 47,
  40, 0, 52, 0, 0, 40, 43, 45, 47, 0, 0, 50, 47, 45, 43, 0,
];
const L2_BASS_B = [
  45, 0, 0, 45, 57, 0, 52, 0, 47, 0, 45, 0, 43, 45, 47, 0,
  40, 0, 52, 40, 0, 43, 45, 47, 50, 0, 52, 0, 47, 45, 43, 42,
];
const L2_LEAD_A = [
  76, 0, 0, 79, 0, 76, 74, 0, 71, 0, 74, 0, 76, 0, 0, 0,
  79, 0, 81, 0, 79, 76, 74, 0, 71, 0, 0, 74, 71, 0, 67, 0,
];
const L2_LEAD_B = [
  81, 0, 0, 83, 0, 81, 79, 0, 76, 0, 79, 81, 83, 0, 0, 0,
  88, 0, 86, 0, 83, 0, 81, 79, 76, 0, 79, 0, 74, 0, 76, 0,
];
const L2_STAB = [
  52, 0, 0, 52, 0, 0, 55, 0, 0, 0, 57, 0, 0, 0, 55, 0,
  52, 0, 0, 52, 0, 0, 59, 0, 0, 0, 57, 0, 55, 0, 59, 0,
];
const L2_DRUMS_A = [
  'KC', 'H', 'O', 'H', 'KS', 'H', 'O', 'g', 'K', 'H', 'O', 'H', 'KS', 'H', 'O', 'H',
  'K', 'H', 'O', 'H', 'KS', 'H', 'O', 'g', 'K', 'H', 'KO', 'H', 'KS', 'g', 'T', 'O',
];
const L2_DRUMS_B = [
  'KC', 'H', 'O', 'H', 'KS', 'H', 'O', 'g', 'K', 'H', 'KO', 'H', 'KS', 'H', 'O', 'g',
  'K', 'H', 'O', 'H', 'KS', 'H', 'O', 'g', 'K', 'S', 'KO', 'H', 'S', 'T', 'T', 'KT',
];

const L3_BASS_A = [
  36, 0, 36, 36, 0, 0, 37, 0, 36, 0, 36, 36, 43, 0, 42, 0,
  36, 0, 36, 36, 0, 0, 37, 36, 39, 0, 37, 0, 36, 0, 34, 0,
];
const L3_BASS_B = [
  36, 36, 48, 0, 37, 37, 49, 0, 36, 36, 48, 0, 43, 42, 39, 37,
  36, 36, 48, 0, 42, 0, 43, 0, 48, 0, 46, 0, 43, 42, 37, 36,
];
const L3_LEAD_A = [
  60, 0, 0, 0, 61, 0, 60, 0, 0, 0, 67, 0, 66, 0, 61, 0,
  60, 0, 0, 63, 61, 0, 60, 0, 0, 0, 58, 0, 60, 0, 0, 0,
];
const L3_LEAD_B = [
  72, 0, 73, 0, 72, 0, 67, 0, 72, 0, 75, 0, 73, 72, 67, 0,
  72, 0, 73, 75, 78, 0, 75, 0, 73, 0, 72, 67, 66, 0, 61, 0,
];
const L3_STAB = [
  48, 0, 0, 0, 49, 0, 0, 0, 48, 0, 0, 0, 54, 0, 55, 0,
  48, 0, 0, 0, 49, 0, 0, 0, 51, 0, 49, 0, 48, 0, 0, 0,
];
const L3_DRUMS_A = [
  'KC', 'H', 'M', 'H', 'SM', 'H', 'K', 'H', 'K', 'H', 'M', 'H', 'SM', 'H', 'KO', 'H',
  'K', 'H', 'M', 'H', 'SM', 'H', 'K', 'M', 'K', 'T', 'M', 'T', 'SM', 'T', 'T', 'KT',
];
const L3_DRUMS_B = [
  'KC', 'K', 'M', 'H', 'SM', 'K', 'K', 'M', 'K', 'K', 'M', 'H', 'SM', 'K', 'KO', 'M',
  'KC', 'K', 'M', 'K', 'SM', 'K', 'T', 'M', 'K', 'T', 'SM', 'T', 'S', 'M', 'KT', 'KSC',
];

const L4_BASS_A = [
  33, 33, 33, 45, 33, 33, 33, 45, 29, 29, 29, 41, 29, 29, 29, 41,
  31, 31, 31, 43, 31, 31, 31, 43, 28, 28, 40, 28, 31, 31, 43, 31,
];
const L4_BASS_B = [
  33, 33, 45, 33, 36, 36, 48, 36, 38, 38, 50, 38, 36, 36, 48, 36,
  29, 29, 41, 29, 31, 31, 43, 31, 33, 33, 45, 43, 40, 38, 36, 33,
];
const L4_LEAD_A = [
  69, 0, 72, 0, 76, 0, 74, 72, 69, 0, 0, 72, 74, 0, 72, 0,
  79, 0, 76, 0, 74, 0, 72, 0, 76, 0, 74, 72, 71, 0, 69, 0,
];
const L4_LEAD_B = [
  81, 0, 84, 0, 88, 0, 86, 84, 81, 0, 79, 81, 84, 0, 81, 0,
  86, 0, 84, 81, 79, 0, 76, 79, 81, 0, 79, 76, 74, 72, 76, 0,
];
const L4_STAB = [
  45, 0, 0, 0, 45, 0, 0, 0, 41, 0, 0, 0, 41, 0, 0, 0,
  43, 0, 0, 0, 43, 0, 0, 0, 40, 0, 0, 0, 43, 0, 45, 0,
];
const L4_DRUMS_A = [
  'KC', 'O', 'K', 'O', 'SO', 'K', 'K', 'O', 'KO', 'O', 'K', 'O', 'SO', 'K', 'KO', 'O',
  'KO', 'O', 'K', 'O', 'SO', 'K', 'K', 'O', 'KO', 'O', 'K', 'O', 'S', 'T', 'S', 'KT',
];
const L4_DRUMS_B = [
  'KC', 'O', 'KC', 'O', 'SC', 'K', 'KO', 'O', 'KC', 'K', 'KO', 'O', 'SC', 'K', 'KO', 'O',
  'KC', 'K', 'KO', 'O', 'SC', 'K', 'KO', 'O', 'K', 'S', 'K', 'S', 'T', 'T', 'KT', 'KSC',
];

const EL_BASS_A = [
  0, 42, 0, 42, 0, 42, 45, 42, 0, 42, 0, 42, 0, 47, 45, 42,
  0, 38, 0, 38, 0, 40, 0, 40, 0, 42, 0, 45, 47, 49, 47, 45,
];
const EL_BASS_B = [
  0, 42, 54, 42, 0, 42, 54, 45, 0, 47, 59, 47, 0, 45, 57, 45,
  0, 38, 50, 38, 0, 40, 52, 40, 0, 42, 54, 49, 47, 45, 44, 42,
];
const EL_LEAD_A = [
  66, 69, 73, 78, 73, 69, 66, 73, 66, 69, 73, 78, 81, 78, 73, 69,
  62, 66, 69, 74, 64, 68, 71, 76, 66, 69, 73, 78, 76, 73, 71, 69,
];
const EL_LEAD_B = [
  78, 81, 85, 90, 85, 81, 78, 85, 76, 80, 83, 88, 83, 80, 76, 80,
  74, 78, 81, 86, 76, 80, 83, 88, 78, 81, 85, 90, 88, 85, 81, 78,
];
const EL_STAB = [
  54, 0, 0, 0, 0, 0, 0, 0, 57, 0, 0, 0, 0, 0, 56, 0,
  50, 0, 0, 0, 52, 0, 0, 0, 54, 0, 0, 0, 57, 0, 56, 0,
];
const EL_DRUMS_A = [
  'KC', 'H', 'O', 'H', 'KH', 'H', 'O', 'H', 'K', 'H', 'O', 'H', 'KS', 'H', 'O', 'H',
  'K', 'H', 'O', 'H', 'KH', 'H', 'O', 'H', 'K', 'H', 'KO', 'H', 'KS', 'H', 'M', 'H',
];
const EL_DRUMS_B = [
  'KC', 'H', 'O', 'H', 'KS', 'H', 'O', 'H', 'K', 'H', 'O', 'H', 'KS', 'H', 'O', 'H',
  'K', 'H', 'O', 'H', 'KS', 'H', 'O', 'M', 'K', 'S', 'K', 'S', 'S', 'M', 'KT', 'KS',
];

const L5_BASS_A = [
  43, 43, 0, 43, 55, 0, 50, 0, 39, 39, 0, 39, 51, 0, 46, 0,
  36, 36, 0, 36, 48, 0, 43, 0, 38, 38, 0, 38, 50, 48, 46, 45,
];
const L5_BASS_B = [
  43, 55, 43, 50, 46, 50, 55, 50, 39, 51, 39, 46, 43, 46, 51, 46,
  36, 48, 36, 43, 39, 43, 48, 43, 38, 50, 48, 46, 45, 42, 38, 42,
];
const L5_LEAD_A = [
  67, 0, 70, 74, 79, 0, 78, 74, 75, 0, 74, 70, 67, 0, 0, 0,
  72, 0, 75, 79, 75, 72, 70, 0, 74, 0, 78, 0, 81, 0, 78, 0,
];
const L5_LEAD_B = [
  79, 0, 82, 86, 91, 0, 90, 86, 87, 0, 86, 82, 79, 0, 82, 0,
  84, 0, 87, 86, 84, 82, 79, 0, 86, 0, 90, 86, 81, 78, 74, 0,
];
const L5_STAB = [
  55, 0, 0, 0, 55, 0, 0, 0, 51, 0, 0, 0, 51, 0, 0, 0,
  48, 0, 0, 0, 48, 0, 0, 0, 50, 0, 50, 0, 54, 0, 50, 0,
];
const L5_DRUMS_A = [
  'KC', 'H', 'K', 'H', 'SH', 'H', 'KO', 'H', 'KH', 'H', 'K', 'H', 'SH', 'H', 'KO', 'g',
  'KC', 'H', 'K', 'H', 'SH', 'H', 'KO', 'H', 'K', 'T', 'K', 'T', 'ST', 'T', 'T', 'KT',
];
const L5_DRUMS_B = [
  'KC', 'K', 'K', 'H', 'SM', 'K', 'KO', 'H', 'KC', 'K', 'K', 'H', 'SM', 'K', 'KO', 'g',
  'KC', 'K', 'K', 'H', 'SM', 'K', 'KO', 'M', 'K', 'T', 'S', 'T', 'S', 'T', 'KT', 'KSC',
];

const BOSS_BASS_A = [
  33, 33, 45, 34, 33, 39, 33, 36, 33, 33, 45, 44, 40, 39, 36, 34,
  33, 33, 45, 34, 39, 40, 45, 48, 45, 44, 40, 39, 36, 39, 40, 44,
];
const BOSS_BASS_B = [
  33, 45, 34, 46, 33, 45, 39, 45, 33, 45, 48, 45, 44, 40, 39, 36,
  33, 33, 45, 46, 48, 51, 52, 48, 45, 44, 40, 39, 36, 34, 33, 39,
];
const BOSS_LEAD_A = [
  69, 72, 75, 76, 75, 72, 70, 69, 81, 80, 76, 75, 72, 70, 69, 64,
  69, 75, 76, 81, 80, 76, 75, 72, 81, 84, 83, 81, 80, 76, 75, 72,
];
const BOSS_LEAD_B = [
  81, 84, 87, 88, 87, 84, 82, 81, 93, 92, 88, 87, 84, 82, 81, 76,
  81, 87, 88, 93, 92, 88, 87, 84, 93, 92, 88, 87, 84, 81, 76, 75,
];
const BOSS_STAB = [
  45, 0, 46, 0, 45, 0, 51, 0, 45, 0, 52, 0, 51, 0, 48, 46,
  45, 0, 46, 0, 51, 0, 52, 0, 57, 0, 52, 0, 51, 0, 48, 46,
];
const BOSS_DRUMS_A = [
  'KC', 'K', 'KH', 'g', 'SM', 'K', 'KO', 'g', 'KH', 'K', 'KM', 'g', 'SM', 'K', 'KO', 'g',
  'KC', 'K', 'KH', 'K', 'SM', 'K', 'KO', 'K', 'KH', 'S', 'KM', 'S', 'S', 'S', 'KT', 'KS',
];
const BOSS_DRUMS_B = [
  'KC', 'K', 'KM', 'K', 'SM', 'K', 'KO', 'K', 'KC', 'K', 'KM', 'K', 'SM', 'K', 'KO', 'K',
  'KC', 'K', 'KM', 'K', 'SM', 'K', 'KO', 'K', 'SM', 'S', 'SM', 'S', 'KS', 'KS', 'KT', 'KSC',
];

const SW_BASS_A = [
  33, 33, 45, 33, 33, 45, 33, 45, 33, 33, 45, 33, 33, 45, 36, 38,
  41, 41, 53, 41, 41, 53, 41, 53, 41, 41, 53, 41, 41, 43, 41, 40,
];
const SW_BASS_B = [
  36, 36, 48, 36, 36, 48, 36, 48, 36, 36, 48, 36, 36, 48, 43, 40,
  43, 43, 55, 43, 43, 55, 43, 55, 43, 43, 55, 43, 43, 40, 38, 36,
];
const SW_LEAD_A = [
  76, 0, 0, 72, 0, 76, 79, 0, 76, 0, 72, 0, 71, 0, 69, 0,
  72, 0, 0, 69, 0, 72, 76, 0, 74, 0, 72, 0, 69, 0, 67, 0,
];
const SW_LEAD_B = [
  79, 0, 0, 76, 0, 79, 84, 0, 83, 0, 79, 0, 76, 0, 74, 0,
  76, 0, 74, 0, 71, 0, 74, 0, 76, 0, 74, 71, 69, 0, 71, 0,
];
const SW_ARP_A = [
  69, 72, 76, 81, 76, 72, 69, 72, 76, 81, 79, 76, 72, 76, 79, 76,
  65, 69, 72, 77, 72, 69, 65, 69, 72, 76, 72, 69, 65, 69, 72, 76,
];
const SW_DRUMS_A = [
  'KC', 'H', 'H', 'H', 'SH', 'H', 'O', 'H', 'KH', 'H', 'KH', 'H', 'SH', 'H', 'O', 'H',
  'KH', 'H', 'H', 'H', 'SH', 'H', 'O', 'H', 'KH', 'H', 'KH', 'H', 'SH', 'H', 'O', 'H',
];
const SW_DRUMS_B = [
  'KH', 'H', 'H', 'H', 'SH', 'H', 'O', 'H', 'KH', 'H', 'KH', 'H', 'SH', 'H', 'O', 'H',
  'KH', 'H', 'H', 'H', 'SH', 'H', 'O', 'H', 'KH', 'H', 'KH', 'H', 'ST', 'T', 'T', 'KT',
];

export const TRACKS: Record<Exclude<MusicTrack, 'none'>, TrackPattern> = {
  title: {
    // 154 BPM Prodigy "Breathe / Firestarter" × Contra Hard Corps dark anthem (18 bars / ~28 sec)
    bpm: 154,
    bassA: TITLE_BASS_A,
    bassB: TITLE_BASS_B,
    acidAccent: [
      1, 0, 1, 1, 0, 0, 1, 1, 1, 0, 1, 0, 0, 1, 1, 0,
      1, 0, 1, 1, 1, 1, 1, 1, 0, 0, 1, 1, 1, 0, 1, 1,
    ],
    leadA: TITLE_LEAD_A,
    leadB: TITLE_LEAD_B,
    stab: TITLE_STAB,
    drumsA: TITLE_DRUMS_A,
    drumsB: TITLE_DRUMS_B,
    acidQ: 7.5,
    leadType: 'hoover',
    drive: 1.55,
    loopStart: 1,
    arrangement: ['intro', 'verseA', 'verseA2', 'chorusB', 'breakdown', 'buildup', 'solo', 'chorusB', 'outro'],
    sections: {
      intro: {
        bass: TITLE_BASS_A,
        stab: TITLE_STAB,
        drums: DRUMS_INTRO_PULSE,
        filterMult: 0.65,
        filterRampTo: 1.0,
      },
      verseA: {
        bass: TITLE_BASS_A,
        lead: TITLE_LEAD_A,
        stab: TITLE_STAB,
        drums: TITLE_DRUMS_A,
        filterMult: 1.0,
      },
      verseA2: {
        bass: TITLE_BASS_A,
        lead: TITLE_LEAD_A,
        counter: [
          72, 0, 0, 75, 0, 0, 79, 0, 72, 0, 0, 77, 0, 0, 75, 0,
          72, 0, 75, 0, 78, 0, 79, 0, 82, 0, 79, 0, 78, 75, 72, 0,
        ],
        stab: TITLE_STAB,
        drums: TITLE_DRUMS_A,
        filterMult: 1.08,
      },
      chorusB: {
        bass: TITLE_BASS_B,
        lead: TITLE_LEAD_B,
        stab: TITLE_STAB,
        drums: TITLE_DRUMS_B,
        filterMult: 1.2,
        intense: true,
      },
      breakdown: {
        bass: [
          36, 0, 0, 0, 36, 0, 39, 0, 41, 0, 0, 0, 42, 0, 43, 0,
          36, 0, 0, 0, 39, 0, 41, 0, 43, 0, 42, 0, 39, 0, 38, 0,
        ],
        counter: [
          60, 0, 67, 0, 63, 0, 66, 0, 65, 0, 67, 0, 70, 0, 67, 0,
          60, 0, 67, 0, 63, 0, 66, 0, 72, 0, 70, 0, 67, 0, 63, 0,
        ],
        padChords: [
          [48, 51, 55, 60],
          [46, 51, 54, 58],
        ],
        drums: DRUMS_BREAK_HALFTIME,
        acidAccent: ACCENT_SPARSE,
        filterMult: 0.62,
      },
      buildup: {
        bass: [
          36, 36, 48, 36, 39, 39, 51, 39, 41, 41, 53, 41, 42, 42, 54, 42,
          43, 43, 55, 43, 43, 46, 48, 51, 54, 55, 54, 51, 48, 46, 43, 42,
        ],
        counter: [
          60, 63, 66, 67, 63, 66, 67, 70, 66, 67, 70, 72, 67, 70, 72, 75,
          72, 75, 78, 79, 75, 78, 79, 82, 78, 79, 82, 84, 82, 79, 78, 75,
        ],
        drums: DRUMS_BUILDUP_ROLL,
        acidAccent: ACCENT_BUILD,
        filterMult: 0.65,
        filterRampTo: 1.32,
      },
      solo: {
        bass: TITLE_BASS_B,
        lead: [
          72, 75, 78, 79, 0, 82, 79, 78, 75, 78, 79, 82, 84, 0, 82, 79,
          78, 75, 72, 75, 78, 79, 82, 84, 87, 84, 82, 79, 78, 75, 72, 0,
        ],
        leadType: 'fm_shred',
        stab: TITLE_STAB,
        drums: TITLE_DRUMS_B,
        filterMult: 1.25,
        intense: true,
      },
      outro: {
        bass: TITLE_BASS_B,
        lead: TITLE_LEAD_A,
        stab: TITLE_STAB,
        drums: TITLE_DRUMS_B,
        filterMult: 1.1,
      },
    },
  },

  cutscene: {
    // 124 BPM dark industrial cyber-breakbeat (8 bars / ~15.5 sec brooding loop)
    bpm: 124,
    bassA: [
      35, 0, 35, 0, 38, 0, 35, 0, 36, 35, 0, 35, 0, 33, 35, 0,
      35, 0, 35, 38, 0, 41, 38, 0, 36, 35, 0, 33, 35, 0, 32, 0,
    ],
    bassB: [
      35, 35, 47, 0, 38, 0, 41, 38, 36, 0, 35, 0, 33, 35, 38, 0,
      35, 0, 47, 45, 41, 38, 36, 35, 33, 0, 35, 36, 38, 35, 33, 0,
    ],
    acidAccent: [
      1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0,
      1, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 1, 0, 1, 0,
    ],
    leadA: [
      47, 0, 0, 50, 0, 0, 48, 47, 0, 0, 0, 0, 45, 0, 47, 0,
      47, 0, 0, 53, 0, 50, 48, 0, 47, 0, 0, 0, 45, 47, 0, 0,
    ],
    leadB: [
      59, 0, 0, 62, 0, 60, 59, 0, 57, 0, 0, 59, 60, 59, 57, 0,
      59, 0, 62, 65, 0, 62, 60, 59, 57, 0, 59, 0, 56, 57, 59, 0,
    ],
    stab: [
      47, 0, 0, 0, 0, 0, 0, 0, 48, 0, 0, 0, 0, 0, 0, 0,
      47, 0, 0, 0, 0, 0, 50, 0, 0, 0, 0, 0, 45, 0, 0, 0,
    ],
    drumsA: [
      'KH', 'H', 'KH', 'H', 'SH', 'H', 'H', 'gH', 'KH', 'H', 'KO', 'H', 'SH', 'H', 'H', 'g',
      'KH', 'H', 'KH', 'H', 'SH', 'H', 'KH', 'g', 'KH', 'H', 'KO', 'H', 'SH', 'g', 'T', 'S',
    ],
    drumsB: [
      'KC', 'H', 'KH', 'g', 'SH', 'H', 'KH', 'gH', 'KH', 'H', 'KO', 'g', 'SH', 'H', 'KH', 'g',
      'KH', 'H', 'KH', 'g', 'SH', 'H', 'KO', 'g', 'KH', 'g', 'KH', 'H', 'S', 'T', 'S', 'KT',
    ],
    muffled: true,
    acidQ: 5.0,
    leadType: 'hoover',
    drive: 1.25,
  },

  level1: {
    // Stage 1: 152 BPM Night Cyber-Street Beat 'em Up — D Minor (24 bars / ~38 sec evolving track!)
    bpm: 152,
    bassA: L1_BASS_A,
    bassB: L1_BASS_B,
    acidAccent: [
      1, 0, 1, 0, 0, 1, 1, 0, 1, 0, 0, 1, 0, 0, 1, 1,
      1, 0, 1, 0, 1, 0, 1, 1, 0, 1, 0, 1, 1, 0, 1, 0,
    ],
    leadA: L1_LEAD_A,
    leadB: L1_LEAD_B,
    stab: L1_STAB,
    drumsA: L1_DRUMS_A,
    drumsB: L1_DRUMS_B,
    acidQ: 7.2,
    leadType: 'fm_shred',
    bassStyle: 'acid',
    stabChord: 'minor',
    drive: 1.55,
    loopStart: 1,
    arrangement: [
      'intro',
      'verse1',
      'verse2',
      'preChorus',
      'chorus1',
      'chorus2',
      'breakdown',
      'buildup',
      'solo1',
      'solo2',
      'chorus1',
      'turnaround',
    ],
    sections: {
      intro: {
        bass: L1_BASS_A,
        counter: [
          74, 0, 0, 0, 77, 0, 0, 0, 81, 0, 0, 0, 79, 0, 77, 0,
          74, 0, 0, 0, 77, 0, 81, 0, 84, 0, 81, 0, 79, 77, 74, 0,
        ],
        stab: L1_STAB,
        drums: DRUMS_INTRO_PULSE,
        filterMult: 0.68,
        filterRampTo: 1.05,
      },
      verse1: {
        bass: L1_BASS_A,
        lead: L1_LEAD_A,
        stab: L1_STAB,
        drums: L1_DRUMS_A,
        filterMult: 0.96,
      },
      verse2: {
        bass: L1_BASS_A,
        lead: [
          62, 0, 65, 69, 0, 72, 74, 0, 77, 0, 74, 72, 69, 0, 65, 0,
          67, 0, 69, 72, 0, 74, 77, 0, 81, 79, 77, 74, 72, 0, 69, 0,
        ],
        counter: [
          0, 0, 0, 0, 74, 0, 77, 0, 0, 0, 0, 0, 81, 0, 79, 0,
          0, 0, 0, 0, 79, 0, 81, 0, 0, 0, 84, 0, 81, 79, 77, 0,
        ],
        stab: L1_STAB,
        drums: L1_DRUMS_A,
        filterMult: 1.05,
      },
      preChorus: {
        // Harmonic lift: Bb -> C -> Gm -> A7
        bass: [
          34, 0, 46, 34, 0, 46, 34, 46, 36, 0, 48, 36, 0, 48, 36, 48,
          43, 0, 55, 43, 0, 43, 41, 40, 45, 0, 45, 45, 48, 45, 49, 45,
        ],
        lead: [
          70, 0, 74, 0, 77, 0, 74, 0, 72, 0, 76, 0, 79, 0, 76, 0,
          74, 0, 79, 0, 82, 0, 79, 77, 81, 0, 79, 77, 76, 0, 73, 0,
        ],
        stab: [
          46, 0, 0, 0, 46, 0, 0, 0, 48, 0, 0, 0, 48, 0, 0, 0,
          55, 0, 0, 0, 55, 0, 0, 0, 57, 0, 57, 0, 61, 0, 57, 0,
        ],
        drums: L1_DRUMS_A,
        filterMult: 0.95,
        filterRampTo: 1.25,
      },
      chorus1: {
        bass: L1_BASS_B,
        lead: L1_LEAD_B,
        stab: L1_STAB,
        drums: L1_DRUMS_B,
        filterMult: 1.18,
        intense: true,
      },
      chorus2: {
        bass: L1_BASS_B,
        lead: [
          74, 0, 77, 81, 0, 86, 0, 89, 86, 0, 84, 81, 77, 0, 79, 0,
          81, 84, 86, 0, 89, 86, 84, 81, 84, 0, 81, 77, 74, 72, 69, 0,
        ],
        counter: [
          62, 0, 65, 69, 0, 74, 0, 77, 74, 0, 72, 69, 65, 0, 67, 0,
          69, 72, 74, 0, 77, 74, 72, 69, 72, 0, 69, 65, 62, 60, 57, 0,
        ],
        stab: L1_STAB,
        drums: L1_DRUMS_B,
        filterMult: 1.24,
        intense: true,
      },
      breakdown: {
        // Dark neon back-alley half-time Gm -> F -> Bb -> A7
        bass: [
          43, 0, 0, 43, 0, 0, 46, 0, 41, 0, 0, 41, 0, 0, 45, 0,
          34, 0, 0, 34, 0, 0, 41, 0, 33, 0, 0, 33, 0, 45, 44, 43,
        ],
        counter: [
          79, 0, 74, 0, 70, 0, 74, 0, 77, 0, 72, 0, 69, 0, 72, 0,
          74, 0, 70, 0, 65, 0, 70, 0, 73, 0, 69, 0, 64, 0, 69, 0,
        ],
        padChords: [
          [55, 58, 62, 67],
          [53, 57, 60, 65],
        ],
        drums: DRUMS_BREAK_HALFTIME,
        acidAccent: ACCENT_SPARSE,
        filterMult: 0.58,
      },
      buildup: {
        bass: [
          38, 38, 50, 38, 38, 38, 50, 38, 41, 41, 53, 41, 43, 43, 55, 43,
          45, 45, 57, 45, 45, 45, 57, 45, 45, 48, 49, 50, 53, 55, 57, 50,
        ],
        counter: [
          62, 65, 69, 74, 65, 69, 74, 77, 69, 74, 77, 81, 74, 77, 81, 86,
          73, 76, 81, 85, 76, 81, 85, 88, 81, 85, 88, 90, 88, 85, 81, 76,
        ],
        drums: DRUMS_BUILDUP_ROLL,
        acidAccent: ACCENT_BUILD,
        filterMult: 0.62,
        filterRampTo: 1.32,
      },
      solo1: {
        // Screaming 16-bit cyber-guitar shred solo!
        bass: L1_BASS_B,
        lead: [
          74, 77, 81, 77, 84, 81, 77, 74, 79, 81, 84, 86, 0, 84, 81, 79,
          77, 74, 72, 74, 77, 79, 81, 84, 86, 0, 84, 81, 79, 77, 74, 0,
        ],
        leadType: 'guitar_lead',
        stab: L1_STAB,
        drums: L1_DRUMS_B,
        filterMult: 1.22,
        intense: true,
      },
      solo2: {
        bass: L1_BASS_B,
        lead: [
          86, 84, 81, 84, 86, 89, 86, 84, 81, 84, 86, 89, 91, 89, 86, 84,
          81, 79, 77, 74, 77, 81, 84, 86, 89, 0, 86, 84, 81, 77, 74, 0,
        ],
        leadType: 'guitar_lead',
        stab: L1_STAB,
        drums: L1_DRUMS_B,
        filterMult: 1.28,
        intense: true,
      },
      turnaround: {
        bass: L1_BASS_A,
        lead: L1_LEAD_A,
        stab: L1_STAB,
        drums: L1_DRUMS_B,
        filterMult: 1.12,
      },
    },
  },

  level2: {
    // Stage 2: 128 BPM Sunny Daytime Market — Streets of Rage 2 Slap-Funk & House (20 bars / ~37.5 sec!)
    bpm: 128,
    bassA: L2_BASS_A,
    bassB: L2_BASS_B,
    acidAccent: [
      1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 1, 0, 0,
      1, 0, 1, 0, 0, 0, 1, 0, 1, 0, 0, 1, 0, 0, 1, 0,
    ],
    leadA: L2_LEAD_A,
    leadB: L2_LEAD_B,
    stab: L2_STAB,
    drumsA: L2_DRUMS_A,
    drumsB: L2_DRUMS_B,
    acidQ: 4.5,
    leadType: 'funk_brass',
    bassStyle: 'slap_funk',
    stabChord: 'major7',
    drive: 1.25,
    loopStart: 1,
    arrangement: [
      'intro',
      'verse1',
      'verse2',
      'chorus1',
      'chorus2',
      'breakdown',
      'buildup',
      'solo1',
      'chorus1',
      'turnaround',
    ],
    sections: {
      intro: {
        bass: L2_BASS_A,
        stab: L2_STAB,
        drums: DRUMS_FUNK_BREAK,
        padChords: [
          [52, 55, 59, 62],
          [57, 61, 64, 67],
        ],
        filterMult: 0.78,
        filterRampTo: 1.05,
      },
      verse1: {
        bass: L2_BASS_A,
        lead: L2_LEAD_A,
        stab: L2_STAB,
        drums: L2_DRUMS_A,
        filterMult: 1.0,
      },
      verse2: {
        bass: L2_BASS_A,
        lead: [
          76, 0, 79, 0, 81, 0, 79, 76, 74, 0, 71, 0, 74, 76, 0, 0,
          79, 0, 83, 0, 81, 79, 76, 0, 74, 0, 76, 74, 71, 0, 69, 0,
        ],
        counter: [
          0, 0, 88, 0, 0, 86, 0, 0, 0, 0, 83, 0, 0, 86, 88, 0,
          0, 0, 91, 0, 0, 88, 0, 0, 0, 0, 86, 0, 83, 0, 81, 0,
        ],
        stab: L2_STAB,
        drums: L2_DRUMS_A,
        filterMult: 1.08,
      },
      chorus1: {
        bass: L2_BASS_B,
        lead: L2_LEAD_B,
        stab: L2_STAB,
        padChords: [
          [57, 61, 64, 67],
          [52, 55, 59, 62],
        ],
        drums: L2_DRUMS_B,
        filterMult: 1.18,
        intense: true,
      },
      chorus2: {
        bass: L2_BASS_B,
        lead: [
          83, 0, 0, 86, 0, 83, 81, 0, 79, 0, 81, 83, 86, 0, 0, 0,
          88, 0, 91, 0, 88, 86, 83, 0, 81, 0, 79, 76, 74, 0, 76, 0,
        ],
        counter: [
          71, 0, 0, 74, 0, 71, 69, 0, 67, 0, 69, 71, 74, 0, 0, 0,
          76, 0, 79, 0, 76, 74, 71, 0, 69, 0, 67, 64, 62, 0, 64, 0,
        ],
        stab: L2_STAB,
        drums: L2_DRUMS_B,
        filterMult: 1.22,
        intense: true,
      },
      breakdown: {
        // Sunny daytime jazzy Cmaj7 -> Bm7 -> Am7 -> B7 slap-bass & Rhodes groove!
        bass: [
          48, 0, 0, 48, 60, 0, 55, 0, 47, 0, 0, 47, 59, 0, 54, 0,
          45, 0, 0, 45, 57, 0, 52, 0, 47, 0, 54, 47, 57, 0, 54, 50,
        ],
        counter: [
          76, 0, 79, 0, 83, 0, 79, 0, 74, 0, 78, 0, 81, 0, 78, 0,
          72, 0, 76, 0, 79, 0, 76, 0, 74, 0, 78, 0, 81, 0, 78, 0,
        ],
        padChords: [
          [48, 52, 55, 59],
          [45, 48, 52, 55],
        ],
        drums: DRUMS_FUNK_BREAK,
        filterMult: 0.72,
      },
      buildup: {
        bass: [
          48, 0, 60, 48, 0, 55, 57, 59, 45, 0, 57, 45, 0, 52, 55, 57,
          47, 0, 59, 47, 47, 59, 47, 54, 47, 50, 52, 54, 57, 59, 54, 47,
        ],
        stab: [
          48, 0, 48, 0, 0, 0, 48, 0, 45, 0, 45, 0, 0, 0, 45, 0,
          47, 0, 47, 0, 47, 0, 47, 0, 47, 47, 0, 47, 50, 0, 54, 0,
        ],
        drums: DRUMS_BUILDUP_ROLL,
        filterMult: 0.75,
        filterRampTo: 1.25,
      },
      solo1: {
        // Funky 90s FM synth-lead solo in E Dorian!
        bass: L2_BASS_A,
        lead: [
          76, 79, 81, 83, 0, 86, 83, 81, 79, 76, 74, 76, 79, 0, 81, 0,
          83, 86, 88, 86, 83, 81, 79, 76, 79, 81, 83, 81, 79, 76, 74, 0,
        ],
        leadType: 'fm_shred',
        stab: L2_STAB,
        drums: L2_DRUMS_B,
        filterMult: 1.2,
        intense: true,
      },
      turnaround: {
        bass: L2_BASS_A,
        lead: L2_LEAD_A,
        stab: L2_STAB,
        drums: L2_DRUMS_B,
        filterMult: 1.08,
      },
    },
  },

  sky_raid: {
    // Stage 3: 162 BPM Rooftop Quadcopter Assault — High-Voltage Aero-Electro Breakbeat (B Minor, 22 bars / ~32.6s!)
    bpm: 162,
    bassA: [
      35, 0, 47, 35, 0, 38, 42, 0, 35, 0, 47, 35, 45, 0, 42, 38,
      31, 0, 43, 31, 0, 33, 45, 0, 35, 0, 47, 45, 42, 40, 38, 37,
    ],
    bassB: [
      35, 47, 35, 38, 42, 54, 42, 38, 31, 43, 31, 35, 33, 45, 33, 37,
      38, 50, 38, 42, 40, 52, 40, 42, 45, 57, 45, 42, 40, 38, 37, 35,
    ],
    acidAccent: [
      1, 0, 1, 0, 0, 1, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0,
      1, 0, 1, 0, 0, 1, 1, 0, 1, 0, 1, 1, 1, 0, 1, 0,
    ],
    leadA: [
      71, 0, 74, 78, 0, 0, 83, 0, 81, 0, 78, 74, 71, 0, 0, 0,
      79, 0, 78, 74, 76, 0, 81, 0, 78, 0, 74, 71, 73, 0, 78, 0,
    ],
    leadB: [
      83, 0, 86, 90, 0, 88, 86, 83, 79, 0, 83, 86, 81, 0, 85, 0,
      86, 0, 90, 88, 86, 0, 83, 81, 85, 0, 83, 81, 78, 0, 83, 0,
    ],
    stab: [
      47, 0, 0, 47, 0, 0, 50, 0, 47, 0, 0, 0, 54, 0, 52, 0,
      43, 0, 0, 43, 0, 0, 45, 0, 47, 0, 0, 50, 52, 0, 54, 0,
    ],
    drumsA: [
      'KC', 'H', 'KH', 'O', 'SH', 'H', 'KH', 'gH', 'KO', 'H', 'KH', 'H', 'SH', 'H', 'KO', 'g',
      'KH', 'H', 'KH', 'O', 'SH', 'H', 'KO', 'H', 'KH', 'g', 'KH', 'H', 'SH', 'T', 'S', 'KT',
    ],
    drumsB: [
      'KC', 'H', 'KH', 'O', 'SM', 'K', 'KO', 'gH', 'KH', 'H', 'KH', 'g', 'SM', 'K', 'KO', 'g',
      'KC', 'H', 'KH', 'O', 'SM', 'K', 'KO', 'M', 'KH', 'S', 'KH', 'S', 'S', 'T', 'KT', 'KSC',
    ],
    acidQ: 7.4,
    leadType: 'arp_pulse',
    bassStyle: 'acid',
    stabChord: 'power5',
    drive: 1.5,
    loopStart: 1,
    arrangement: [
      'takeoff',
      'skyVerse1',
      'skyVerse2',
      'altitudeLift',
      'skyChorus1',
      'skyChorus2',
      'cloudBreak',
      'voltageBuild',
      'electricSolo1',
      'electricSolo2',
      'turnaround',
    ],
    sections: {
      takeoff: {
        // Rotor spin-up & electric skyline launch
        bass: [
          35, 0, 47, 35, 0, 35, 47, 35, 35, 0, 47, 35, 0, 38, 42, 45,
          31, 0, 43, 31, 0, 33, 45, 33, 35, 35, 47, 35, 42, 45, 47, 45,
        ],
        counter: [
          71, 74, 78, 83, 78, 74, 71, 78, 71, 74, 78, 83, 86, 83, 78, 74,
          67, 71, 74, 79, 69, 73, 76, 81, 71, 74, 78, 83, 81, 78, 76, 74,
        ],
        drums: DRUMS_INTRO_PULSE,
        filterMult: 0.65,
        filterRampTo: 1.08,
      },
      skyVerse1: {
        bass: [
          35, 0, 47, 35, 0, 38, 42, 0, 35, 0, 47, 35, 45, 0, 42, 38,
          31, 0, 43, 31, 0, 33, 45, 0, 35, 0, 47, 45, 42, 40, 38, 37,
        ],
        lead: [
          71, 0, 74, 78, 0, 0, 83, 0, 81, 0, 78, 74, 71, 0, 0, 0,
          79, 0, 78, 74, 76, 0, 81, 0, 78, 0, 74, 71, 73, 0, 78, 0,
        ],
        stab: [
          47, 0, 0, 47, 0, 0, 50, 0, 47, 0, 0, 0, 54, 0, 52, 0,
          43, 0, 0, 43, 0, 0, 45, 0, 47, 0, 0, 50, 52, 0, 54, 0,
        ],
        drums: [
          'KC', 'H', 'KH', 'O', 'SH', 'H', 'KH', 'gH', 'KO', 'H', 'KH', 'H', 'SH', 'H', 'KO', 'g',
          'KH', 'H', 'KH', 'O', 'SH', 'H', 'KO', 'H', 'KH', 'g', 'KH', 'H', 'SH', 'T', 'S', 'KT',
        ],
        leadType: 'fm_shred',
        filterMult: 1.0,
      },
      skyVerse2: {
        bass: [
          35, 0, 47, 35, 0, 38, 42, 0, 35, 0, 47, 35, 45, 0, 42, 38,
          31, 0, 43, 31, 0, 33, 45, 0, 35, 0, 47, 45, 42, 40, 38, 37,
        ],
        lead: [
          71, 0, 74, 78, 0, 81, 83, 0, 86, 0, 83, 81, 78, 0, 74, 0,
          79, 0, 83, 81, 78, 0, 81, 85, 83, 0, 81, 78, 76, 0, 78, 0,
        ],
        counter: [
          83, 0, 0, 86, 0, 0, 90, 0, 83, 0, 0, 86, 0, 0, 81, 0,
          79, 0, 0, 83, 81, 0, 0, 85, 83, 0, 86, 0, 85, 0, 83, 0,
        ],
        stab: [
          47, 0, 0, 47, 0, 0, 50, 0, 47, 0, 0, 0, 54, 0, 52, 0,
          43, 0, 0, 43, 0, 0, 45, 0, 47, 0, 0, 50, 52, 0, 54, 0,
        ],
        drums: [
          'KC', 'H', 'KH', 'O', 'SH', 'H', 'KH', 'gH', 'KO', 'H', 'KH', 'H', 'SH', 'H', 'KO', 'g',
          'KH', 'H', 'KH', 'O', 'SH', 'H', 'KO', 'H', 'KH', 'g', 'KH', 'H', 'SH', 'T', 'S', 'KT',
        ],
        leadType: 'fm_shred',
        filterMult: 1.08,
      },
      altitudeLift: {
        // Soaring G -> A -> Em -> F#7 climb!
        bass: [
          31, 31, 43, 31, 31, 43, 35, 31, 33, 33, 45, 33, 33, 45, 37, 33,
          40, 40, 52, 40, 40, 52, 43, 40, 42, 42, 54, 42, 42, 46, 49, 42,
        ],
        lead: [
          79, 0, 83, 0, 86, 0, 83, 0, 81, 0, 85, 0, 88, 0, 85, 0,
          83, 0, 86, 0, 91, 0, 88, 86, 85, 0, 82, 0, 90, 0, 85, 0,
        ],
        stab: [
          43, 0, 0, 0, 43, 0, 0, 0, 45, 0, 0, 0, 45, 0, 0, 0,
          52, 0, 0, 0, 52, 0, 0, 0, 54, 0, 54, 0, 58, 0, 54, 0,
        ],
        drums: [
          'KC', 'H', 'KH', 'O', 'SH', 'H', 'KH', 'gH', 'KO', 'H', 'KH', 'H', 'SH', 'H', 'KO', 'g',
          'KH', 'H', 'KH', 'O', 'SH', 'H', 'KO', 'H', 'KH', 'g', 'KH', 'H', 'SH', 'T', 'S', 'KT',
        ],
        leadType: 'arp_pulse',
        filterMult: 0.96,
        filterRampTo: 1.26,
      },
      skyChorus1: {
        bass: [
          35, 47, 35, 38, 42, 54, 42, 38, 31, 43, 31, 35, 33, 45, 33, 37,
          38, 50, 38, 42, 40, 52, 40, 42, 45, 57, 45, 42, 40, 38, 37, 35,
        ],
        lead: [
          83, 0, 86, 90, 0, 88, 86, 83, 79, 0, 83, 86, 81, 0, 85, 0,
          86, 0, 90, 88, 86, 0, 83, 81, 85, 0, 83, 81, 78, 0, 83, 0,
        ],
        stab: [
          47, 0, 0, 47, 0, 0, 50, 0, 43, 0, 0, 0, 45, 0, 0, 0,
          50, 0, 0, 50, 0, 0, 52, 0, 57, 0, 54, 0, 52, 0, 54, 0,
        ],
        drums: [
          'KC', 'H', 'KH', 'O', 'SM', 'K', 'KO', 'gH', 'KH', 'H', 'KH', 'g', 'SM', 'K', 'KO', 'g',
          'KC', 'H', 'KH', 'O', 'SM', 'K', 'KO', 'M', 'KH', 'S', 'KH', 'S', 'S', 'T', 'KT', 'KSC',
        ],
        leadType: 'guitar_lead',
        filterMult: 1.2,
        intense: true,
      },
      skyChorus2: {
        bass: [
          35, 47, 35, 38, 42, 54, 42, 38, 31, 43, 31, 35, 33, 45, 33, 37,
          38, 50, 38, 42, 40, 52, 40, 42, 45, 57, 45, 42, 40, 38, 37, 35,
        ],
        lead: [
          83, 0, 86, 90, 0, 93, 90, 86, 83, 0, 86, 91, 88, 0, 85, 0,
          86, 0, 90, 93, 91, 0, 88, 86, 85, 0, 83, 81, 78, 81, 83, 0,
        ],
        counter: [
          71, 74, 78, 83, 78, 74, 71, 78, 67, 71, 74, 79, 69, 73, 76, 81,
          74, 78, 81, 86, 76, 79, 83, 88, 81, 85, 88, 85, 81, 78, 76, 74,
        ],
        stab: [
          47, 0, 0, 47, 0, 0, 50, 0, 43, 0, 0, 0, 45, 0, 0, 0,
          50, 0, 0, 50, 0, 0, 52, 0, 57, 0, 54, 0, 52, 0, 54, 0,
        ],
        drums: [
          'KC', 'H', 'KH', 'O', 'SM', 'K', 'KO', 'gH', 'KH', 'H', 'KH', 'g', 'SM', 'K', 'KO', 'g',
          'KC', 'H', 'KH', 'O', 'SM', 'K', 'KO', 'M', 'KH', 'S', 'KH', 'S', 'S', 'T', 'KT', 'KSC',
        ],
        leadType: 'guitar_lead',
        filterMult: 1.26,
        intense: true,
      },
      cloudBreak: {
        // High-altitude rooftop glide over buzzing power lines: Em9 -> Bm9 -> Gmaj7 -> F#7!
        bass: [
          40, 0, 0, 0, 0, 0, 43, 0, 35, 0, 0, 0, 0, 0, 38, 0,
          31, 0, 0, 0, 0, 0, 35, 0, 42, 0, 0, 0, 42, 0, 45, 0,
        ],
        counter: [
          76, 0, 79, 0, 83, 0, 79, 0, 74, 0, 78, 0, 83, 0, 78, 0,
          74, 0, 79, 0, 83, 0, 79, 0, 78, 0, 82, 0, 85, 0, 82, 0,
        ],
        padChords: [
          [52, 55, 59, 64],
          [47, 50, 54, 59],
        ],
        drums: DRUMS_TECHNO_FLOAT,
        acidAccent: ACCENT_SPARSE,
        filterMult: 0.56,
      },
      voltageBuild: {
        // High-voltage transformer charge buildup!
        bass: [
          35, 35, 47, 35, 38, 38, 50, 38, 40, 40, 52, 40, 42, 42, 54, 42,
          45, 45, 57, 45, 47, 47, 59, 47, 47, 50, 52, 54, 57, 59, 54, 47,
        ],
        lead: [
          71, 74, 78, 83, 74, 78, 83, 86, 78, 83, 86, 90, 83, 86, 90, 93,
          83, 86, 90, 95, 86, 90, 95, 93, 90, 93, 95, 93, 90, 86, 83, 81,
        ],
        drums: DRUMS_BUILDUP_ROLL,
        acidAccent: ACCENT_BUILD,
        leadType: 'arp_pulse',
        filterMult: 0.65,
        filterRampTo: 1.35,
      },
      electricSolo1: {
        // Crackling high-voltage arcade electro-synth solo!
        bass: [
          35, 47, 35, 38, 42, 54, 42, 38, 31, 43, 31, 35, 33, 45, 33, 37,
          38, 50, 38, 42, 40, 52, 40, 42, 45, 57, 45, 42, 40, 38, 37, 35,
        ],
        lead: [
          83, 86, 90, 86, 83, 81, 83, 86, 91, 90, 86, 83, 81, 85, 88, 85,
          86, 90, 93, 90, 88, 86, 83, 86, 85, 83, 81, 78, 81, 83, 86, 0,
        ],
        leadType: 'siren',
        stab: [
          47, 0, 0, 47, 0, 0, 50, 0, 43, 0, 0, 0, 45, 0, 0, 0,
          50, 0, 0, 50, 0, 0, 52, 0, 57, 0, 54, 0, 52, 0, 54, 0,
        ],
        drums: [
          'KC', 'H', 'KH', 'O', 'SM', 'K', 'KO', 'gH', 'KH', 'H', 'KH', 'g', 'SM', 'K', 'KO', 'g',
          'KC', 'H', 'KH', 'O', 'SM', 'K', 'KO', 'M', 'KH', 'S', 'KH', 'S', 'S', 'T', 'KT', 'KSC',
        ],
        filterMult: 1.26,
        intense: true,
      },
      electricSolo2: {
        bass: [
          35, 47, 35, 38, 42, 54, 42, 38, 31, 43, 31, 35, 33, 45, 33, 37,
          38, 50, 38, 42, 40, 52, 40, 42, 45, 57, 45, 42, 40, 38, 37, 35,
        ],
        lead: [
          90, 86, 83, 86, 90, 93, 95, 93, 91, 88, 86, 83, 85, 88, 90, 88,
          86, 83, 81, 78, 81, 83, 86, 90, 93, 90, 88, 86, 85, 83, 81, 0,
        ],
        leadType: 'fm_shred',
        stab: [
          47, 0, 0, 47, 0, 0, 50, 0, 43, 0, 0, 0, 45, 0, 0, 0,
          50, 0, 0, 50, 0, 0, 52, 0, 57, 0, 54, 0, 52, 0, 54, 0,
        ],
        drums: [
          'KC', 'H', 'KH', 'O', 'SM', 'K', 'KO', 'gH', 'KH', 'H', 'KH', 'g', 'SM', 'K', 'KO', 'g',
          'KC', 'H', 'KH', 'O', 'SM', 'K', 'KO', 'M', 'KH', 'S', 'KH', 'S', 'S', 'T', 'KT', 'KSC',
        ],
        filterMult: 1.3,
        intense: true,
      },
      turnaround: {
        bass: [
          35, 0, 47, 35, 0, 38, 42, 0, 35, 0, 47, 35, 45, 0, 42, 38,
          31, 0, 43, 31, 0, 33, 45, 0, 35, 0, 47, 45, 42, 40, 38, 37,
        ],
        lead: [
          71, 0, 74, 78, 0, 0, 83, 0, 81, 0, 78, 74, 71, 0, 0, 0,
          79, 0, 78, 74, 76, 0, 81, 0, 78, 0, 74, 71, 73, 0, 78, 0,
        ],
        stab: [
          47, 0, 0, 47, 0, 0, 50, 0, 47, 0, 0, 0, 54, 0, 52, 0,
          43, 0, 0, 43, 0, 0, 45, 0, 47, 0, 0, 50, 52, 0, 54, 0,
        ],
        drums: [
          'KC', 'H', 'KH', 'O', 'SM', 'K', 'KO', 'gH', 'KH', 'H', 'KH', 'g', 'SM', 'K', 'KO', 'g',
          'KC', 'H', 'KH', 'O', 'SM', 'K', 'KO', 'M', 'KH', 'S', 'KH', 'S', 'S', 'T', 'KT', 'KSC',
        ],
        leadType: 'fm_shred',
        filterMult: 1.15,
      },
    },
  },

  level3: {
    // Stage 3: 140 BPM Dark Factory Perimeter — Industrial EBM & Anvil March (22 bars / ~37.7 sec!)
    bpm: 140,
    bassA: L3_BASS_A,
    bassB: L3_BASS_B,
    acidAccent: [
      1, 0, 1, 1, 0, 0, 1, 0, 1, 0, 1, 1, 1, 0, 1, 0,
      1, 0, 1, 1, 0, 0, 1, 1, 1, 0, 1, 0, 1, 0, 1, 0,
    ],
    leadA: L3_LEAD_A,
    leadB: L3_LEAD_B,
    stab: L3_STAB,
    drumsA: L3_DRUMS_A,
    drumsB: L3_DRUMS_B,
    acidQ: 8.2,
    leadType: 'hoover',
    bassStyle: 'industrial',
    stabChord: 'dim',
    drive: 1.9,
    loopStart: 1,
    arrangement: [
      'intro',
      'verse1',
      'verse2',
      'preChorus',
      'chorus1',
      'chorus2',
      'breakdown',
      'buildup',
      'solo',
      'chorus1',
      'turnaround',
    ],
    sections: {
      intro: {
        bass: L3_BASS_A,
        stab: [
          48, 0, 0, 0, 0, 0, 0, 0, 49, 0, 0, 0, 0, 0, 0, 0,
          48, 0, 0, 0, 0, 0, 54, 0, 0, 0, 55, 0, 49, 0, 48, 0,
        ],
        drums: DRUMS_IND_INTRO,
        filterMult: 0.65,
        filterRampTo: 1.0,
      },
      verse1: {
        bass: L3_BASS_A,
        lead: L3_LEAD_A,
        stab: L3_STAB,
        drums: L3_DRUMS_A,
        filterMult: 1.0,
      },
      verse2: {
        bass: L3_BASS_A,
        lead: [
          60, 0, 61, 0, 63, 0, 61, 60, 0, 0, 67, 0, 66, 0, 63, 0,
          60, 0, 61, 63, 66, 0, 63, 61, 60, 0, 58, 0, 61, 0, 60, 0,
        ],
        counter: [
          72, 0, 0, 0, 73, 0, 0, 0, 72, 0, 0, 0, 78, 0, 79, 0,
          72, 0, 0, 0, 73, 0, 75, 0, 73, 0, 72, 0, 70, 0, 72, 0,
        ],
        stab: L3_STAB,
        drums: L3_DRUMS_A,
        filterMult: 1.08,
      },
      preChorus: {
        // Grinding Ab -> G industrial climb
        bass: [
          44, 0, 44, 44, 0, 44, 43, 0, 44, 0, 44, 44, 49, 0, 48, 0,
          43, 0, 43, 43, 0, 43, 42, 0, 43, 42, 41, 39, 37, 0, 36, 0,
        ],
        lead: [
          68, 0, 0, 68, 72, 0, 68, 0, 68, 0, 73, 0, 72, 0, 68, 0,
          67, 0, 0, 67, 70, 0, 67, 0, 66, 0, 67, 0, 73, 0, 72, 0,
        ],
        stab: [
          56, 0, 0, 0, 56, 0, 0, 0, 56, 0, 0, 0, 61, 0, 60, 0,
          55, 0, 0, 0, 55, 0, 0, 0, 54, 0, 55, 0, 61, 0, 55, 0,
        ],
        drums: L3_DRUMS_A,
        filterMult: 0.92,
        filterRampTo: 1.24,
      },
      chorus1: {
        bass: L3_BASS_B,
        lead: L3_LEAD_B,
        stab: L3_STAB,
        drums: L3_DRUMS_B,
        filterMult: 1.18,
        intense: true,
      },
      chorus2: {
        bass: L3_BASS_B,
        lead: [
          72, 0, 73, 0, 75, 0, 78, 0, 79, 0, 78, 75, 73, 0, 72, 0,
          72, 0, 73, 75, 78, 0, 79, 0, 84, 0, 82, 79, 78, 0, 73, 0,
        ],
        stab: L3_STAB,
        drums: L3_DRUMS_B,
        filterMult: 1.24,
        intense: true,
      },
      breakdown: {
        // Eerie dark factory cavern: throbbing sub-bass + metallic sonar pings + ominous drone pad
        bass: [
          36, 0, 0, 0, 36, 0, 0, 0, 37, 0, 0, 0, 36, 0, 0, 0,
          36, 0, 0, 0, 42, 0, 0, 0, 43, 0, 0, 0, 37, 0, 36, 0,
        ],
        counter: [
          72, 0, 0, 0, 0, 0, 73, 0, 0, 0, 78, 0, 0, 0, 72, 0,
          72, 0, 0, 0, 0, 0, 75, 0, 0, 0, 73, 0, 72, 0, 0, 0,
        ],
        padChords: [
          [48, 51, 54, 60],
          [49, 52, 55, 61],
        ],
        drums: DRUMS_IND_BREAK,
        acidAccent: ACCENT_SPARSE,
        filterMult: 0.52,
      },
      buildup: {
        bass: [
          36, 36, 48, 36, 37, 37, 49, 37, 36, 36, 48, 36, 42, 42, 54, 42,
          43, 43, 55, 43, 44, 44, 56, 44, 46, 46, 58, 46, 48, 46, 44, 43,
        ],
        counter: [
          60, 0, 61, 0, 63, 0, 66, 0, 67, 0, 68, 0, 70, 0, 72, 0,
          72, 73, 75, 78, 79, 78, 75, 73, 72, 75, 78, 79, 82, 84, 79, 73,
        ],
        drums: DRUMS_BUILDUP_ROLL,
        acidAccent: ACCENT_BUILD,
        filterMult: 0.58,
        filterRampTo: 1.32,
      },
      solo: {
        // Piercing industrial siren/FM shred solo!
        bass: L3_BASS_B,
        lead: [
          72, 73, 72, 67, 72, 73, 75, 78, 79, 78, 75, 73, 72, 70, 67, 0,
          72, 75, 78, 79, 84, 82, 79, 78, 75, 73, 72, 75, 73, 72, 67, 0,
        ],
        leadType: 'siren',
        stab: L3_STAB,
        drums: L3_DRUMS_B,
        filterMult: 1.25,
        intense: true,
      },
      turnaround: {
        bass: L3_BASS_A,
        lead: L3_LEAD_A,
        stab: L3_STAB,
        drums: L3_DRUMS_B,
        filterMult: 1.1,
      },
    },
  },

  level4: {
    // Stage 4: 178 BPM Sunny Highway Harley Chase — Biker Speed-Rock Anthem (26 bars / ~35 sec!)
    bpm: 178,
    bassA: L4_BASS_A,
    bassB: L4_BASS_B,
    acidAccent: [
      1, 0, 0, 1, 1, 0, 0, 1, 1, 0, 0, 1, 1, 0, 0, 1,
      1, 0, 0, 1, 1, 0, 0, 1, 1, 0, 1, 0, 1, 0, 1, 0,
    ],
    leadA: L4_LEAD_A,
    leadB: L4_LEAD_B,
    stab: L4_STAB,
    drumsA: L4_DRUMS_A,
    drumsB: L4_DRUMS_B,
    acidQ: 3.8,
    leadType: 'guitar_lead',
    bassStyle: 'rock_gallop',
    stabChord: 'power5',
    drive: 1.7,
    loopStart: 1,
    arrangement: [
      'intro',
      'verse1',
      'verse2',
      'preChorus',
      'chorus1',
      'chorus2',
      'cruiseBridge',
      'cruiseBridge2',
      'buildup',
      'solo1',
      'solo2',
      'chorus1',
      'turnaround',
    ],
    sections: {
      intro: {
        bass: L4_BASS_A,
        stab: L4_STAB,
        drums: DRUMS_ROCK_INTRO,
        filterMult: 0.9,
        filterRampTo: 1.15,
      },
      verse1: {
        bass: L4_BASS_A,
        lead: L4_LEAD_A,
        stab: L4_STAB,
        drums: L4_DRUMS_A,
        filterMult: 1.0,
      },
      verse2: {
        bass: L4_BASS_A,
        lead: L4_LEAD_A,
        // Twin-guitar rock harmony a 3rd/5th above!
        counter: [
          72, 0, 76, 0, 79, 0, 77, 76, 72, 0, 0, 76, 77, 0, 76, 0,
          83, 0, 79, 0, 77, 0, 76, 0, 79, 0, 77, 76, 74, 0, 72, 0,
        ],
        stab: L4_STAB,
        drums: L4_DRUMS_A,
        filterMult: 1.08,
      },
      preChorus: {
        // Classic rock F -> G -> F -> E7 lift!
        bass: [
          29, 29, 41, 29, 29, 29, 41, 29, 31, 31, 43, 31, 31, 31, 43, 31,
          29, 29, 41, 29, 31, 31, 43, 31, 28, 28, 40, 28, 28, 31, 33, 35,
        ],
        lead: [
          77, 0, 76, 0, 72, 0, 76, 0, 79, 0, 77, 0, 74, 0, 77, 0,
          81, 0, 79, 0, 77, 0, 76, 0, 76, 0, 79, 0, 80, 0, 76, 0,
        ],
        stab: [
          41, 0, 0, 0, 41, 0, 0, 0, 43, 0, 0, 0, 43, 0, 0, 0,
          41, 0, 0, 0, 43, 0, 0, 0, 40, 0, 40, 0, 44, 0, 40, 0,
        ],
        drums: L4_DRUMS_A,
        filterMult: 1.0,
        filterRampTo: 1.25,
      },
      chorus1: {
        bass: L4_BASS_B,
        lead: L4_LEAD_B,
        stab: L4_STAB,
        drums: L4_DRUMS_B,
        filterMult: 1.2,
        intense: true,
      },
      chorus2: {
        bass: L4_BASS_B,
        lead: [
          81, 0, 84, 0, 88, 0, 91, 88, 86, 0, 84, 81, 84, 0, 81, 0,
          86, 0, 88, 86, 84, 0, 81, 79, 81, 0, 79, 76, 74, 72, 69, 0,
        ],
        stab: L4_STAB,
        drums: L4_DRUMS_B,
        filterMult: 1.25,
        intense: true,
      },
      cruiseBridge: {
        // Open-road highway cruising bridge: Dm -> Am half-time feel!
        bass: [
          38, 0, 38, 0, 50, 0, 38, 0, 38, 0, 50, 0, 45, 0, 43, 0,
          33, 0, 33, 0, 45, 0, 33, 0, 33, 0, 45, 0, 40, 0, 38, 0,
        ],
        lead: [
          74, 0, 0, 77, 0, 0, 81, 0, 79, 0, 77, 0, 74, 0, 0, 0,
          72, 0, 0, 76, 0, 0, 81, 0, 79, 0, 76, 0, 72, 0, 0, 0,
        ],
        padChords: [
          [50, 53, 57, 62],
          [45, 48, 52, 57],
        ],
        drums: DRUMS_ROCK_CRUISE,
        filterMult: 0.82,
      },
      cruiseBridge2: {
        // F -> G -> E7 soaring twin-lead
        bass: [
          29, 0, 29, 0, 41, 0, 29, 0, 31, 0, 31, 0, 43, 0, 31, 0,
          28, 0, 28, 0, 40, 0, 28, 0, 28, 28, 40, 28, 31, 31, 33, 35,
        ],
        lead: [
          77, 0, 0, 81, 0, 0, 84, 0, 83, 0, 79, 0, 74, 0, 79, 0,
          76, 0, 0, 80, 0, 0, 83, 0, 88, 0, 83, 0, 80, 0, 76, 0,
        ],
        padChords: [
          [53, 57, 60, 65],
          [52, 56, 59, 64],
        ],
        drums: DRUMS_ROCK_CRUISE,
        filterMult: 0.9,
        filterRampTo: 1.15,
      },
      buildup: {
        bass: [
          33, 33, 45, 33, 33, 33, 45, 33, 36, 36, 48, 36, 38, 38, 50, 38,
          40, 40, 52, 40, 40, 40, 52, 40, 40, 43, 45, 48, 50, 52, 55, 57,
        ],
        stab: [
          45, 0, 45, 0, 45, 0, 45, 0, 48, 0, 48, 0, 50, 0, 50, 0,
          52, 0, 52, 0, 52, 52, 0, 52, 52, 52, 52, 52, 55, 55, 57, 57,
        ],
        drums: DRUMS_BUILDUP_ROLL,
        filterMult: 0.85,
        filterRampTo: 1.35,
      },
      solo1: {
        // Fast arcade speed-metal guitar solo!
        bass: L4_BASS_A,
        lead: [
          81, 84, 88, 84, 81, 84, 88, 91, 88, 84, 81, 79, 76, 79, 81, 0,
          77, 81, 84, 81, 77, 81, 84, 86, 84, 81, 79, 76, 74, 72, 76, 0,
        ],
        leadType: 'fm_shred',
        stab: L4_STAB,
        drums: L4_DRUMS_B,
        filterMult: 1.25,
        intense: true,
      },
      solo2: {
        bass: L4_BASS_B,
        lead: [
          88, 86, 84, 81, 84, 86, 88, 91, 93, 91, 88, 86, 84, 81, 79, 81,
          84, 86, 88, 91, 93, 0, 91, 88, 86, 84, 81, 79, 76, 79, 81, 0,
        ],
        leadType: 'guitar_lead',
        stab: L4_STAB,
        drums: L4_DRUMS_B,
        filterMult: 1.3,
        intense: true,
      },
      turnaround: {
        bass: L4_BASS_A,
        lead: L4_LEAD_A,
        stab: L4_STAB,
        drums: L4_DRUMS_B,
        filterMult: 1.15,
      },
    },
  },

  elevator: {
    // Stage 5: 166 BPM Vertical Freight Elevator — Rising Acid-Arp Techno (24 bars / ~35 sec!)
    bpm: 166,
    bassA: EL_BASS_A,
    bassB: EL_BASS_B,
    acidAccent: [
      0, 1, 0, 1, 0, 1, 1, 0, 0, 1, 0, 1, 0, 1, 1, 0,
      0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 1, 1, 1, 0,
    ],
    leadA: EL_LEAD_A,
    leadB: EL_LEAD_B,
    stab: EL_STAB,
    drumsA: EL_DRUMS_A,
    drumsB: EL_DRUMS_B,
    acidQ: 8.5,
    leadType: 'arp_pulse',
    bassStyle: 'acid',
    stabChord: 'minor',
    drive: 1.5,
    loopStart: 1,
    arrangement: [
      'intro',
      'verse1',
      'verse2',
      'climb',
      'chorus1',
      'chorus2',
      'zeroG',
      'acidSweep',
      'buildup',
      'peakRave1',
      'peakRave2',
      'turnaround',
    ],
    sections: {
      intro: {
        bass: EL_BASS_A,
        lead: EL_LEAD_A,
        drums: DRUMS_TECHNO_INTRO,
        filterMult: 0.52,
        filterRampTo: 0.98,
      },
      verse1: {
        bass: EL_BASS_A,
        lead: EL_LEAD_A,
        stab: EL_STAB,
        drums: EL_DRUMS_A,
        filterMult: 0.98,
      },
      verse2: {
        bass: EL_BASS_A,
        lead: EL_LEAD_A,
        counter: [
          78, 0, 0, 81, 0, 0, 85, 0, 78, 0, 0, 81, 0, 85, 83, 0,
          74, 0, 0, 78, 76, 0, 0, 80, 78, 0, 81, 0, 85, 0, 83, 0,
        ],
        stab: EL_STAB,
        drums: EL_DRUMS_A,
        filterMult: 1.08,
      },
      climb: {
        // Ascending floor-by-floor modulation: D -> E -> F# -> G# -> A!
        bass: [
          0, 38, 50, 38, 0, 38, 50, 38, 0, 40, 52, 40, 0, 40, 52, 40,
          0, 42, 54, 42, 0, 44, 56, 44, 0, 45, 57, 45, 47, 49, 50, 52,
        ],
        lead: [
          62, 66, 69, 74, 69, 66, 74, 69, 64, 68, 71, 76, 71, 68, 76, 71,
          66, 69, 73, 78, 68, 71, 74, 80, 69, 73, 76, 81, 83, 85, 86, 88,
        ],
        stab: [
          50, 0, 0, 0, 50, 0, 0, 0, 52, 0, 0, 0, 52, 0, 0, 0,
          54, 0, 0, 0, 56, 0, 0, 0, 57, 0, 59, 0, 61, 0, 64, 0,
        ],
        drums: EL_DRUMS_A,
        filterMult: 0.9,
        filterRampTo: 1.25,
      },
      chorus1: {
        bass: EL_BASS_B,
        lead: EL_LEAD_B,
        stab: EL_STAB,
        drums: EL_DRUMS_B,
        filterMult: 1.18,
        intense: true,
      },
      chorus2: {
        bass: EL_BASS_B,
        lead: EL_LEAD_B,
        counter: [
          90, 0, 88, 0, 85, 0, 81, 0, 88, 0, 85, 0, 83, 0, 80, 0,
          86, 0, 85, 0, 88, 0, 86, 0, 90, 0, 88, 85, 81, 0, 78, 0,
        ],
        stab: EL_STAB,
        drums: EL_DRUMS_B,
        filterMult: 1.24,
        intense: true,
      },
      zeroG: {
        // Floating rave breakdown — drums drop out, lush trance pads + dreamy arp!
        bass: [
          42, 0, 0, 0, 0, 0, 0, 0, 47, 0, 0, 0, 0, 0, 0, 0,
          38, 0, 0, 0, 40, 0, 0, 0, 42, 0, 0, 0, 0, 0, 40, 0,
        ],
        counter: [
          78, 0, 81, 0, 85, 0, 81, 0, 83, 0, 78, 0, 74, 0, 78, 0,
          74, 0, 78, 0, 76, 0, 80, 0, 78, 0, 81, 0, 85, 0, 81, 0,
        ],
        padChords: [
          [54, 57, 61, 66],
          [50, 54, 57, 62],
        ],
        drums: DRUMS_TECHNO_FLOAT,
        acidAccent: ACCENT_SPARSE,
        filterMult: 0.55,
      },
      acidSweep: {
        // Squelchy 303 acid line waking back up while filter sweeps open!
        bass: [
          42, 42, 54, 42, 45, 42, 54, 47, 42, 42, 54, 42, 49, 47, 45, 42,
          38, 38, 50, 38, 40, 40, 52, 40, 42, 42, 54, 45, 47, 49, 54, 49,
        ],
        padChords: [
          [54, 57, 61, 66],
          [52, 56, 59, 64],
        ],
        drums: DRUMS_TECHNO_INTRO,
        acidAccent: ACCENT_BUILD,
        filterMult: 0.52,
        filterRampTo: 1.08,
      },
      buildup: {
        bass: EL_BASS_B,
        lead: [
          66, 69, 73, 78, 69, 73, 78, 81, 73, 78, 81, 85, 78, 81, 85, 90,
          78, 81, 85, 90, 81, 85, 90, 93, 85, 90, 93, 90, 88, 85, 81, 78,
        ],
        drums: DRUMS_BUILDUP_ROLL,
        acidAccent: ACCENT_BUILD,
        filterMult: 0.78,
        filterRampTo: 1.35,
      },
      peakRave1: {
        // Full 90s Prodigy/rave siren drop!
        bass: EL_BASS_B,
        lead: [
          78, 0, 81, 0, 85, 0, 83, 81, 78, 0, 0, 81, 85, 0, 88, 0,
          86, 0, 85, 81, 83, 0, 80, 0, 78, 0, 81, 85, 90, 0, 85, 0,
        ],
        leadType: 'siren',
        stab: EL_STAB,
        drums: EL_DRUMS_B,
        filterMult: 1.26,
        intense: true,
      },
      peakRave2: {
        bass: EL_BASS_B,
        lead: EL_LEAD_B,
        counter: [
          90, 0, 85, 0, 81, 0, 85, 0, 88, 0, 83, 0, 80, 0, 83, 0,
          86, 0, 81, 0, 88, 0, 83, 0, 90, 0, 88, 85, 81, 78, 73, 0,
        ],
        stab: EL_STAB,
        drums: EL_DRUMS_B,
        filterMult: 1.3,
        intense: true,
      },
      turnaround: {
        bass: EL_BASS_A,
        lead: EL_LEAD_A,
        stab: EL_STAB,
        drums: EL_DRUMS_B,
        filterMult: 1.12,
      },
    },
  },

  level5: {
    // Stage 6: 148 BPM Director's Penthouse — Gothic Neo-Classical Synth-Metal (24 bars / ~39 sec!)
    bpm: 148,
    bassA: L5_BASS_A,
    bassB: L5_BASS_B,
    acidAccent: [
      1, 0, 0, 1, 1, 0, 0, 0, 1, 0, 0, 1, 1, 0, 0, 0,
      1, 0, 0, 1, 1, 0, 0, 0, 1, 0, 0, 1, 1, 1, 1, 1,
    ],
    leadA: L5_LEAD_A,
    leadB: L5_LEAD_B,
    stab: L5_STAB,
    drumsA: L5_DRUMS_A,
    drumsB: L5_DRUMS_B,
    acidQ: 6.2,
    leadType: 'organ_lead',
    bassStyle: 'industrial',
    stabChord: 'minor',
    drive: 1.6,
    loopStart: 1,
    arrangement: [
      'intro',
      'verse1',
      'verse2',
      'preChorus',
      'chorus1',
      'chorus2',
      'gothicBreak',
      'buildup',
      'baroqueSolo1',
      'baroqueSolo2',
      'chorus1',
      'turnaround',
    ],
    sections: {
      intro: {
        // Cathedral organ arpeggios + pounding timpani entrance!
        bass: [
          43, 0, 0, 0, 43, 0, 0, 0, 39, 0, 0, 0, 39, 0, 0, 0,
          36, 0, 0, 0, 38, 0, 0, 0, 38, 0, 42, 0, 45, 0, 50, 0,
        ],
        counter: [
          67, 70, 74, 79, 74, 70, 67, 74, 63, 67, 70, 75, 70, 67, 63, 70,
          60, 63, 67, 72, 62, 66, 69, 74, 78, 74, 69, 66, 74, 78, 81, 78,
        ],
        padChords: [
          [55, 58, 62, 67],
          [51, 55, 58, 63],
        ],
        drums: DRUMS_GOTHIC_INTRO,
        filterMult: 0.78,
        filterRampTo: 1.1,
      },
      verse1: {
        bass: L5_BASS_A,
        lead: L5_LEAD_A,
        stab: L5_STAB,
        drums: L5_DRUMS_A,
        filterMult: 1.0,
      },
      verse2: {
        bass: L5_BASS_A,
        lead: L5_LEAD_A,
        // Baroque harpsichord-style counter-arpeggio
        counter: [
          79, 0, 74, 0, 70, 0, 74, 0, 75, 0, 70, 0, 67, 0, 70, 0,
          72, 0, 67, 0, 63, 0, 67, 0, 74, 0, 78, 0, 81, 0, 74, 0,
        ],
        stab: L5_STAB,
        drums: L5_DRUMS_A,
        filterMult: 1.08,
      },
      preChorus: {
        // Dramatic Cm -> Gm -> Eb -> D7 climb
        bass: [
          36, 36, 48, 36, 36, 48, 43, 36, 43, 43, 55, 43, 43, 55, 50, 43,
          39, 39, 51, 39, 39, 51, 46, 39, 38, 38, 50, 38, 42, 45, 50, 45,
        ],
        lead: [
          72, 0, 75, 79, 84, 0, 79, 75, 74, 0, 79, 82, 86, 0, 82, 79,
          75, 0, 79, 82, 87, 0, 82, 79, 81, 0, 78, 0, 86, 0, 81, 0,
        ],
        stab: [
          48, 0, 0, 0, 48, 0, 0, 0, 55, 0, 0, 0, 55, 0, 0, 0,
          51, 0, 0, 0, 51, 0, 0, 0, 50, 0, 54, 0, 57, 0, 50, 0,
        ],
        drums: L5_DRUMS_A,
        filterMult: 0.96,
        filterRampTo: 1.24,
      },
      chorus1: {
        bass: L5_BASS_B,
        lead: L5_LEAD_B,
        stab: L5_STAB,
        drums: L5_DRUMS_B,
        filterMult: 1.2,
        intense: true,
      },
      chorus2: {
        bass: L5_BASS_B,
        lead: [
          79, 0, 82, 86, 91, 0, 90, 86, 87, 0, 91, 87, 86, 0, 82, 0,
          84, 0, 87, 91, 87, 84, 82, 0, 86, 0, 90, 93, 90, 86, 81, 0,
        ],
        padChords: [
          [55, 58, 62, 67],
          [50, 54, 57, 62],
        ],
        stab: L5_STAB,
        drums: L5_DRUMS_B,
        filterMult: 1.26,
        intense: true,
      },
      gothicBreak: {
        // Solemn cathedral interlude: choir/organ chords + Castlevania descending arp
        bass: [
          43, 0, 0, 0, 0, 0, 46, 0, 39, 0, 0, 0, 0, 0, 43, 0,
          36, 0, 0, 0, 0, 0, 39, 0, 38, 0, 0, 0, 42, 0, 45, 0,
        ],
        counter: [
          79, 74, 70, 74, 79, 74, 70, 67, 75, 70, 67, 70, 75, 70, 67, 63,
          72, 67, 63, 67, 72, 67, 63, 60, 74, 69, 66, 69, 74, 78, 81, 78,
        ],
        padChords: [
          [55, 58, 62, 67],
          [48, 51, 55, 60],
        ],
        drums: DRUMS_GOTHIC_BREAK,
        acidAccent: ACCENT_SPARSE,
        filterMult: 0.65,
      },
      buildup: {
        bass: [
          38, 38, 50, 38, 38, 38, 50, 38, 39, 39, 51, 39, 42, 42, 54, 42,
          43, 43, 55, 43, 45, 45, 57, 45, 46, 46, 58, 46, 50, 48, 46, 45,
        ],
        counter: [
          62, 66, 69, 74, 66, 69, 74, 78, 69, 74, 78, 81, 74, 78, 81, 86,
          79, 82, 86, 91, 82, 86, 91, 90, 86, 90, 91, 90, 86, 82, 79, 78,
        ],
        drums: DRUMS_BUILDUP_ROLL,
        acidAccent: ACCENT_BUILD,
        filterMult: 0.72,
        filterRampTo: 1.32,
      },
      baroqueSolo1: {
        // Neo-classical Yngwie / Castlevania Bloodlines harmonic-minor shred solo!
        bass: L5_BASS_B,
        lead: [
          79, 82, 86, 82, 79, 78, 79, 82, 87, 86, 82, 79, 75, 79, 82, 86,
          84, 82, 79, 75, 72, 75, 79, 84, 86, 81, 78, 74, 78, 81, 86, 90,
        ],
        leadType: 'fm_shred',
        stab: L5_STAB,
        drums: L5_DRUMS_B,
        filterMult: 1.24,
        intense: true,
      },
      baroqueSolo2: {
        bass: L5_BASS_B,
        lead: [
          91, 90, 86, 82, 79, 82, 86, 91, 87, 86, 82, 79, 75, 79, 82, 87,
          84, 82, 79, 75, 79, 82, 84, 87, 90, 86, 81, 78, 81, 86, 90, 0,
        ],
        leadType: 'guitar_lead',
        stab: L5_STAB,
        drums: L5_DRUMS_B,
        filterMult: 1.28,
        intense: true,
      },
      turnaround: {
        bass: L5_BASS_A,
        lead: L5_LEAD_A,
        stab: L5_STAB,
        drums: L5_DRUMS_B,
        filterMult: 1.15,
      },
    },
  },

  boss: {
    // 182 BPM PURE CONTRA HARD CORPS × PRODIGY BOSS FURY — Extended 24-bar multi-phase battle (~31.6 sec!)
    bpm: 182,
    bassA: BOSS_BASS_A,
    bassB: BOSS_BASS_B,
    acidAccent: [
      1, 1, 1, 1, 1, 1, 0, 1, 1, 1, 1, 1, 1, 1, 1, 1,
      1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1,
    ],
    leadA: BOSS_LEAD_A,
    leadB: BOSS_LEAD_B,
    stab: BOSS_STAB,
    drumsA: BOSS_DRUMS_A,
    drumsB: BOSS_DRUMS_B,
    acidQ: 8.5,
    leadType: 'siren',
    drive: 2.0,
    loopStart: 0,
    arrangement: [
      'phaseA1',
      'phaseA2',
      'phaseB1',
      'phaseB2',
      'tensionBreak',
      'buildup',
      'shredSolo1',
      'shredSolo2',
      'phaseB1',
      'phaseB2',
      'phaseA1',
      'finalFury',
    ],
    sections: {
      phaseA1: {
        bass: BOSS_BASS_A,
        lead: BOSS_LEAD_A,
        stab: BOSS_STAB,
        drums: BOSS_DRUMS_A,
        filterMult: 1.0,
      },
      phaseA2: {
        bass: BOSS_BASS_A,
        lead: BOSS_LEAD_A,
        counter: [
          81, 0, 0, 0, 82, 0, 0, 0, 87, 0, 0, 0, 88, 0, 87, 0,
          81, 0, 0, 0, 87, 0, 88, 0, 93, 0, 92, 0, 88, 87, 84, 0,
        ],
        stab: BOSS_STAB,
        drums: BOSS_DRUMS_A,
        filterMult: 1.08,
      },
      phaseB1: {
        bass: BOSS_BASS_B,
        lead: BOSS_LEAD_B,
        stab: BOSS_STAB,
        drums: BOSS_DRUMS_B,
        filterMult: 1.2,
        intense: true,
      },
      phaseB2: {
        bass: BOSS_BASS_B,
        lead: BOSS_LEAD_B,
        counter: [
          69, 0, 70, 0, 75, 0, 76, 0, 81, 0, 80, 0, 76, 0, 75, 0,
          69, 0, 75, 0, 76, 0, 81, 0, 84, 0, 81, 0, 80, 76, 75, 0,
        ],
        stab: BOSS_STAB,
        drums: BOSS_DRUMS_B,
        filterMult: 1.26,
        intense: true,
      },
      tensionBreak: {
        // Menacing low boss stomp — gives brief breath before the solo onslaught!
        bass: [
          33, 0, 33, 0, 34, 0, 33, 0, 39, 0, 33, 0, 36, 0, 34, 0,
          33, 0, 33, 0, 34, 0, 39, 0, 40, 0, 39, 0, 36, 0, 34, 0,
        ],
        stab: [
          45, 0, 0, 0, 46, 0, 0, 0, 51, 0, 0, 0, 52, 0, 0, 0,
          45, 0, 0, 0, 51, 0, 0, 0, 52, 0, 51, 0, 48, 0, 46, 0,
        ],
        padChords: [
          [45, 48, 51, 57],
          [46, 49, 52, 58],
        ],
        drums: DRUMS_BOSS_BREAK,
        acidAccent: ACCENT_SPARSE,
        filterMult: 0.62,
      },
      buildup: {
        bass: [
          33, 33, 45, 33, 34, 34, 46, 34, 36, 36, 48, 36, 39, 39, 51, 39,
          40, 40, 52, 40, 44, 44, 56, 44, 45, 45, 57, 45, 48, 51, 52, 56,
        ],
        counter: [
          69, 70, 72, 75, 70, 72, 75, 76, 72, 75, 76, 80, 75, 76, 80, 81,
          81, 82, 84, 87, 82, 84, 87, 88, 84, 87, 88, 92, 93, 92, 88, 87,
        ],
        drums: DRUMS_BUILDUP_ROLL,
        acidAccent: ACCENT_BUILD,
        filterMult: 0.68,
        filterRampTo: 1.35,
      },
      shredSolo1: {
        bass: BOSS_BASS_B,
        lead: [
          81, 80, 76, 80, 81, 84, 87, 88, 93, 92, 88, 87, 84, 81, 80, 76,
          81, 84, 87, 88, 92, 93, 92, 88, 87, 84, 82, 81, 76, 75, 72, 70,
        ],
        leadType: 'fm_shred',
        stab: BOSS_STAB,
        drums: BOSS_DRUMS_B,
        filterMult: 1.28,
        intense: true,
      },
      shredSolo2: {
        bass: BOSS_BASS_B,
        lead: [
          88, 87, 84, 81, 84, 87, 88, 92, 93, 92, 88, 87, 84, 87, 88, 92,
          93, 0, 92, 88, 87, 84, 82, 81, 80, 76, 75, 72, 70, 69, 75, 76,
        ],
        leadType: 'guitar_lead',
        stab: BOSS_STAB,
        drums: BOSS_DRUMS_B,
        filterMult: 1.32,
        intense: true,
      },
      finalFury: {
        bass: BOSS_BASS_B,
        lead: BOSS_LEAD_B,
        stab: BOSS_STAB,
        drums: BOSS_DRUMS_B,
        filterMult: 1.3,
        intense: true,
      },
    },
  },

  victory: {
    // 144 BPM Triumphant 16-bit Sega Rave-Funk Finale! (16 bars / ~26.7 sec)
    bpm: 144,
    bassA: [
      48, 0, 48, 52, 0, 55, 52, 55, 53, 0, 53, 55, 0, 60, 55, 52,
      48, 0, 60, 55, 52, 55, 57, 55, 53, 55, 57, 59, 60, 0, 55, 0,
    ],
    bassB: [
      48, 60, 48, 52, 55, 60, 55, 52, 53, 65, 53, 57, 60, 57, 55, 53,
      48, 60, 55, 52, 55, 57, 59, 60, 62, 60, 59, 57, 60, 55, 52, 48,
    ],
    acidAccent: [
      1, 0, 0, 1, 0, 1, 0, 0, 1, 0, 0, 1, 0, 1, 0, 0,
      1, 0, 1, 0, 0, 1, 1, 0, 1, 0, 1, 1, 1, 0, 1, 0,
    ],
    leadA: [
      72, 0, 76, 79, 0, 84, 79, 76, 77, 0, 79, 81, 83, 84, 79, 0,
      84, 0, 83, 81, 79, 76, 79, 84, 86, 84, 83, 81, 84, 0, 88, 0,
    ],
    leadB: [
      84, 0, 88, 91, 88, 84, 79, 84, 89, 0, 88, 84, 81, 84, 88, 0,
      84, 88, 91, 93, 91, 88, 84, 88, 91, 89, 88, 86, 84, 0, 91, 0,
    ],
    stab: [
      60, 0, 0, 0, 0, 0, 64, 0, 65, 0, 0, 0, 0, 0, 67, 0,
      60, 0, 0, 0, 64, 0, 67, 0, 65, 0, 67, 0, 72, 0, 0, 0,
    ],
    drumsA: [
      'KC', 'H', 'KH', 'H', 'SH', 'H', 'KO', 'g', 'KH', 'H', 'KH', 'H', 'SH', 'H', 'KO', 'g',
      'KH', 'H', 'KH', 'H', 'SH', 'H', 'KO', 'H', 'KH', 'H', 'SH', 'H', 'S', 'T', 'S', 'KC',
    ],
    drumsB: [
      'KC', 'H', 'KH', 'g', 'SH', 'K', 'KO', 'g', 'KH', 'H', 'KH', 'g', 'SH', 'K', 'KO', 'g',
      'KH', 'H', 'KH', 'g', 'SH', 'K', 'KO', 'H', 'KH', 'S', 'SH', 'S', 'S', 'T', 'S', 'KSC',
    ],
    acidQ: 6.5,
    leadType: 'fm_shred',
    drive: 1.35,
  },

  synthwave: {
    // 108 BPM Endless OutRun / Vice City / Malibu Sunrise Analog Synthwave (original 4-bar loop preserved as requested)
    bpm: 108,
    isSynthwave: true,
    padChords: [
      [57, 60, 64, 71], // Bar 1: Am9
      [53, 57, 60, 64], // Bar 2: Fmaj7
      [52, 55, 60, 62], // Bar 3: Cadd9
      [55, 59, 62, 64], // Bar 4: G6
    ],
    bassA: SW_BASS_A,
    bassB: SW_BASS_B,
    acidAccent: [
      1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0,
      1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0,
    ],
    leadA: SW_LEAD_A,
    leadB: SW_LEAD_B,
    stab: SW_ARP_A,
    drumsA: SW_DRUMS_A,
    drumsB: SW_DRUMS_B,
    drive: 1.05,
  },
};
