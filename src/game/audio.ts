import { WeaponId } from './types';

export type MusicTrack =
  | 'none'
  | 'title'
  | 'cutscene'
  | 'level1'
  | 'level2'
  | 'level3'
  | 'level4'
  | 'elevator'
  | 'level5'
  | 'boss'
  | 'victory'
  | 'synthwave';

// Drum grid tokens per 16th-note step:
// K = Hardcore Sub-Kick, S = Crunchy Sega DAC Snare, g = Amen Ghost Snare,
// H = Closed Hat, O = Open Hat, C = Crash/Drop Hit, T = Industrial Tom, M = Metallic Anvil/Clang
interface TrackPattern {
  bpm: number;
  bassA: number[]; // 32 steps (Bars 1-2)
  bassB: number[]; // 32 steps (Bars 3-4 — heavier variation / octave lift / breakdown)
  acidAccent: number[]; // 32 steps: 1 = squelchy resonant 303 accent
  leadA: number[]; // 32 steps (Bars 1-2)
  leadB: number[]; // 32 steps (Bars 3-4 — screaming Contra Hard Corps / Prodigy climax)
  stab: number[]; // 32 steps, root MIDI note for 90s Genesis rave power-chord stab or 0
  drumsA: string[]; // 32 steps
  drumsB: string[]; // 32 steps (heavier fills, double kicks, Amen snare rolls)
  muffled?: boolean;
  acidQ?: number;
  leadType?: 'hoover' | 'fm_shred' | 'siren';
  drive?: number;
  isSynthwave?: boolean;
  padChords?: number[][]; // 4 bar chords for endless Synthwave Juno pads
}

