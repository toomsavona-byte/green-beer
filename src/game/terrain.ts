import { LevelId } from './types';

const LEVEL_LENGTHS: Record<LevelId, number> = {
  1: 7600,
  2: 8200,
  3: 8400,
  4: 10200,
  5: 0,
  6: 9000,
};

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

/**
 * Smooth seeded elevation offset (in virtual pixels) at world coordinate `worldX`.
 * Negative values = uphill (higher on screen), positive values = downhill (lower on screen).
 * Level 5 (freight elevator) is always flat (0).
 * Smoothly eases to 0 near level start and near the final boss arena.
 */
export function getGroundElevation(levelId: LevelId, worldX: number): number {
  if (levelId === 5) return 0;

  const totalLen = LEVEL_LENGTHS[levelId] || 8000;
  // Ease in at start (0..320) and ease out before boss arena (last 620px)
  const startFade = Math.max(0, Math.min(1, (worldX - 120) / 260));
  const endFade = Math.max(0, Math.min(1, (totalLen - 480 - worldX) / 360));
  const envelope = startFade * endFade;
  if (envelope <= 0.001) return 0;

  // Deterministic per-level harmonic hills & dips (irregular, non-periodic feel)
  const s1 = levelId * 1.73 + 0.4;
  const s2 = levelId * 2.91 + 1.2;
  const s3 = levelId * 4.17 + 2.5;

  const isHighway = levelId === 4;
  const freq = isHighway ? 0.00185 : 0.0024;

  const w1 = Math.sin(worldX * freq + s1) * 7.2;
  const w2 = Math.sin(worldX * (freq * 1.87) + s2) * 4.6;
  const w3 = Math.cos(worldX * (freq * 0.61) + s3) * 3.8;

  // Slightly bias upward (-1px) so downhill never crowds bottom edge (FLOOR_MAX_Y=250, VIRTUAL_H=270)
  const raw = (w1 + w2 + w3) * (isHighway ? 1.08 : 0.92) - 1.0;
  const clamped = Math.max(-14, Math.min(11, raw));
  return clamped * envelope;
}

/**
 * Local slope angle in radians at `worldX` (positive = descending right, negative = climbing right).
 */
export function getGroundSlope(levelId: LevelId, worldX: number): number {
  if (levelId === 5) return 0;
  const e1 = getGroundElevation(levelId, worldX - 14);
  const e2 = getGroundElevation(levelId, worldX + 14);
  return Math.atan2(e2 - e1, 28);
}
