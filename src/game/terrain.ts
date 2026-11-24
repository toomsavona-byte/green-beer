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
// Slopes reach ~0.35–0.45 px/px (~19°–24° dramatic diagonal ramps cutting across the screen!).
type RampNode = [number, number];

function createSeededRng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Builds a sparse, unpredictable Contra-style ramp profile with long irregular flat stretches
 * (1200–2650px) and only 2–4 dramatic steep ramps across the whole level.
 */
function buildSparseRandomRamps(levelId: LevelId, levelLength: number, seed: number): RampNode[] {
  if (levelId === 5) {
    return [
      [0, 0],
      [Math.max(1000, levelLength), 0],
    ];
  }

  const rand = createSeededRng(seed);
  const nodes: RampNode[] = [[0, 0]];
  // Reserve clean flat boss arena at the end of the level
  const maxRampEndX = Math.max(1800, levelLength - 1350);
  // Sparse ramp budget: 2–3 ramps on standard levels, 3–4 on extra-long highway/brewery
  const maxRamps = levelLength >= 9000 ? 3 + (rand() < 0.55 ? 1 : 0) : 2 + (rand() < 0.5 ? 1 : 0);

  let curX = Math.round(920 + rand() * 980); // Irregular opening flat (920–1900px)
  let curY = 0;
  let lastDir = rand() < 0.5 ? 1 : -1;
  let rampsPlaced = 0;

  while (rampsPlaced < maxRamps && curX + 420 < maxRampEndX) {
    // Choose direction organically (allow occasional consecutive drops/climbs if within height bounds!)
    let dir: number;
    if (curY >= 145) {
      dir = -1;
    } else if (curY <= -145) {
      dir = 1;
    } else {
      dir = rand() < 0.65 ? -lastDir : lastDir;
    }

    const rampLen = Math.round(290 + rand() * 190); // 290–480px horizontal run
    const slopeMag = 0.35 + rand() * 0.10; // ~19.3°–24.2° steep diagonal angle
    const rawDelta = Math.round(rampLen * slopeMag);
    const nextY = Math.max(-220, Math.min(220, curY + dir * rawDelta));
    const actualLen = Math.max(240, Math.round(Math.abs(nextY - curY) / slopeMag));

    if (curX + actualLen >= maxRampEndX) break;

    nodes.push([curX, curY]);
    curX += actualLen;
    curY = nextY;
    nodes.push([curX, curY]);

    lastDir = dir;
    rampsPlaced += 1;

    // Long, genuinely irregular flat combat street before the next surprise ramp (1250–2650px)
    const remainingRamps = maxRamps - rampsPlaced;
    const spaceLeft = maxRampEndX - curX;
    const minFlat = 1220;
    const maxFlat = Math.max(minFlat + 350, Math.min(2650, spaceLeft / Math.max(1, remainingRamps) - 220));
    curX += Math.round(minFlat + rand() * Math.max(240, maxFlat - minFlat));
  }

  nodes.push([Math.max(levelLength, curX + 400), curY]);
  return nodes;
}

const DEFAULT_LEVEL_LENGTHS: Record<LevelId, number> = {
  1: 7600,
  2: 8200,
  3: 8400,
  4: 10200,
  5: 1000,
  6: 9000,
};

const activeRampProfiles: Record<LevelId, RampNode[]> = {
  1: buildSparseRandomRamps(1, DEFAULT_LEVEL_LENGTHS[1], 104729),
  2: buildSparseRandomRamps(2, DEFAULT_LEVEL_LENGTHS[2], 224737),
  3: buildSparseRandomRamps(3, DEFAULT_LEVEL_LENGTHS[3], 350377),
  4: buildSparseRandomRamps(4, DEFAULT_LEVEL_LENGTHS[4], 479909),
  5: buildSparseRandomRamps(5, DEFAULT_LEVEL_LENGTHS[5], 500009),
  6: buildSparseRandomRamps(6, DEFAULT_LEVEL_LENGTHS[6], 611953),
};

/**
 * Generates a fresh sparse & irregular ramp layout for the level.
 * Called with a fresh random seed in local mode, or a shared deterministic seed in Online 2P.
 */
export function randomizeLevelTerrain(levelId: LevelId, levelLength: number, seed?: number): void {
  const effectiveSeed =
    seed !== undefined ? seed : Math.floor(Math.random() * 0x7fffffff) ^ (Date.now() & 0x7fffffff) ^ (levelId * 7919);
  activeRampProfiles[levelId] = buildSparseRandomRamps(levelId, levelLength, effectiveSeed);
}

/**
 * Sharp, dramatic Contra: Hard Corps-style piecewise-linear ground elevation at `worldX`.
 * Negative values = uphill (higher), positive values = downhill (lower).
 */
export function getGroundElevation(levelId: LevelId, worldX: number): number {
  if (levelId === 5) return 0;
  const nodes = activeRampProfiles[levelId];
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