const TRACKS: Record<Exclude<MusicTrack, 'none'>, TrackPattern> = {
  title: {
    // 154 BPM Prodigy "Breathe / Firestarter" × Contra Hard Corps dark anthem
    bpm: 154,
    bassA: [
      36, 36, 48, 39, 36, 36, 43, 42, 36, 36, 41, 39, 36, 48, 46, 43,
      36, 36, 48, 39, 41, 42, 43, 46, 36, 36, 48, 46, 43, 42, 41, 39,
    ],
    bassB: [
      36, 48, 36, 39, 42, 36, 43, 48, 36, 48, 41, 42, 43, 46, 48, 51,
      36, 36, 51, 48, 46, 43, 42, 39, 36, 48, 46, 43, 42, 41, 39, 38,
    ],
    acidAccent: [
      1, 0, 1, 1, 0, 0, 1, 1, 1, 0, 1, 0, 0, 1, 1, 0,
      1, 0, 1, 1, 1, 1, 1, 1, 0, 0, 1, 1, 1, 0, 1, 1,
    ],
    leadA: [
      60, 0, 63, 66, 67, 0, 66, 63, 60, 0, 65, 63, 60, 0, 58, 60,
      60, 63, 66, 67, 70, 0, 67, 66, 63, 60, 72, 0, 70, 67, 66, 63,
    ],
    leadB: [
      72, 0, 75, 78, 79, 78, 75, 72, 72, 75, 77, 75, 72, 70, 67, 70,
      72, 75, 78, 79, 82, 79, 78, 75, 72, 75, 78, 79, 84, 82, 79, 75,
    ],
    stab: [
      48, 0, 0, 48, 0, 0, 51, 0, 0, 0, 54, 0, 0, 0, 51, 0,
      48, 0, 0, 48, 0, 0, 55, 0, 54, 0, 51, 0, 54, 0, 55, 0,
    ],
    drumsA: [
      'KC', 'H', 'KH', 'g', 'SH', 'K', 'KO', 'gH', 'KH', 'gH', 'KH', 'H', 'SH', 'K', 'KO', 'g',
      'KH', 'H', 'KH', 'g', 'SH', 'K', 'KH', 'H', 'KO', 'g', 'KH', 'M', 'S', 'T', 'S', 'KT',
    ],
    drumsB: [
      'KC', 'K', 'KH', 'g', 'SM', 'K', 'KO', 'gH', 'KH', 'K', 'KH', 'g', 'SM', 'K', 'KO', 'g',
      'KH', 'K', 'KH', 'g', 'SH', 'K', 'KO', 'M', 'KH', 'S', 'KH', 'S', 'S', 'S', 'KT', 'KS',
    ],
    acidQ: 7.5,
    leadType: 'hoover',
    drive: 1.55,
  },
  cutscene: {
    // 124 BPM dark industrial cyber-breakbeat (muffled brooding underground bass)
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
    // 160 BPM Contra: Hard Corps Stage 1 ("The Hard Corps") Genesis Rave-Metal Assault!
    bpm: 160,
    bassA: [
      38, 38, 50, 38, 41, 38, 45, 38, 44, 38, 41, 38, 40, 38, 45, 44,
      38, 38, 50, 38, 41, 44, 45, 48, 45, 44, 41, 40, 38, 40, 41, 45,
    ],
    bassB: [
      38, 50, 38, 50, 41, 53, 44, 45, 38, 50, 48, 45, 44, 41, 40, 38,
      38, 50, 48, 45, 44, 45, 48, 50, 53, 50, 48, 45, 44, 41, 40, 38,
    ],
    acidAccent: [
      1, 0, 1, 0, 1, 0, 1, 1, 1, 0, 1, 0, 1, 0, 1, 1,
      1, 0, 1, 1, 0, 1, 1, 1, 1, 1, 0, 1, 1, 0, 1, 1,
    ],
    leadA: [
      62, 65, 69, 62, 74, 0, 72, 69, 68, 65, 62, 65, 68, 69, 74, 0,
      74, 72, 69, 68, 69, 72, 74, 77, 74, 72, 69, 68, 65, 68, 69, 65,
    ],
    leadB: [
      74, 77, 81, 74, 86, 84, 81, 77, 80, 77, 74, 77, 80, 81, 86, 81,
      86, 84, 81, 80, 81, 84, 86, 89, 86, 84, 81, 80, 77, 74, 72, 69,
    ],
    stab: [
      50, 0, 0, 50, 0, 0, 53, 0, 56, 0, 55, 0, 0, 0, 53, 0,
      50, 0, 50, 0, 0, 0, 57, 0, 56, 0, 55, 0, 53, 0, 57, 56,
    ],
    drumsA: [
      'KC', 'H', 'KH', 'g', 'SH', 'K', 'KH', 'gH', 'KO', 'gH', 'KH', 'H', 'SH', 'K', 'KH', 'g',
      'KH', 'H', 'KH', 'g', 'SH', 'K', 'KO', 'H', 'KH', 'g', 'KH', 'M', 'S', 'S', 'T', 'KT',
    ],
    drumsB: [
      'KC', 'K', 'KH', 'g', 'SM', 'K', 'KO', 'gH', 'KH', 'K', 'KH', 'g', 'SM', 'K', 'KO', 'g',
      'KH', 'K', 'KH', 'K', 'SH', 'K', 'KO', 'M', 'KH', 'S', 'KH', 'S', 'S', 'S', 'KT', 'KS',
    ],
    acidQ: 7.5,
    leadType: 'fm_shred',
    drive: 1.65,
  },
  level2: {
    // 164 BPM Prodigy "Voodoo People / Poison" Acid Breakbeat Rave!
    bpm: 164,
    bassA: [
      40, 40, 52, 40, 43, 40, 46, 47, 40, 40, 52, 50, 47, 46, 43, 42,
      40, 40, 52, 40, 46, 47, 50, 52, 47, 46, 43, 40, 43, 46, 47, 50,
    ],
    bassB: [
      40, 52, 40, 43, 46, 47, 52, 47, 40, 52, 50, 47, 46, 43, 42, 40,
      40, 52, 55, 52, 50, 47, 46, 43, 40, 43, 46, 47, 50, 52, 55, 52,
    ],
    acidAccent: [
      1, 0, 1, 1, 1, 0, 1, 1, 1, 0, 1, 1, 0, 1, 1, 1,
      1, 1, 1, 0, 1, 1, 1, 1, 1, 0, 1, 1, 1, 1, 1, 1,
    ],
    leadA: [
      64, 67, 70, 71, 64, 76, 71, 70, 67, 64, 67, 70, 71, 74, 71, 67,
      76, 74, 71, 70, 71, 74, 76, 79, 76, 74, 71, 70, 67, 70, 71, 74,
    ],
    leadB: [
      76, 79, 82, 83, 76, 88, 83, 82, 79, 76, 79, 82, 83, 86, 83, 79,
      88, 86, 83, 82, 83, 86, 88, 91, 88, 86, 83, 82, 79, 76, 74, 71,
    ],
    stab: [
      52, 0, 0, 52, 0, 0, 55, 0, 58, 0, 55, 0, 57, 0, 55, 0,
      52, 0, 52, 0, 55, 0, 58, 0, 59, 0, 58, 0, 55, 0, 59, 0,
    ],
    drumsA: [
      'KC', 'H', 'KH', 'g', 'SH', 'K', 'KO', 'gH', 'H', 'KH', 'KH', 'g', 'SH', 'K', 'KO', 'g',
      'KH', 'g', 'KH', 'H', 'SH', 'K', 'KH', 'g', 'KO', 'g', 'KH', 'M', 'S', 'g', 'S', 'KT',
    ],
    drumsB: [
      'KC', 'K', 'KH', 'g', 'SM', 'K', 'KO', 'gH', 'KH', 'g', 'KH', 'K', 'SM', 'g', 'KO', 'g',
      'KH', 'K', 'KH', 'g', 'SH', 'K', 'KO', 'g', 'KH', 'S', 'KH', 'S', 'S', 'S', 'KT', 'KS',
    ],
    acidQ: 8.5,
    leadType: 'hoover',
    drive: 1.75,
  },
  level3: {
    // 170 BPM Industrial Cyberpunk Hardcore Techno (GTR Attack! / Factory Assault)
    bpm: 170,
    bassA: [
      36, 36, 48, 36, 42, 36, 43, 36, 39, 36, 48, 46, 43, 42, 39, 38,
      36, 36, 48, 36, 43, 42, 39, 36, 48, 46, 43, 42, 43, 46, 48, 51,
    ],
    bassB: [
      36, 48, 36, 42, 43, 36, 48, 42, 36, 48, 51, 48, 46, 43, 42, 39,
      36, 36, 48, 42, 43, 46, 48, 51, 54, 51, 48, 46, 43, 42, 39, 36,
    ],
    acidAccent: [
      1, 1, 1, 0, 1, 0, 1, 1, 1, 0, 1, 1, 0, 1, 1, 1,
      1, 1, 1, 1, 1, 1, 0, 1, 1, 1, 1, 1, 1, 1, 1, 1,
    ],
    leadA: [
      60, 63, 66, 67, 60, 72, 67, 66, 63, 60, 72, 70, 67, 66, 63, 60,
      72, 70, 67, 66, 67, 70, 72, 75, 72, 70, 67, 66, 63, 62, 60, 58,
    ],
    leadB: [
      72, 75, 78, 79, 72, 84, 79, 78, 75, 72, 84, 82, 79, 78, 75, 72,
      84, 82, 79, 78, 79, 82, 84, 87, 84, 82, 79, 78, 75, 74, 72, 70,
    ],
    stab: [
      48, 0, 48, 0, 0, 0, 54, 0, 48, 0, 51, 0, 0, 0, 54, 0,
      48, 0, 48, 0, 54, 0, 55, 0, 54, 0, 51, 0, 54, 0, 55, 54,
    ],
    drumsA: [
      'KC', 'H', 'KH', 'K', 'SM', 'K', 'KH', 'H', 'KH', 'K', 'KO', 'H', 'SM', 'g', 'KH', 'H',
      'KH', 'H', 'KH', 'K', 'SM', 'K', 'KO', 'H', 'KH', 'K', 'SH', 'K', 'S', 'T', 'S', 'KT',
    ],
    drumsB: [
      'KC', 'K', 'KH', 'K', 'SM', 'K', 'KO', 'K', 'KH', 'K', 'KM', 'K', 'SM', 'K', 'KO', 'g',
      'KC', 'K', 'KH', 'K', 'SM', 'K', 'KO', 'K', 'KH', 'S', 'KM', 'S', 'S', 'S', 'KT', 'KS',
    ],
    acidQ: 8.0,
    leadType: 'siren',
    drive: 1.85,
  },
  level4: {
    // 180 BPM Turbo Highway Jungle / Drum'n'Bass Contra Rave!
    bpm: 180,
    bassA: [
      41, 41, 53, 41, 44, 41, 48, 41, 47, 41, 53, 51, 48, 47, 44, 43,
      41, 41, 53, 41, 48, 51, 53, 56, 53, 51, 48, 47, 44, 47, 48, 53,
    ],
    bassB: [
      41, 53, 41, 53, 44, 56, 48, 53, 47, 41, 53, 51, 48, 47, 44, 41,
      41, 53, 56, 53, 51, 48, 47, 44, 41, 44, 47, 48, 51, 53, 56, 60,
    ],
    acidAccent: [
      1, 0, 1, 1, 1, 0, 1, 0, 1, 0, 1, 1, 1, 0, 1, 0,
      1, 1, 1, 0, 1, 1, 1, 1, 1, 1, 0, 1, 1, 1, 1, 1,
    ],
    leadA: [
      65, 68, 72, 77, 75, 72, 68, 72, 71, 72, 75, 77, 80, 77, 75, 72,
      77, 75, 72, 68, 72, 75, 77, 80, 82, 80, 77, 75, 72, 75, 77, 80,
    ],
    leadB: [
      77, 80, 84, 89, 87, 84, 80, 84, 83, 84, 87, 89, 92, 89, 87, 84,
      89, 87, 84, 80, 84, 87, 89, 92, 94, 92, 89, 87, 84, 80, 77, 75,
    ],
    stab: [
      53, 0, 0, 53, 0, 0, 56, 0, 59, 0, 58, 0, 0, 0, 60, 0,
      53, 0, 53, 0, 56, 0, 60, 0, 59, 0, 58, 0, 56, 0, 60, 59,
    ],
    drumsA: [
      'KC', 'H', 'KH', 'g', 'SH', 'H', 'KO', 'gH', 'H', 'KH', 'KO', 'g', 'SH', 'K', 'KH', 'g',
      'KH', 'H', 'KH', 'g', 'SH', 'K', 'KO', 'g', 'KH', 'g', 'KH', 'g', 'S', 'S', 'T', 'KT',
    ],
    drumsB: [
      'KC', 'g', 'KH', 'g', 'SM', 'K', 'KO', 'gH', 'KH', 'g', 'KO', 'g', 'SM', 'g', 'KH', 'g',
      'KH', 'K', 'KH', 'g', 'SH', 'g', 'KO', 'M', 'KH', 'S', 'g', 'S', 'S', 'S', 'KT', 'KS',
    ],
    acidQ: 8.0,
    leadType: 'fm_shred',
    drive: 1.75,
  },
  elevator: {
    // 176 BPM High-Speed Vertical Freight Elevator Industrial Drum'n'Bass Assault!
    bpm: 176,
    bassA: [
      37, 37, 49, 37, 40, 37, 43, 44, 37, 37, 49, 47, 44, 43, 40, 39,
      37, 37, 49, 37, 44, 47, 49, 52, 49, 47, 44, 43, 40, 43, 44, 49,
    ],
    bassB: [
      37, 49, 37, 43, 44, 37, 49, 43, 37, 49, 52, 49, 47, 44, 43, 40,
      37, 37, 49, 44, 47, 49, 52, 55, 52, 49, 47, 44, 43, 40, 39, 37,
    ],
    acidAccent: [
      1, 0, 1, 1, 0, 1, 1, 1, 1, 0, 1, 1, 1, 0, 1, 1,
      1, 1, 1, 0, 1, 1, 1, 1, 1, 1, 0, 1, 1, 1, 1, 1,
    ],
    leadA: [
      61, 64, 67, 68, 61, 73, 68, 67, 64, 61, 73, 71, 68, 67, 64, 61,
      73, 71, 68, 67, 68, 71, 73, 76, 73, 71, 68, 67, 64, 67, 68, 71,
    ],
    leadB: [
      73, 76, 79, 80, 73, 85, 80, 79, 76, 73, 85, 83, 80, 79, 76, 73,
      85, 83, 80, 79, 80, 83, 85, 88, 85, 83, 80, 79, 76, 73, 71, 68,
    ],
    stab: [
      49, 0, 0, 49, 0, 0, 52, 0, 55, 0, 52, 0, 0, 0, 56, 0,
      49, 0, 49, 0, 55, 0, 56, 0, 55, 0, 52, 0, 55, 0, 56, 55,
    ],
    drumsA: [
      'KC', 'H', 'KH', 'g', 'SM', 'K', 'KO', 'g', 'KH', 'g', 'KM', 'H', 'SM', 'K', 'KO', 'g',
      'KH', 'H', 'KH', 'K', 'SM', 'K', 'KO', 'g', 'KH', 'K', 'SM', 'g', 'S', 'T', 'S', 'KT',
    ],
    drumsB: [
      'KC', 'K', 'KM', 'g', 'SM', 'K', 'KO', 'g', 'KH', 'K', 'KM', 'K', 'SM', 'K', 'KO', 'g',
      'KC', 'K', 'KH', 'K', 'SM', 'K', 'KO', 'K', 'KM', 'S', 'KH', 'S', 'S', 'S', 'KT', 'KS',
    ],
    acidQ: 8.2,
    leadType: 'siren',
    drive: 1.85,
  },
  level5: {
    // 174 BPM Dark Factory Penthouse Hardcore Gabber-Metal Rave
    bpm: 174,
    bassA: [
      34, 34, 46, 34, 37, 34, 40, 41, 34, 34, 46, 44, 41, 40, 37, 36,
      34, 34, 46, 34, 41, 40, 37, 34, 46, 44, 41, 40, 41, 44, 46, 49,
    ],
    bassB: [
      34, 46, 34, 40, 41, 34, 46, 40, 34, 46, 49, 46, 44, 41, 40, 37,
      34, 34, 46, 40, 41, 44, 46, 49, 52, 49, 46, 44, 41, 40, 37, 34,
    ],
    acidAccent: [
      1, 1, 1, 0, 1, 0, 1, 1, 1, 0, 1, 1, 1, 1, 0, 1,
      1, 1, 1, 0, 1, 1, 1, 0, 1, 1, 1, 1, 1, 1, 1, 1,
    ],
    leadA: [
      58, 61, 65, 64, 61, 58, 65, 68, 70, 68, 65, 64, 61, 60, 58, 61,
      70, 68, 65, 64, 65, 68, 70, 73, 76, 73, 70, 68, 65, 64, 61, 58,
    ],
    leadB: [
      70, 73, 77, 76, 73, 70, 77, 80, 82, 80, 77, 76, 73, 72, 70, 73,
      82, 80, 77, 76, 77, 80, 82, 85, 88, 85, 82, 80, 77, 76, 73, 70,
    ],
    stab: [
      46, 0, 46, 0, 0, 0, 52, 0, 46, 0, 49, 0, 0, 0, 52, 0,
      46, 0, 46, 0, 52, 0, 53, 0, 52, 0, 49, 0, 52, 0, 53, 52,
    ],
    drumsA: [
      'KC', 'H', 'KH', 'K', 'SM', 'K', 'KO', 'g', 'KH', 'K', 'KH', 'g', 'SM', 'K', 'KH', 'H',
      'KH', 'K', 'KH', 'K', 'SH', 'K', 'KO', 'K', 'KH', 'K', 'SH', 'K', 'S', 'S', 'T', 'KT',
    ],
    drumsB: [
      'KC', 'K', 'KM', 'K', 'SM', 'K', 'KO', 'K', 'KH', 'K', 'KM', 'K', 'SM', 'K', 'KO', 'K',
      'KC', 'K', 'KH', 'K', 'SM', 'K', 'KO', 'K', 'KM', 'S', 'KH', 'S', 'S', 'S', 'KT', 'KS',
    ],
    acidQ: 8.2,
    leadType: 'hoover',
    drive: 1.9,
  },
  boss: {
    // 182 BPM PURE CONTRA HARD CORPS ("Last Springsteen") × PRODIGY "SMACK MY BITCH UP / FIRESTARTER" BOSS FURY!
    bpm: 182,
    bassA: [
      33, 33, 45, 34, 33, 39, 33, 36, 33, 33, 45, 44, 40, 39, 36, 34,
      33, 33, 45, 34, 39, 40, 45, 48, 45, 44, 40, 39, 36, 39, 40, 44,
    ],
    bassB: [
      33, 45, 34, 46, 33, 45, 39, 45, 33, 45, 48, 45, 44, 40, 39, 36,
      33, 33, 45, 46, 48, 51, 52, 48, 45, 44, 40, 39, 36, 34, 33, 39,
    ],
    acidAccent: [
      1, 1, 1, 1, 1, 1, 0, 1, 1, 1, 1, 1, 1, 1, 1, 1,
      1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1,
    ],
    leadA: [
      69, 72, 75, 76, 75, 72, 70, 69, 81, 80, 76, 75, 72, 70, 69, 64,
      69, 75, 76, 81, 80, 76, 75, 72, 81, 84, 83, 81, 80, 76, 75, 72,
    ],
    leadB: [
      81, 84, 87, 88, 87, 84, 82, 81, 93, 92, 88, 87, 84, 82, 81, 76,
      81, 87, 88, 93, 92, 88, 87, 84, 93, 92, 88, 87, 84, 81, 76, 75,
    ],
    stab: [
      45, 0, 46, 0, 45, 0, 51, 0, 45, 0, 52, 0, 51, 0, 48, 46,
      45, 0, 46, 0, 51, 0, 52, 0, 57, 0, 52, 0, 51, 0, 48, 46,
    ],
    drumsA: [
      'KC', 'K', 'KH', 'g', 'SM', 'K', 'KO', 'g', 'KH', 'K', 'KM', 'g', 'SM', 'K', 'KO', 'g',
      'KC', 'K', 'KH', 'K', 'SM', 'K', 'KO', 'K', 'KH', 'S', 'KM', 'S', 'S', 'S', 'KT', 'KS',
    ],
    drumsB: [
      'KC', 'K', 'KM', 'K', 'SM', 'K', 'KO', 'K', 'KC', 'K', 'KM', 'K', 'SM', 'K', 'KO', 'K',
      'KC', 'K', 'KM', 'K', 'SM', 'K', 'KO', 'K', 'SM', 'S', 'SM', 'S', 'KS', 'KS', 'KT', 'KSC',
    ],
    acidQ: 8.5,
    leadType: 'siren',
    drive: 2.0,
  },
  victory: {
    // 144 BPM Triumphant 16-bit Sega Rave-Funk Finale!
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
    // 108 BPM Endless OutRun / Vice City / Malibu Sunrise Analog Synthwave
    // Progression: Am9 -> Fmaj7 -> Cadd9 -> G6 (warm Juno pads, rolling Moog bass, gated 80s snare)
    bpm: 108,
    isSynthwave: true,
    padChords: [
      [57, 60, 64, 71], // Bar 1: Am9
      [53, 57, 60, 64], // Bar 2: Fmaj7
      [52, 55, 60, 62], // Bar 3: Cadd9
      [55, 59, 62, 64], // Bar 4: G6
    ],
    bassA: [
      // Bar 1: A minor rolling 16ths
      33, 33, 45, 33, 33, 45, 33, 45, 33, 33, 45, 33, 33, 45, 36, 38,
      // Bar 2: F major rolling 16ths
      41, 41, 53, 41, 41, 53, 41, 53, 41, 41, 53, 41, 41, 43, 41, 40,
    ],
    bassB: [
      // Bar 3: C major rolling 16ths
      36, 36, 48, 36, 36, 48, 36, 48, 36, 36, 48, 36, 36, 48, 43, 40,
      // Bar 4: G major rolling 16ths leading back to Am
      43, 43, 55, 43, 43, 55, 43, 55, 43, 43, 55, 43, 43, 40, 38, 36,
    ],
    acidAccent: [
      1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0,
      1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0,
    ],
    leadA: [
      // Nostalgic coastal sunrise melody (Am -> F)
      76, 0, 0, 72, 0, 76, 79, 0, 76, 0, 72, 0, 71, 0, 69, 0,
      72, 0, 0, 69, 0, 72, 76, 0, 74, 0, 72, 0, 69, 0, 67, 0,
    ],
    leadB: [
      // Soaring Vice City chorus hook (C -> G)
      79, 0, 0, 76, 0, 79, 84, 0, 83, 0, 79, 0, 76, 0, 74, 0,
      76, 0, 74, 0, 71, 0, 74, 0, 76, 0, 74, 71, 69, 0, 71, 0,
    ],
    // Shimmering 80s synth-bell arpeggio triggers (MIDI notes)
    stab: [
      69, 72, 76, 81, 76, 72, 69, 72, 76, 81, 79, 76, 72, 76, 79, 76,
      65, 69, 72, 77, 72, 69, 65, 69, 72, 76, 72, 69, 65, 69, 72, 76,
    ],
    drumsA: [
      'KC', 'H', 'H', 'H', 'SH', 'H', 'O', 'H', 'KH', 'H', 'KH', 'H', 'SH', 'H', 'O', 'H',
      'KH', 'H', 'H', 'H', 'SH', 'H', 'O', 'H', 'KH', 'H', 'KH', 'H', 'SH', 'H', 'O', 'H',
    ],
    drumsB: [
      'KH', 'H', 'H', 'H', 'SH', 'H', 'O', 'H', 'KH', 'H', 'KH', 'H', 'SH', 'H', 'O', 'H',
      'KH', 'H', 'H', 'H', 'SH', 'H', 'O', 'H', 'KH', 'H', 'KH', 'H', 'ST', 'T', 'T', 'KT',
    ],
    drive: 1.05,
  },
};

