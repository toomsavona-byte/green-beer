import { LevelId } from './types';

/**
 * Deterministic hash for non-repeating city block & architectural variation.
 */
export function tileHash(idx: number, seed: number): number {
  let n = Math.imul(idx ^ 0x9e3779b9, 0x85ebca6b) ^ Math.imul(seed + 17, 0xc2b2ae35);
  n = Math.imul(n ^ (n >>> 15), 0x2c1b3c6d);
  n = n ^ (n >>> 12);
  return Math.abs(n);
}

/**
 * Alternating dark/light visual themes:
 * Level 1: Dark (Night neon streets)
 * Level 2: Light (Sunny daytime street market & waterfront)
 * Level 3: Dark (Night factory perimeter)
 * Level 4: Light (Sunny daytime coastal highway)
 * Level 5: Dark (Night freight elevator shaft)
 * Level 6: Light (Bright daylight glass factory atrium & sunlit penthouse)
 */
export function isDaylightLevel(levelId: LevelId): boolean {
  return levelId === 2 || levelId === 4 || levelId === 6;
}

// Steep Contra: Hard Corps-style piecewise-linear elevation profiles!
// Format: [worldX, elevationPx] where positive = downhill (lower), negative = uphill (higher).
// Slopes reach ~0.38–0.46 px/px (~21°–25° dramatic diagonal ramps cutting across the screen!).
type RampNode = [number, number];

const LEVEL_RAMP_PROFILES: Record<LevelId, RampNode[]> = {
  // Level 1 (7600px): Night neon streets — steep overpass drops & subway climbs
  1: [
    [0, 0],
    [540, 0],
    [880, 140],   // steep 22.4° downhill ramp!
    [1520, 140],
    [1840, -10],  // steep 25.1° uphill ramp!
    [2520, -10],
    [2920, 165],  // dramatic 23.6° long drop!
    [3720, 165],
    [4060, 15],   // steep 23.8° climb!
    [4820, 15],
    [5180, 155],  // steep 21.3° descent!
    [5880, 155],
    [6260, 0],    // steep 22.2° climb to boss terrace!
    [7600, 0],
  ],
  // Level 2 (8200px): Sunny southern market & coastal waterfront — hillside steps & harbor plunges
  2: [
    [0, 0],
    [580, 0],
    [900, -135],  // steep uphill climb up hillside bazaar!
    [1640, -135],
    [2060, 45],   // long dramatic plunge down toward sea waterfront!
    [2860, 45],
    [3220, 195],  // second steep drop to harbor docks!
    [4080, 195],
    [4480, 20],   // steep uphill port ramp!
    [5320, 20],
    [5680, -125], // high sunlit market terrace!
    [6420, -125],
    [6760, 0],    // steep downhill into boss courtyard!
    [8200, 0],
  ],
  // Level 3 (8400px): Night factory perimeter — armored bunker ramps & deep trench drops
  3: [
    [0, 0],
    [520, 0],
    [920, 175],   // dramatic Contra-style armored bunker descent!
    [1720, 175],
    [2080, 20],   // steep climb out of trench!
    [2820, 20],
    [3180, -135], // steep climb to outer wall rampart!
    [4020, -135],
    [4460, 60],   // massive steep drop across checkpoint!
    [5260, 60],
    [5620, 210],  // deep security pit ramp!
    [6480, 210],
    [6940, 0],    // big uphill ramp to factory gates boss!
    [8400, 0],
  ],
  // Level 4 (10200px): Sunny coastal Harley highway — massive mountain switchbacks & bridge drops
  4: [
    [0, 0],
    [760, 0],
    [1200, 185],  // blistering coastal highway plunge!
    [2120, 185],
    [2560, 0],    // roaring climb onto bridge deck!
    [3760, 0],
    [4180, -170], // soaring highway overpass climb!
    [5220, -170],
    [5680, 30],   // steep downhill into canyon highway!
    [6780, 30],
    [7200, 200],  // deep tunnel approach drop!
    [8260, 200],
    [8720, 0],    // steep climb out to final convoy arena!
    [10200, 0],
  ],
  // Level 5: Vertical elevator — always flat!
  5: [
    [0, 0],
    [1000, 0],
  ],
  // Level 6 (9000px): Daylight glass factory atrium & R&D complex — steep multi-level industrial ramps!
  6: [
    [0, 0],
    [560, 0],
    [940, 165],   // sharp factory vat ramp drop (Contra Hard Corps vibe!)
    [1780, 165],
    [2160, 0],    // steep climb to sorting gallery!
    [2960, 0],
    [3360, -165], // sharp uphill to sterile R&D wing!
    [4380, -165],
    [4820, 25],   // long diagonal descent across lab atrium!
    [5720, 25],
    [6120, -145], // steep climb toward director's penthouse!
    [7020, -145],
    [7380, 0],    // ramp into panoramic penthouse boss arena!
    [9000, 0],
  ],
};

/**
 * Sharp, dramatic Contra: Hard Corps-style piecewise-linear ground elevation at `worldX`.
 * Negative values = uphill (higher), positive values = downhill (lower).
 */
export function getGroundElevation(levelId: LevelId, worldX: number): number {
  if (levelId === 5) return 0;
  const nodes = LEVEL_RAMP_PROFILES[levelId];
  if (!nodes || nodes.length < 2) return 0;

  if (worldX <= nodes[0][0]) return nodes[0][1];
  const last = nodes[nodes.length - 1];
  if (worldX >= last[0]) return last[1];

  for (let i = 0; i < nodes.length - 1; i++) {
    const [x0, y0] = nodes[i];
    const [x1, y1] = nodes[i + 1];
    if (worldX >= x0 && worldX <= x1) {
      const span = x1 - x0;
      if (span <= 0.001) return y1;
      const t = (worldX - x0) / span;
      return y0 + (y1 - y0) * t;
    }
  }
  return 0;
}

/**
 * Smooth vertical camera offset following steep ramps so the playable road belt
 * stays centered in the 270px viewport even across 170+ px elevation drops & climbs!
 * Deterministic purely from (levelId, camX) so Online 2P guests stay 100% synced automatically.
 */
export function getCameraOffsetY(levelId: LevelId, camX: number): number {
  if (levelId === 5) return 0;
  // Weighted multi-sample around the action focal zone (camX + 165..225) for silky ramp transitions
  const e1 = getGroundElevation(levelId, camX + 120);
  const e2 = getGroundElevation(levelId, camX + 185);
  const e3 = getGroundElevation(levelId, camX + 250);
  return e1 * 0.25 + e2 * 0.5 + e3 * 0.25;
}

/**
 * Local slope angle in radians at `worldX` (positive = descending right, negative = climbing right).
 */
export function getGroundSlope(levelId: LevelId, worldX: number): number {
  if (levelId === 5) return 0;
  const e1 = getGroundElevation(levelId, worldX - 10);
  const e2 = getGroundElevation(levelId, worldX + 10);
  return Math.atan2(e2 - e1, 20);
}