function midiToFreq(midi: number): number {
  const f = 440 * Math.pow(2, (midi - 69) / 12);
  return Math.max(28, Math.min(12000, f));
}

function clampFreq(f: number): number {
  return Math.max(30, Math.min(14000, f));
}

// Guaranteed-finite soft-clipping tanh limiter curve (NEVER latches NaN like Chromium DynamicsCompressor!)
function makeTanhCurve(gain: number): Float32Array<ArrayBuffer> {
  const samples = 1024;
  const buffer = new ArrayBuffer(samples * 4);
  const curve = new Float32Array(buffer);
  for (let i = 0; i < samples; i++) {
    const x = (i * 2) / samples - 1;
    curve[i] = Math.tanh(x * gain);
  }
  return curve;
}

// Explicitly disconnects every node in a short-lived synth voice once finished so Web Audio never leaks or stalls!
function bindCleanup(source: AudioScheduledSourceNode, nodes: AudioNode[]): void {
  source.onended = () => {
    for (let i = 0; i < nodes.length; i++) {
      try {
        nodes[i].disconnect();
      } catch {
        // Ignore already-disconnected nodes
      }
    }
    source.onended = null;
  };
}

class SoundEngine {
  private ctx: AudioContext | null = null;
  private masterLimiter: WaveShaperNode | null = null;
  private masterGain: GainNode | null = null;
  private musicGain: GainNode | null = null;
  private musicDrive: WaveShaperNode | null = null;
  private sfxGain: GainNode | null = null;
  private noiseBuffer: AudioBuffer | null = null;
  private muted = false;

  private currentTrack: MusicTrack = 'none';
  private stepIndex = 0; // 0..63 (full 4-bar evolving rave-metal loop!)
  private nextNoteTime = 0;
  private schedulerTimer: number | null = null;

  // SFX throttle map to prevent minigun/explosion spam from saturating the audio thread
  private lastSfxTime: Record<string, number> = {};

  public unlock(): void {
    if (!this.ctx) {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return;
      this.ctx = new AudioCtx();

      this.masterGain = this.ctx.createGain();
      this.musicGain = this.ctx.createGain();
      this.sfxGain = this.ctx.createGain();

      // Zero-NaN Sega Mega Drive YM2612 DAC / Prodigy overdrive bus (oversample 'none' for ultra-low CPU)
      this.musicDrive = this.ctx.createWaveShaper();
      this.musicDrive.curve = makeTanhCurve(2.2);
      this.musicDrive.oversample = 'none';

      // Zero-NaN soft-clipping master limiter (replaces DynamicsCompressorNode which can latch silent in Chrome!)
      this.masterLimiter = this.ctx.createWaveShaper();
      this.masterLimiter.curve = makeTanhCurve(1.45);
      this.masterLimiter.oversample = 'none';

      this.masterGain.gain.value = this.muted ? 0 : 0.46;
      this.musicGain.gain.value = 0.36;
      this.sfxGain.gain.value = 0.72;

      this.musicDrive.connect(this.musicGain);
      this.musicGain.connect(this.masterLimiter);
      this.sfxGain.connect(this.masterLimiter);
      this.masterLimiter.connect(this.masterGain);
      this.masterGain.connect(this.ctx.destination);

      this.noiseBuffer = this.createNoiseBuffer(this.ctx);
    }

    if (this.ctx && this.ctx.state !== 'running') {
      this.ctx.resume().catch(() => {});
    }
  }

  private createNoiseBuffer(ctx: AudioContext): AudioBuffer {
    const length = Math.floor(ctx.sampleRate * 0.8);
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    // Slightly crunchy 12-bit quantized white noise for authentic Sega Mega Drive DAC percussion
    for (let i = 0; i < length; i++) {
      const raw = Math.random() * 2 - 1;
      data[i] = Math.round(raw * 32) / 32;
    }
    return buffer;
  }

  private allowSfx(key: string, minGapMs: number): boolean {
    const now = performance.now();
    const prev = this.lastSfxTime[key] ?? 0;
    if (now - prev < minGapMs) return false;
    this.lastSfxTime[key] = now;
    return true;
  }

  public setMuted(muted: boolean): void {
    this.muted = muted;
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setTargetAtTime(muted ? 0 : 0.46, this.ctx.currentTime, 0.02);
    }
  }

  public isMuted(): boolean {
    return this.muted;
  }

  public playMusic(track: MusicTrack): void {
    if (this.currentTrack === track && this.schedulerTimer !== null) {
      if (this.ctx && this.ctx.state !== 'running') {
        this.ctx.resume().catch(() => {});
      }
      return;
    }
    this.stopMusic();
    this.currentTrack = track;
    if (track === 'none') return;

    const pattern = TRACKS[track];
    if (this.musicDrive) {
      this.musicDrive.curve = makeTanhCurve(pattern.drive ?? 1.7);
    }

    this.stepIndex = 0;
    this.nextNoteTime = this.ctx ? this.ctx.currentTime + 0.05 : 0;

    // Bulletproof 25ms lookahead scheduler with max-2-step burst cap to prevent audio overload/stalls
    this.schedulerTimer = window.setInterval(() => {
      if (this.muted || !this.ctx) return;
      if (this.ctx.state !== 'running') {
        this.nextNoteTime = this.ctx.currentTime + 0.05;
        return;
      }

      const now = this.ctx.currentTime;
      const stepDur = 60 / pattern.bpm / 4; // 16th-note grid

      // Recover cleanly after tab backgrounding or frame hitch without bursting old notes
      if (this.nextNoteTime < now - 0.1 || this.nextNoteTime > now + 0.5) {
        this.nextNoteTime = now + 0.03;
      }

      let scheduledThisTick = 0;
      while (this.nextNoteTime < now + 0.085 && scheduledThisTick < 2) {
        try {
          this.scheduleStep(pattern, this.stepIndex, this.nextNoteTime, stepDur);
        } catch {
          // Never allow a scheduling error to stall the interval loop
        }
        this.nextNoteTime += stepDur;
        this.stepIndex = (this.stepIndex + 1) % 64;
        scheduledThisTick++;
      }
    }, 25);
  }

  public stopMusic(): void {
    if (this.schedulerTimer !== null) {
      window.clearInterval(this.schedulerTimer);
      this.schedulerTimer = null;
    }
    this.currentTrack = 'none';
  }

  private scheduleStep(pattern: TrackPattern, step64: number, time: number, stepDur: number): void {
    if (!this.ctx || !this.musicDrive) return;
    if (pattern.isSynthwave) {
      this.scheduleSynthwaveStep(pattern, step64, time, stepDur);
      return;
    }
    const bus = this.musicDrive;
    const isSectionB = step64 >= 32;
    const step = step64 % 32;

    // 1. YM2612 Slap-Metal FM + Resonant TB-303 Acid Bass + Tight Sub Punch
    const bassSeq = isSectionB ? pattern.bassB : pattern.bassA;
    const bassNote = bassSeq[step];
    if (bassNote > 0) {
      const accent = pattern.acidAccent[step] === 1;
      const freq = midiToFreq(bassNote);

      const osc = this.ctx.createOscillator();
      const mod = this.ctx.createOscillator();
      const modGain = this.ctx.createGain();
      const filter = this.ctx.createBiquadFilter();
      const env = this.ctx.createGain();

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(freq, time);

      // Safe FM modulation depth (capped strictly below freq * 0.78 so frequency NEVER folds negative!)
      mod.type = 'square';
      mod.frequency.setValueAtTime(clampFreq(freq * 2), time);
      const safeModDepth = Math.min(freq * 0.78, pattern.muffled ? 28 : accent ? 115 : 62);
      modGain.gain.setValueAtTime(safeModDepth, time);
      modGain.gain.exponentialRampToValueAtTime(4, time + stepDur * 0.85);

      // Acid 303 resonant lowpass sweep (safe Q <= 8.5 prevents IIR instability!)
      filter.type = 'lowpass';
      filter.Q.setValueAtTime(Math.min(8.5, pattern.muffled ? 3.5 : pattern.acidQ ?? 7.5), time);
      const startCut = pattern.muffled ? 420 : accent ? 2500 : 1050;
      const endCut = pattern.muffled ? 170 : accent ? 340 : 210;
      filter.frequency.setValueAtTime(clampFreq(startCut), time);
      filter.frequency.exponentialRampToValueAtTime(clampFreq(endCut), time + stepDur * 0.92);

      env.gain.setValueAtTime(0.001, time);
      env.gain.linearRampToValueAtTime(accent ? 0.34 : 0.25, time + 0.005);
      env.gain.exponentialRampToValueAtTime(0.001, time + stepDur * 1.1);

      mod.connect(modGain);
      modGain.connect(osc.frequency);
      osc.connect(filter);
      filter.connect(env);
      env.connect(bus);

      const stopTime = time + stepDur * 1.15;
      bindCleanup(osc, [osc, mod, modGain, filter, env]);
      osc.start(time);
      mod.start(time);
      osc.stop(stopTime);
      mod.stop(stopTime);
    }

    // 2. Screaming Contra: Hard Corps FM Shred / Prodigy Detuned Hoover Lead
    const leadSeq = isSectionB ? pattern.leadB : pattern.leadA;
    const leadNote = leadSeq[step];
    if (leadNote > 0) {
      const freq = midiToFreq(leadNote);
      const osc1 = this.ctx.createOscillator();
      const osc2 = this.ctx.createOscillator();
      const filter = this.ctx.createBiquadFilter();
      const env = this.ctx.createGain();

      osc1.type = pattern.leadType === 'fm_shred' ? 'square' : 'sawtooth';
      osc2.type = 'sawtooth';
      osc1.frequency.setValueAtTime(freq, time);
      osc2.frequency.setValueAtTime(freq, time);
      osc1.detune.setValueAtTime(-14, time);
      osc2.detune.setValueAtTime(14, time);

      // Prodigy Hoover pitch-swoop / Boss siren bend
      if (pattern.leadType === 'hoover' && step % 4 === 0) {
        osc1.frequency.setValueAtTime(clampFreq(freq * 0.92), time);
        osc1.frequency.exponentialRampToValueAtTime(freq, time + stepDur * 0.45);
        osc2.frequency.setValueAtTime(clampFreq(freq * 0.92), time);
        osc2.frequency.exponentialRampToValueAtTime(freq, time + stepDur * 0.45);
      } else if (pattern.leadType === 'siren' && step % 4 === 0) {
        osc1.frequency.exponentialRampToValueAtTime(clampFreq(freq * 1.045), time + stepDur * 0.5);
        osc1.frequency.exponentialRampToValueAtTime(freq, time + stepDur * 1.05);
      }

      filter.type = 'lowpass';
      filter.Q.setValueAtTime(pattern.muffled ? 2 : 4.5, time);
      filter.frequency.setValueAtTime(clampFreq(pattern.muffled ? 560 : isSectionB ? 4400 : 3500), time);
      filter.frequency.exponentialRampToValueAtTime(clampFreq(pattern.muffled ? 280 : 1100), time + stepDur * 1.15);

      const dur = stepDur * 1.25;
      env.gain.setValueAtTime(0.001, time);
      env.gain.linearRampToValueAtTime(pattern.muffled ? 0.1 : isSectionB ? 0.16 : 0.13, time + 0.006);
      env.gain.exponentialRampToValueAtTime(0.001, time + dur);

      osc1.connect(filter);
      osc2.connect(filter);
      filter.connect(env);
      env.connect(bus);

      const stopTime = time + dur + 0.015;
      bindCleanup(osc1, [osc1, osc2, filter, env]);
      osc1.start(time);
      osc2.start(time);
      osc1.stop(stopTime);
      osc2.stop(stopTime);
    }

    // 3. 90s Genesis Hardcore Rave Power-Chord Stabs (3 voices for lean CPU + brutal punch)
    const stabRoot = pattern.stab[step];
    if (stabRoot > 0) {
      const intervals = isSectionB ? [0, 6, 12] : [0, 3, 7]; // tritone rave tension on section B!
      const stabFilter = this.ctx.createBiquadFilter();
      const stabEnv = this.ctx.createGain();
      stabFilter.type = 'bandpass';
      stabFilter.Q.setValueAtTime(1.5, time);
      stabFilter.frequency.setValueAtTime(clampFreq(pattern.muffled ? 650 : 2200), time);
      stabFilter.frequency.exponentialRampToValueAtTime(clampFreq(pattern.muffled ? 320 : 720), time + stepDur * 1.45);

      stabEnv.gain.setValueAtTime(0.001, time);
      stabEnv.gain.linearRampToValueAtTime(pattern.muffled ? 0.11 : 0.17, time + 0.005);
      stabEnv.gain.exponentialRampToValueAtTime(0.001, time + stepDur * 1.5);

      stabFilter.connect(stabEnv);
      stabEnv.connect(bus);

      const stopTime = time + stepDur * 1.55;
      const oscs: OscillatorNode[] = [];
      for (let i = 0; i < intervals.length; i++) {
        const o = this.ctx.createOscillator();
        o.type = 'sawtooth';
        o.frequency.setValueAtTime(midiToFreq(stabRoot + intervals[i]), time);
        o.connect(stabFilter);
        o.start(time);
        o.stop(stopTime);
        oscs.push(o);
      }
      bindCleanup(oscs[0], [...oscs, stabFilter, stabEnv]);
    }

    // 4. Hardcore Prodigy Breakbeat & Sega MD Industrial Drums
    const drumSeq = isSectionB ? pattern.drumsB : pattern.drumsA;
    const drumToken = drumSeq[step] ?? '';
    if (drumToken.includes('K')) this.triggerKick(time, bus, pattern.muffled);
    if (drumToken.includes('S')) this.triggerSnare(time, bus, 0.36, pattern.muffled);
    if (drumToken.includes('g')) this.triggerSnare(time, bus, 0.14, pattern.muffled);
    if (drumToken.includes('H')) this.triggerHat(time, bus, 0.028, 0.09);
    if (drumToken.includes('O')) this.triggerHat(time, bus, 0.105, 0.14);
    if (drumToken.includes('C')) this.triggerCrash(time, bus);
    if (drumToken.includes('T')) this.triggerTom(time, bus, step % 2 === 0 ? 195 : 132);
    if (drumToken.includes('M')) this.triggerMetalClang(time, bus);
  }

  // Dedicated 80s OutRun / Vice City Analog Synthwave engine (zero-leak endless playback!)
  private scheduleSynthwaveStep(
    pattern: TrackPattern,
    step64: number,
    time: number,
    stepDur: number
  ): void {
    if (!this.ctx || !this.musicDrive) return;
    const bus = this.musicDrive;
    const isSectionB = step64 >= 32;
    const step = step64 % 32;
    const barIdx = Math.floor(step64 / 16) % 4;

    // 1. Lush Juno-106 Detuned Analog Pad Chord on every Bar start
    if (step64 % 16 === 0 && pattern.padChords && pattern.padChords[barIdx]) {
      const chord = pattern.padChords[barIdx];
      const barDur = stepDur * 16;
      const padFilter = this.ctx.createBiquadFilter();
      const padEnv = this.ctx.createGain();
      padFilter.type = 'lowpass';
      padFilter.Q.setValueAtTime(1.2, time);
      padFilter.frequency.setValueAtTime(520, time);
      padFilter.frequency.exponentialRampToValueAtTime(1450, time + barDur * 0.45);
      padFilter.frequency.exponentialRampToValueAtTime(640, time + barDur * 0.98);

      padEnv.gain.setValueAtTime(0.001, time);
      padEnv.gain.linearRampToValueAtTime(0.11, time + barDur * 0.14);
      padEnv.gain.setValueAtTime(0.1, time + barDur * 0.72);
      padEnv.gain.exponentialRampToValueAtTime(0.001, time + barDur + 0.08);

      padFilter.connect(padEnv);
      padEnv.connect(bus);

      const detunes = [-11, 9, -6, 13];
      const oscs: OscillatorNode[] = [];
      for (let i = 0; i < chord.length; i++) {
        const o = this.ctx.createOscillator();
        o.type = i === 0 ? 'triangle' : 'sawtooth';
        o.frequency.setValueAtTime(midiToFreq(chord[i]), time);
        o.detune.setValueAtTime(detunes[i % detunes.length], time);
        o.connect(padFilter);
        o.start(time);
        o.stop(time + barDur + 0.12);
        oscs.push(o);
      }
      if (oscs.length > 0) {
        bindCleanup(oscs[0], [...oscs, padFilter, padEnv]);
      }
    }

    // 2. Rolling 16th-note Warm Moog Analog Bass
    const bassSeq = isSectionB ? pattern.bassB : pattern.bassA;
    const bassNote = bassSeq[step];
    if (bassNote > 0) {
      const freq = midiToFreq(bassNote);
      const isStrong = step % 2 === 0;
      const osc = this.ctx.createOscillator();
      const sub = this.ctx.createOscillator();
      const filter = this.ctx.createBiquadFilter();
      const env = this.ctx.createGain();

      osc.type = 'sawtooth';
      sub.type = 'triangle';
      osc.frequency.setValueAtTime(freq, time);
      sub.frequency.setValueAtTime(freq, time);
      osc.detune.setValueAtTime(4, time);

      filter.type = 'lowpass';
      filter.Q.setValueAtTime(2.4, time);
      filter.frequency.setValueAtTime(clampFreq(isStrong ? 1180 : 720), time);
      filter.frequency.exponentialRampToValueAtTime(210, time + stepDur * 0.92);

      env.gain.setValueAtTime(0.001, time);
      env.gain.linearRampToValueAtTime(isStrong ? 0.25 : 0.17, time + 0.008);
      env.gain.exponentialRampToValueAtTime(0.001, time + stepDur * 0.98);

      osc.connect(filter);
      sub.connect(filter);
      filter.connect(env);
      env.connect(bus);

      const stopT = time + stepDur * 1.05;
      bindCleanup(osc, [osc, sub, filter, env]);
      osc.start(time);
      sub.start(time);
      osc.stop(stopT);
      sub.stop(stopT);
    }

    // 3. Shimmering Malibu Sunset Synth-Bell Arp (soft offbeat sparkle)
    const arpNote = pattern.stab[step];
    if (arpNote > 0 && step % 2 === 1) {
      const arpFreq = midiToFreq(arpNote + (isSectionB ? 0 : 0));
      const arpOsc = this.ctx.createOscillator();
      const arpEnv = this.ctx.createGain();
      arpOsc.type = 'triangle';
      arpOsc.frequency.setValueAtTime(arpFreq, time);
      arpEnv.gain.setValueAtTime(0.001, time);
      arpEnv.gain.linearRampToValueAtTime(0.065, time + 0.006);
      arpEnv.gain.exponentialRampToValueAtTime(0.001, time + stepDur * 1.6);
      arpOsc.connect(arpEnv);
      arpEnv.connect(bus);
      bindCleanup(arpOsc, [arpOsc, arpEnv]);
      arpOsc.start(time);
      arpOsc.stop(time + stepDur * 1.68);
    }

    // 4. Dreamy Retrowave OutRun Lead Melody (warm detuned analog synth)
    const leadSeq = isSectionB ? pattern.leadB : pattern.leadA;
    const leadNote = leadSeq[step];
    if (leadNote > 0) {
      const freq = midiToFreq(leadNote);
      const o1 = this.ctx.createOscillator();
      const o2 = this.ctx.createOscillator();
      const lpf = this.ctx.createBiquadFilter();
      const env = this.ctx.createGain();

      o1.type = 'sawtooth';
      o2.type = 'triangle';
      o1.frequency.setValueAtTime(freq, time);
      o2.frequency.setValueAtTime(freq, time);
      o1.detune.setValueAtTime(-9, time);
      o2.detune.setValueAtTime(9, time);

      lpf.type = 'lowpass';
      lpf.Q.setValueAtTime(2.0, time);
      lpf.frequency.setValueAtTime(2550, time);
      lpf.frequency.exponentialRampToValueAtTime(920, time + stepDur * 2.1);

      const dur = stepDur * 2.35;
      env.gain.setValueAtTime(0.001, time);
      env.gain.linearRampToValueAtTime(0.135, time + 0.018);
      env.gain.exponentialRampToValueAtTime(0.001, time + dur);

      o1.connect(lpf);
      o2.connect(lpf);
      lpf.connect(env);
      env.connect(bus);

      const stopT = time + dur + 0.03;
      bindCleanup(o1, [o1, o2, lpf, env]);
      o1.start(time);
      o2.start(time);
      o1.stop(stopT);
      o2.stop(stopT);
    }

    // 5. Classic 80s LinnDrum Kick, Wide Gated-Reverb Snare, Crisp Hats & Simmons Toms
    const drumSeq = isSectionB ? pattern.drumsB : pattern.drumsA;
    const drumToken = drumSeq[step] ?? '';
    if (drumToken.includes('K')) this.triggerKick(time, bus, true);
    if (drumToken.includes('S')) this.triggerGatedSnare(time, bus);
    if (drumToken.includes('H')) this.triggerHat(time, bus, 0.03, 0.055);
    if (drumToken.includes('O')) this.triggerHat(time, bus, 0.13, 0.08);
    if (drumToken.includes('C')) this.triggerCrash(time, bus);
    if (drumToken.includes('T')) {
      const tomPitches = [260, 210, 165, 125];
      this.triggerTom(time, bus, tomPitches[step % 4]);
    }
  }

  // Iconic 80s Vice City / Phil Collins / OutRun Gated Reverb Snare
  private triggerGatedSnare(time: number, dest: AudioNode): void {
    if (!this.ctx || !this.noiseBuffer) return;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const bp = this.ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.Q.setValueAtTime(0.75, time);
    bp.frequency.setValueAtTime(1750, time);
    const nEnv = this.ctx.createGain();
    nEnv.gain.setValueAtTime(0.28, time);
    nEnv.gain.setValueAtTime(0.22, time + 0.14);
    nEnv.gain.exponentialRampToValueAtTime(0.001, time + 0.24);
    src.connect(bp);
    bp.connect(nEnv);
    nEnv.connect(dest);
    bindCleanup(src, [src, bp, nEnv]);
    src.start(time);
    src.stop(time + 0.26);

    const body = this.ctx.createOscillator();
    const bEnv = this.ctx.createGain();
    body.type = 'triangle';
    body.frequency.setValueAtTime(215, time);
    body.frequency.exponentialRampToValueAtTime(105, time + 0.08);
    bEnv.gain.setValueAtTime(0.28, time);
    bEnv.gain.exponentialRampToValueAtTime(0.001, time + 0.11);
    body.connect(bEnv);
    bEnv.connect(dest);
    bindCleanup(body, [body, bEnv]);
    body.start(time);
    body.stop(time + 0.12);
  }

  private triggerKick(time: number, dest: AudioNode, muffled?: boolean): void {
    if (!this.ctx) return;
    const osc = this.ctx.createOscillator();
    const env = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(muffled ? 150 : 235, time);
    osc.frequency.exponentialRampToValueAtTime(40, time + 0.085);
    env.gain.setValueAtTime(0.64, time);
    env.gain.exponentialRampToValueAtTime(0.001, time + 0.13);
    osc.connect(env);
    env.connect(dest);
    bindCleanup(osc, [osc, env]);
    osc.start(time);
    osc.stop(time + 0.14);

    if (!muffled && this.noiseBuffer) {
      const click = this.ctx.createBufferSource();
      click.buffer = this.noiseBuffer;
      const bp = this.ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.setValueAtTime(3000, time);
      const cEnv = this.ctx.createGain();
      cEnv.gain.setValueAtTime(0.2, time);
      cEnv.gain.exponentialRampToValueAtTime(0.001, time + 0.016);
      click.connect(bp);
      bp.connect(cEnv);
      cEnv.connect(dest);
      bindCleanup(click, [click, bp, cEnv]);
      click.start(time);
      click.stop(time + 0.02);
    }
  }

  private triggerSnare(time: number, dest: AudioNode, vol: number, muffled?: boolean): void {
    if (!this.ctx || !this.noiseBuffer) return;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const bp = this.ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.Q.setValueAtTime(1.1, time);
    bp.frequency.setValueAtTime(muffled ? 850 : 2100, time);
    const nEnv = this.ctx.createGain();
    nEnv.gain.setValueAtTime(vol, time);
    nEnv.gain.exponentialRampToValueAtTime(0.001, time + 0.105);
    src.connect(bp);
    bp.connect(nEnv);
    nEnv.connect(dest);
    bindCleanup(src, [src, bp, nEnv]);
    src.start(time);
    src.stop(time + 0.115);

    const body = this.ctx.createOscillator();
    const bEnv = this.ctx.createGain();
    body.type = 'triangle';
    body.frequency.setValueAtTime(240, time);
    body.frequency.exponentialRampToValueAtTime(120, time + 0.06);
    bEnv.gain.setValueAtTime(vol * 0.78, time);
    bEnv.gain.exponentialRampToValueAtTime(0.001, time + 0.072);
    body.connect(bEnv);
    bEnv.connect(dest);
    bindCleanup(body, [body, bEnv]);
    body.start(time);
    body.stop(time + 0.078);
  }

  private triggerHat(time: number, dest: AudioNode, dur: number, vol: number): void {
    if (!this.ctx || !this.noiseBuffer) return;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const hp = this.ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.setValueAtTime(6800, time);
    const env = this.ctx.createGain();
    env.gain.setValueAtTime(vol, time);
    env.gain.exponentialRampToValueAtTime(0.001, time + dur);
    src.connect(hp);
    hp.connect(env);
    env.connect(dest);
    bindCleanup(src, [src, hp, env]);
    src.start(time);
    src.stop(time + dur + 0.01);
  }

  private triggerCrash(time: number, dest: AudioNode): void {
    if (!this.ctx || !this.noiseBuffer) return;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const hp = this.ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.setValueAtTime(4200, time);
    const env = this.ctx.createGain();
    env.gain.setValueAtTime(0.22, time);
    env.gain.exponentialRampToValueAtTime(0.001, time + 0.3);
    src.connect(hp);
    hp.connect(env);
    env.connect(dest);
    bindCleanup(src, [src, hp, env]);
    src.start(time);
    src.stop(time + 0.32);
  }

  private triggerTom(time: number, dest: AudioNode, startFreq: number): void {
    if (!this.ctx) return;
    const osc = this.ctx.createOscillator();
    const env = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(startFreq, time);
    osc.frequency.exponentialRampToValueAtTime(Math.max(40, startFreq * 0.45), time + 0.1);
    env.gain.setValueAtTime(0.32, time);
    env.gain.exponentialRampToValueAtTime(0.001, time + 0.11);
    osc.connect(env);
    env.connect(dest);
    bindCleanup(osc, [osc, env]);
    osc.start(time);
    osc.stop(time + 0.12);
  }

  // Industrial Sega MD metallic FM cowbell / pipe hit (classic Contra Hard Corps / Prodigy texture!)
  private triggerMetalClang(time: number, dest: AudioNode): void {
    if (!this.ctx) return;
    const o1 = this.ctx.createOscillator();
    const o2 = this.ctx.createOscillator();
    const bp = this.ctx.createBiquadFilter();
    const env = this.ctx.createGain();
    o1.type = 'square';
    o2.type = 'square';
    o1.frequency.setValueAtTime(562, time);
    o2.frequency.setValueAtTime(845, time);
    bp.type = 'bandpass';
    bp.frequency.setValueAtTime(1600, time);
    bp.Q.setValueAtTime(3.2, time);
    env.gain.setValueAtTime(0.16, time);
    env.gain.exponentialRampToValueAtTime(0.001, time + 0.08);
    o1.connect(bp);
    o2.connect(bp);
    bp.connect(env);
    env.connect(dest);
    bindCleanup(o1, [o1, o2, bp, env]);
    o1.start(time);
    o2.start(time);
    o1.stop(time + 0.085);
    o2.stop(time + 0.085);
  }

  private playNoise(duration: number, freq: number, filterType: BiquadFilterType, vol: number): void {
    if (this.muted || !this.ctx || !this.sfxGain || !this.noiseBuffer) return;
    const now = this.ctx.currentTime;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const filter = this.ctx.createBiquadFilter();
    filter.type = filterType;
    filter.frequency.setValueAtTime(clampFreq(freq), now);
    const env = this.ctx.createGain();
    env.gain.setValueAtTime(vol, now);
    env.gain.exponentialRampToValueAtTime(0.001, now + duration);
    src.connect(filter);
    filter.connect(env);
    env.connect(this.sfxGain);
    bindCleanup(src, [src, filter, env]);
    src.start(now);
    src.stop(now + duration + 0.02);
  }

  private playTone(
    startFreq: number,
    endFreq: number,
    duration: number,
    type: OscillatorType,
    vol: number,
    delay = 0
  ): void {
    if (this.muted || !this.ctx || !this.sfxGain) return;
    const now = this.ctx.currentTime + delay;
    const osc = this.ctx.createOscillator();
    const env = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(clampFreq(startFreq), now);
    if (endFreq !== startFreq) {
      osc.frequency.exponentialRampToValueAtTime(clampFreq(endFreq), now + duration);
    }
    env.gain.setValueAtTime(vol, now);
    env.gain.exponentialRampToValueAtTime(0.001, now + duration);
    osc.connect(env);
    env.connect(this.sfxGain);
    bindCleanup(osc, [osc, env]);
    osc.start(now);
    osc.stop(now + duration + 0.02);
  }

  public playWeaponSfx(weaponId: WeaponId, isNative: boolean, rampLevel = 0): void {
    this.unlock();
    if (this.muted || !this.ctx) return;
    if (!this.allowSfx(`wpn_${weaponId}`, weaponId === 'blast_beat' || weaponId === 'domna' ? 42 : 30)) return;

    switch (weaponId) {
      case 'chaindog':
        this.playNoise(0.16, 750, 'lowpass', 0.36);
        this.playTone(170, 55, 0.14, 'sawtooth', 0.24);
        if (isNative) {
          this.playTone(340, 520, 0.06, 'sawtooth', 0.16, 0.02);
          this.playTone(520, 190, 0.09, 'sawtooth', 0.16, 0.07);
        }
        break;
      case 'spinning':
        this.playTone(isNative ? 820 : 720, 260, 0.06, 'square', 0.15);
        this.playNoise(0.04, 2400, 'highpass', 0.1);
        break;
      case 'rc_launcher':
        this.playTone(260, 120, 0.14, 'triangle', 0.26);
        this.playTone(620, 940, 0.09, 'square', isNative ? 0.14 : 0.09);
        break;
      case 'blast_beat': {
        const pitchBoost = 1 + rampLevel * 0.45;
        this.playNoise(0.045, 1600 * pitchBoost, 'bandpass', 0.2);
        this.playTone(240 * pitchBoost, 110, 0.05, 'square', isNative ? 0.16 : 0.12);
        break;
      }
      case 'bass_beam':
        this.playTone(isNative ? 62 : 74, 48, 0.32, 'sawtooth', 0.32);
        this.playTone(124, 52, 0.24, 'square', 0.16);
        this.playNoise(0.09, 3200, 'highpass', 0.16);
        break;
      case 'domna':
        this.playNoise(0.12, isNative ? 900 : 720, 'bandpass', 0.22);
        this.playTone(130, 85, 0.1, 'sawtooth', 0.11);
        break;
      case 'firewall':
        this.playTone(1150, 320, 0.11, 'sawtooth', 0.18);
        this.playTone(680, 1480, 0.08, 'square', isNative ? 0.16 : 0.11, 0.03);
        this.playNoise(0.09, 4200, 'highpass', 0.15);
        break;
      case 'dymok':
        this.playTone(190, 380, 0.07, 'sine', 0.2);
        this.playTone(280, 460, 0.08, 'sine', isNative ? 0.18 : 0.13, 0.06);
        this.playNoise(0.2, 1100, 'bandpass', 0.16);
        break;
    }
  }

  public playMelee(heavy = false): void {
    this.unlock();
    if (!this.allowSfx('melee', 45)) return;
    this.playNoise(heavy ? 0.12 : 0.07, heavy ? 520 : 1200, 'bandpass', heavy ? 0.28 : 0.18);
    this.playTone(heavy ? 180 : 280, 65, heavy ? 0.13 : 0.08, 'triangle', 0.2);
  }

  public playHit(heavy = false): void {
    this.unlock();
    if (!this.allowSfx('hit', 35)) return;
    this.playNoise(heavy ? 0.13 : 0.065, heavy ? 620 : 1400, 'lowpass', heavy ? 0.28 : 0.16);
    this.playTone(heavy ? 160 : 260, 48, heavy ? 0.13 : 0.065, 'square', 0.18);
  }

  public playExplosion(): void {
    this.unlock();
    if (!this.allowSfx('explosion', 60)) return;
    this.playNoise(0.36, 360, 'lowpass', 0.44);
    this.playTone(130, 32, 0.34, 'sawtooth', 0.3);
  }

  public playJump(): void {
    this.unlock();
    if (!this.allowSfx('jump', 60)) return;
    this.playTone(180, 430, 0.1, 'square', 0.14);
  }

  public playPickupBeer(): void {
    this.unlock();
    this.playTone(440, 587, 0.08, 'square', 0.18, 0);
    this.playTone(587, 880, 0.14, 'square', 0.2, 0.08);
  }

  public playPickupWeapon(): void {
    this.unlock();
    this.playTone(320, 640, 0.07, 'square', 0.18, 0);
    this.playTone(480, 760, 0.09, 'sawtooth', 0.16, 0.06);
  }

  public playHack(): void {
    this.unlock();
    this.playTone(520, 1040, 0.07, 'square', 0.2, 0);
    this.playTone(780, 1560, 0.1, 'square', 0.2, 0.07);
    this.playTone(1040, 2080, 0.12, 'triangle', 0.18, 0.15);
  }

  public playPlayerHurt(): void {
    this.unlock();
    if (!this.allowSfx('hurt', 90)) return;
    this.playTone(320, 90, 0.18, 'sawtooth', 0.28);
    this.playNoise(0.14, 800, 'bandpass', 0.24);
  }

  public playLifeLost(): void {
    this.unlock();
    this.playTone(380, 220, 0.14, 'sawtooth', 0.26, 0);
    this.playTone(220, 110, 0.2, 'sawtooth', 0.26, 0.14);
    this.playTone(110, 55, 0.32, 'sawtooth', 0.28, 0.32);
  }

  public playBossWarn(): void {
    this.unlock();
    for (let i = 0; i < 3; i++) {
      this.playTone(540, 390, 0.18, 'sawtooth', 0.22, i * 0.22);
    }
  }

  public playStageClear(): void {
    this.unlock();
    const notes = [523, 659, 784, 1046];
    notes.forEach((f, idx) => {
      this.playTone(f, f, 0.16, 'square', 0.2, idx * 0.11);
    });
  }

  public playCensorBeep(): void {
    this.unlock();
    if (this.muted || !this.ctx || !this.sfxGain) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const env = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(1000, now);
    env.gain.setValueAtTime(0.001, now);
    env.gain.linearRampToValueAtTime(0.3, now + 0.01);
    env.gain.setValueAtTime(0.3, now + 0.22);
    env.gain.linearRampToValueAtTime(0.001, now + 0.25);
    osc.connect(env);
    env.connect(this.sfxGain);
    bindCleanup(osc, [osc, env]);
    osc.start(now);
    osc.stop(now + 0.26);
  }

  public playTypeBlip(speakerIndex = 0): void {
    this.unlock();
    if (!this.allowSfx('blip', 28)) return;
    const base = 360 + (speakerIndex % 8) * 35;
    this.playTone(base, base + 20, 0.025, 'square', 0.05);
  }

  public playMenuMove(): void {
    this.unlock();
    if (!this.allowSfx('menu', 30)) return;
    this.playTone(460, 560, 0.04, 'square', 0.11);
  }

  public playMenuConfirm(): void {
    this.unlock();
    this.playTone(520, 780, 0.07, 'square', 0.16);
    this.playTone(780, 1040, 0.09, 'square', 0.16, 0.06);
  }

  // Retro dual-tone touring van horn for the endless sunset cruise!
  public playVanHorn(): void {
    this.unlock();
    if (this.muted || !this.ctx || !this.sfxGain) return;
    if (!this.allowSfx('van_horn', 260)) return;
    const now = this.ctx.currentTime;
    const freqs = [349.23, 440]; // Warm F4 + A4 classic van horn chord
    const filter = this.ctx.createBiquadFilter();
    const env = this.ctx.createGain();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(920, now);
    filter.Q.setValueAtTime(1.6, now);

    env.gain.setValueAtTime(0.001, now);
    env.gain.linearRampToValueAtTime(0.24, now + 0.03);
    env.gain.setValueAtTime(0.22, now + 0.24);
    env.gain.exponentialRampToValueAtTime(0.001, now + 0.36);

    filter.connect(env);
    env.connect(this.sfxGain);

    const oscs: OscillatorNode[] = [];
    for (let i = 0; i < freqs.length; i++) {
      const o = this.ctx.createOscillator();
      o.type = 'sawtooth';
      o.frequency.setValueAtTime(freqs[i], now);
      o.detune.setValueAtTime(i === 0 ? -5 : 6, now);
      o.connect(filter);
      o.start(now);
      o.stop(now + 0.38);
      oscs.push(o);
    }
    bindCleanup(oscs[0], [...oscs, filter, env]);
  }
}

export const soundEngine = new SoundEngine();
