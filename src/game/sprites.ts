import { HERO_MAP, HEROES, WEAPON_MAP } from './data';
import { CutsceneDef, EnemyKind, HeroId, LevelDef, WeaponId } from './types';

export const VIRTUAL_W = 480;
export const VIRTUAL_H = 270;
export const FLOOR_MIN_Y = 152;
export const FLOOR_MAX_Y = 254;

const INK = '#07090E';

function px(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, color: string): void {
  ctx.fillStyle = color;
  ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
}

// Contra Hard Corps style 1px ink-outlined shaded pixel block (3-tone: base + highlight + shadow)
function box(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  fill: string,
  hi?: string,
  sh?: string
): void {
  const rx = Math.round(x);
  const ry = Math.round(y);
  const rw = Math.round(w);
  const rh = Math.round(h);
  ctx.fillStyle = INK;
  ctx.fillRect(rx - 1, ry - 1, rw + 2, rh + 2);
  ctx.fillStyle = fill;
  ctx.fillRect(rx, ry, rw, rh);
  if (hi && rw >= 3 && rh >= 3) {
    ctx.fillStyle = hi;
    ctx.fillRect(rx, ry, rw, 1);
    ctx.fillRect(rx, ry, 1, Math.max(1, rh - 1));
  }
  if (sh && rw >= 3 && rh >= 3) {
    ctx.fillStyle = sh;
    ctx.fillRect(rx, ry + rh - 1, rw, 1);
    ctx.fillRect(rx + rw - 1, ry + 1, 1, Math.max(1, rh - 1));
  }
}

function shadeHex(hex: string, amount: number): string {
  if (!hex.startsWith('#') || hex.length !== 7) return hex;
  const num = parseInt(hex.slice(1), 16);
  const r = Math.max(0, Math.min(255, ((num >> 16) & 255) + amount));
  const g = Math.max(0, Math.min(255, ((num >> 8) & 255) + amount));
  const b = Math.max(0, Math.min(255, (num & 255) + amount));
  return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
}

// ── HAND-INKED ANATOMICAL ARCADE PRIMITIVES (2x HD smooth curves + 3-tone shading) ──
function drawRoundedPoly(
  ctx: CanvasRenderingContext2D,
  pts: Array<[number, number]>,
  fill: string,
  outline = INK,
  lineWidth = 1.25
): void {
  if (pts.length < 3) return;
  ctx.beginPath();
  ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) {
    ctx.lineTo(pts[i][0], pts[i][1]);
  }
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
  if (lineWidth > 0) {
    ctx.strokeStyle = outline;
    ctx.lineWidth = lineWidth;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.stroke();
  }
}

function drawInkEllipse(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  rot: number,
  fill: string,
  hi?: string,
  sh?: string,
  lineWidth = 1.2
): void {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(rot);
  ctx.beginPath();
  ctx.ellipse(0, 0, Math.max(0.5, rx), Math.max(0.5, ry), 0, 0, Math.PI * 2);
  ctx.fillStyle = fill;
  ctx.fill();
  if (sh && rx > 2 && ry > 2) {
    ctx.save();
    ctx.clip();
    ctx.fillStyle = sh;
    ctx.beginPath();
    ctx.ellipse(rx * 0.28, ry * 0.34, rx * 0.95, ry * 0.85, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
  if (hi && rx > 2 && ry > 2) {
    ctx.save();
    ctx.clip();
    ctx.fillStyle = hi;
    ctx.beginPath();
    ctx.ellipse(-rx * 0.25, -ry * 0.35, rx * 0.55, ry * 0.38, -0.25, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
  if (lineWidth > 0) {
    ctx.beginPath();
    ctx.ellipse(0, 0, Math.max(0.5, rx), Math.max(0.5, ry), 0, 0, Math.PI * 2);
    ctx.strokeStyle = INK;
    ctx.lineWidth = lineWidth;
    ctx.stroke();
  }
  ctx.restore();
}

// Tapered organic limb segment (thigh, calf, bicep, forearm) with smooth comic ink outline & 3-tone shading
function drawTaperedLimb(
  ctx: CanvasRenderingContext2D,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  r1: number,
  r2: number,
  fill: string,
  hi: string,
  sh: string,
  lineWidth = 1.2
): void {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.hypot(dx, dy);
  if (len < 0.01) return;
  const ang = Math.atan2(dy, dx);

  ctx.save();
  ctx.translate(x1, y1);
  ctx.rotate(ang);

  ctx.beginPath();
  ctx.arc(0, 0, r1, Math.PI * 0.5, Math.PI * 1.5);
  ctx.lineTo(len, -r2);
  ctx.arc(len, 0, r2, -Math.PI * 0.5, Math.PI * 0.5);
  ctx.closePath();

  ctx.fillStyle = fill;
  ctx.fill();

  // Inner core shadow on underside & directional rim highlight on top
  ctx.save();
  ctx.clip();
  ctx.fillStyle = sh;
  ctx.fillRect(-r1, 0.35 * Math.min(r1, r2), len + r1 + r2, Math.max(r1, r2) + 2);
  ctx.fillStyle = hi;
  ctx.fillRect(0, -Math.max(r1, r2), len, Math.max(0.9, Math.min(r1, r2) * 0.48));
  ctx.restore();

  ctx.strokeStyle = INK;
  ctx.lineWidth = lineWidth;
  ctx.lineJoin = 'round';
  ctx.stroke();
  ctx.restore();
}

function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
  fill: string,
  outline = INK,
  lineWidth = 1.1
): void {
  const rr = Math.min(r, Math.abs(w) / 2, Math.abs(h) / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.lineTo(x + w - rr, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + rr);
  ctx.lineTo(x + w, y + h - rr);
  ctx.quadraticCurveTo(x + w, y + h, x + w - rr, y + h);
  ctx.lineTo(x + rr, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - rr);
  ctx.lineTo(x, y + rr);
  ctx.quadraticCurveTo(x, y, x + rr, y);
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
  if (lineWidth > 0) {
    ctx.strokeStyle = outline;
    ctx.lineWidth = lineWidth;
    ctx.stroke();
  }
}

export interface HeroRenderOpts {
  heroId: HeroId;
  x: number;
  y: number;
  z: number;
  vz?: number;
  facing: 1 | -1;
  aimX: number;
  aimY: number;
  animTime: number;
  moving: boolean;
  meleeTimer: number;
  shootTimer: number;
  hurtTimer: number;
  invulnTimer: number;
  weaponId: WeaponId;
  onBike: boolean;
  playerSlot?: 1 | 2;
  scale?: number;
}

interface HeroStyleProfile {
  bodyScaleX: number;
  bodyScaleY: number;
  bareArms: boolean;
  pantsColor: string;
  bootColor: string;
  jacketColor: string;
  shirtColor: string;
  skinColor: string;
  rimColor: string;
}

const HERO_PROFILES: Record<HeroId, HeroStyleProfile> = {
  vadek: {
    bodyScaleX: 1.08,
    bodyScaleY: 1.0,
    bareArms: false,
    pantsColor: '#3B5C82', // ripped blue denim
    bootColor: '#191C22',
    jacketColor: '#1F242D', // black leather biker jacket
    shirtColor: '#E5E7EB', // crisp white tee
    skinColor: '#DDA07A',
    rimColor: '#39FF14',
  },
  vano: {
    bodyScaleX: 0.98,
    bodyScaleY: 1.0,
    bareArms: true,
    pantsColor: '#4A5934', // camo cargo pants
    bootColor: '#4A3121', // brown tactical boots
    jacketColor: '#56643C', // olive tactical vest
    shirtColor: '#2B3321',
    skinColor: '#DBA079',
    rimColor: '#00E5FF',
  },
  koren: {
    bodyScaleX: 1.01,
    bodyScaleY: 1.01,
    bareArms: true,
    pantsColor: '#232832', // black tactical pants
    bootColor: '#161A22',
    jacketColor: '#242B36', // cyber armor vest
    shirtColor: '#151921',
    skinColor: '#DFA580',
    rimColor: '#00E5FF',
  },
  hooper: {
    bodyScaleX: 1.05,
    bodyScaleY: 1.0,
    bareArms: true,
    pantsColor: '#37506F', // blue jeans
    bootColor: '#B91C1C', // red-white sneakers
    jacketColor: '#363A43', // dark charcoal fitted tee
    shirtColor: '#363A43',
    skinColor: '#DFA47F',
    rimColor: '#FF2A85',
  },
  sandro: {
    bodyScaleX: 1.0,
    bodyScaleY: 1.01,
    bareArms: true,
    pantsColor: '#253245', // dark denim jeans
    bootColor: '#181B21',
    jacketColor: '#1C2029', // studded leather vest
    shirtColor: '#E5E7EB', // white tank
    skinColor: '#DDA27D',
    rimColor: '#C084FC',
  },
  zavod_killer: {
    bodyScaleX: 1.2,
    bodyScaleY: 1.06,
    bareArms: false,
    pantsColor: '#2D353C', // dark factory cargo pants
    bootColor: '#171A1E',
    jacketColor: '#8B7B32', // mustard-olive heavy work parka
    shirtColor: '#4B5563',
    skinColor: '#C98A65',
    rimColor: '#FB923C',
  },
  bo: {
    bodyScaleX: 0.92,
    bodyScaleY: 0.99,
    bareArms: false,
    pantsColor: '#5C5442', // khaki tactical cargo
    bootColor: '#181B20',
    jacketColor: '#262B35', // charcoal cyber zip hoodie
    shirtColor: '#14171D',
    skinColor: '#E6B290',
    rimColor: '#00E5FF',
  },
  ded: {
    bodyScaleX: 1.18,
    bodyScaleY: 0.98,
    bareArms: true,
    pantsColor: '#3F5D7F', // blue jeans
    bootColor: '#92400E', // flip-flops
    jacketColor: '#D94B43', // vibrant floral Hawaiian shirt
    shirtColor: '#ECEFF4', // white tee
    skinColor: '#E0A481',
    rimColor: '#39FF14',
  },
};

function drawArticulatedLeg(
  ctx: CanvasRenderingContext2D,
  heroId: HeroId,
  hipX: number,
  hipY: number,
  hipAngle: number,
  kneeBend: number,
  footTilt: number,
  thighLen: number,
  shinLen: number,
  thighR: number,
  shinR: number,
  pantsCol: string,
  pantsHi: string,
  pantsSh: string,
  bootCol: string,
  bootHi: string,
  bootSh: string,
  skinCol: string,
  isBack: boolean
): void {
  const kneeX = hipX + Math.sin(hipAngle) * thighLen;
  const kneeY = hipY + Math.cos(hipAngle) * thighLen;
  const shinAngle = hipAngle - kneeBend;
  const ankleX = kneeX + Math.sin(shinAngle) * shinLen;
  const ankleY = kneeY + Math.cos(shinAngle) * shinLen;

  // Thigh
  drawTaperedLimb(ctx, hipX, hipY, kneeX, kneeY, thighR, shinR * 0.96, pantsCol, pantsHi, pantsSh, 1.15);

  // Camo patches on Vano / thigh holster on Koren & Bo
  if (!isBack && heroId === 'vano') {
    drawInkEllipse(ctx, (hipX + kneeX) * 0.5, (hipY + kneeY) * 0.5, 2.2, 1.3, 0.4, '#2E3A1E', undefined, undefined, 0);
  } else if (!isBack && (heroId === 'koren' || heroId === 'bo')) {
    ctx.save();
    ctx.translate((hipX + kneeX) * 0.55, (hipY + kneeY) * 0.55);
    ctx.rotate(-hipAngle);
    drawRoundedRect(ctx, -2.8, -1.6, 5.4, 3.4, 0.8, '#131720', INK, 0.9);
    ctx.restore();
  }

  // Shin
  drawTaperedLimb(ctx, kneeX, kneeY, ankleX, ankleY, shinR, shinR * 0.78, pantsCol, pantsHi, pantsSh, 1.15);

  // Knee detail: ripped jeans skin peek on Vadek, armored knee pad on Koren/Zavod
  if (heroId === 'vadek') {
    drawInkEllipse(ctx, kneeX + 0.8, kneeY, 1.7, 1.1, 0, skinCol, undefined, undefined, 0.7);
  } else if (heroId === 'koren' || heroId === 'zavod_killer') {
    drawInkEllipse(ctx, kneeX + 0.8, kneeY, 2.4, 2.1, -hipAngle * 0.4, '#2F3847', '#64748B', '#0F172A', 1.0);
  }

  // Sculpted Foot / Combat Boot / Sneaker / Flip-Flop
  ctx.save();
  ctx.translate(ankleX, ankleY);
  ctx.rotate(footTilt);
  if (heroId === 'ded') {
    // Bare foot + tan flip-flop sandal!
    drawRoundedPoly(
      ctx,
      [
        [-2.8, -0.5],
        [4.8, -0.5],
        [5.8, 2.2],
        [-3.2, 2.2],
      ],
      skinCol,
      INK,
      1.0
    );
    drawRoundedRect(ctx, -3.4, 1.8, 9.4, 1.7, 0.7, '#78350F', INK, 0.9);
    ctx.strokeStyle = '#F59E0B';
    ctx.lineWidth = 1.1;
    ctx.beginPath();
    ctx.moveTo(-1.2, 1.8);
    ctx.lineTo(2.4, -0.3);
    ctx.lineTo(4.2, 1.8);
    ctx.stroke();
  } else if (heroId === 'hooper') {
    // Classic red-and-white arcade sneakers
    drawRoundedPoly(
      ctx,
      [
        [-2.8, -2.4],
        [2.2, -2.2],
        [6.0, 0.8],
        [6.2, 2.8],
        [-3.2, 2.8],
      ],
      bootCol,
      INK,
      1.1
    );
    // White toe cap & thick sneaker sole
    drawRoundedRect(ctx, -3.2, 1.7, 9.4, 1.5, 0.5, '#F8FAFC', INK, 0.8);
    ctx.fillStyle = '#F8FAFC';
    ctx.fillRect(3.6, 0.4, 2.2, 1.3);
  } else {
    // Heavy laced combat boot with treaded sole
    drawRoundedPoly(
      ctx,
      [
        [-2.8, -3.6],
        [2.4, -3.2],
        [3.6, -0.4],
        [6.4, 0.8],
        [6.5, 3.0],
        [-3.3, 3.0],
      ],
      bootCol,
      INK,
      1.15
    );
    // Specular leather toe shine
    ctx.fillStyle = bootHi;
    ctx.beginPath();
    ctx.ellipse(3.6, 0.8, 1.9, 0.8, 0.25, 0, Math.PI * 2);
    ctx.fill();
    // Sole ridge
    ctx.fillStyle = bootSh;
    ctx.fillRect(-3.0, 2.0, 9.2, 1.0);
  }
  ctx.restore();
}

export function drawHeroSprite(ctx: CanvasRenderingContext2D, o: HeroRenderOpts): void {
  const hero = HERO_MAP[o.heroId];
  const prof = HERO_PROFILES[o.heroId];
  const scale = o.scale ?? 1;

  if (o.invulnTimer > 0 && Math.floor(o.invulnTimer * 18) % 2 === 0 && o.hurtTimer <= 0) {
    return;
  }

  ctx.save();
  ctx.translate(o.x, o.y);

  // Soft layered ground shadow
  const shadowScale = Math.max(0.42, 1 - o.z / 95);
  ctx.fillStyle = 'rgba(0, 0, 0, 0.52)';
  ctx.beginPath();
  ctx.ellipse(0, 2, (o.onBike ? 27 : 13.5 * prof.bodyScaleX) * shadowScale * scale, 4.4 * shadowScale * scale, 0, 0, Math.PI * 2);
  ctx.fill();

  // P1 / P2 crisp arcade floor ring
  if (o.playerSlot) {
    ctx.strokeStyle = o.playerSlot === 1 ? 'rgba(57,255,20,0.78)' : 'rgba(0,229,255,0.82)';
    ctx.lineWidth = 1.1;
    ctx.beginPath();
    ctx.ellipse(0, 2, (o.onBike ? 29 : 15 * prof.bodyScaleX) * scale, 5.2 * scale, 0, 0, Math.PI * 2);
    ctx.stroke();
  }

  ctx.translate(0, -o.z * scale);
  ctx.scale(o.facing * scale, scale);

  const flash = o.hurtTimer > 0 && Math.floor(o.hurtTimer * 26) % 2 === 0;
  const c = (col: string) => (flash ? '#FFFFFF' : col);
  const hi = (col: string) => (flash ? '#FFFFFF' : shadeHex(col, 34));
  const sh = (col: string) => (flash ? '#CBD5E1' : shadeHex(col, -36));

  if (o.onBike) {
    drawHeroOnBike(ctx, o, prof, flash, c, hi, sh);
    ctx.restore();
    return;
  }

  const safeTime = Math.max(0, o.animTime);
  const airborne = o.z > 1.5;
  const vz = o.vz ?? 0;

  // ── FLUID MULTI-JOINT SKELETAL KINEMATICS ──
  const runPhase = safeTime * 11.8;
  const breath = Math.sin(safeTime * 3.8);
  const meleeProgress = o.meleeTimer > 0 ? Math.max(0, Math.min(1, 1 - o.meleeTimer / 0.24)) : 0;
  const meleeStrike = o.meleeTimer > 0 ? Math.sin(meleeProgress * Math.PI) : 0;
  const hurtTilt = o.hurtTimer > 0 ? -0.22 * Math.min(1, o.hurtTimer / 0.22) : 0;

  // Leg joint angles (hipAngle: + forward, - back; kneeBend: >= 0 bends shin backward!)
  let backHip = -0.24;
  let backKnee = 0.16;
  let backFoot = 0.06;
  let frontHip = 0.28;
  let frontKnee = 0.22;
  let frontFoot = -0.04;
  let bodyBob = breath * 0.55;
  let torsoLean = 0.05 + hurtTilt;

  if (airborne) {
    if (vz > 25) {
      // Dynamic Contra mid-air knee tuck!
      frontHip = 0.92;
      frontKnee = 1.15;
      frontFoot = 0.22;
      backHip = -0.45;
      backKnee = 0.85;
      backFoot = 0.35;
      torsoLean = 0.16 + hurtTilt;
      bodyBob = -2.2;
    } else {
      // Athletic landing extension
      frontHip = 0.42;
      frontKnee = 0.35;
      frontFoot = -0.15;
      backHip = -0.35;
      backKnee = 0.55;
      backFoot = 0.2;
      torsoLean = 0.1 + hurtTilt;
      bodyBob = -1.0;
    }
  } else if (o.moving) {
    const s = Math.sin(runPhase);
    const cPhase = Math.cos(runPhase);
    frontHip = s * 0.7;
    frontKnee = Math.max(0.08, -cPhase * 0.88 + 0.35);
    frontFoot = Math.max(-0.25, Math.min(0.32, -s * 0.28));

    backHip = -s * 0.7;
    backKnee = Math.max(0.08, cPhase * 0.88 + 0.35);
    backFoot = Math.max(-0.25, Math.min(0.32, s * 0.28));

    bodyBob = -Math.abs(s) * 2.5;
    torsoLean = 0.15 + Math.abs(s) * 0.04 + hurtTilt;
  } else if (o.meleeTimer > 0) {
    // Combat lunge during melee punch!
    frontHip = 0.45 + meleeStrike * 0.2;
    frontKnee = 0.35;
    backHip = -0.45 - meleeStrike * 0.15;
    backKnee = 0.2;
    torsoLean = 0.06 + meleeStrike * 0.22;
    bodyBob = -meleeStrike * 1.6;
  }

  const hipCenterY = -19.5 * prof.bodyScaleY + bodyBob;
  const thighLen = 9.2 * prof.bodyScaleY;
  const shinLen = 9.0 * prof.bodyScaleY;
  const thighR = 3.4 * prof.bodyScaleX;
  const shinR = 2.8 * prof.bodyScaleX;

  // ── 1. BACK GEAR (behind torso) ──
  ctx.save();
  ctx.translate(0, hipCenterY);
  ctx.rotate(torsoLean);
  if (o.heroId === 'vano') {
    // Sleek harpoon fishing rod strapped diagonally behind back
    drawTaperedLimb(ctx, -9, -22, 4, -2, 1.2, 1.4, '#CBD5E1', '#F8FAFC', '#475569', 0.9);
    drawInkEllipse(ctx, -8.5, -22.5, 2.8, 1.8, -0.5, '#0EA5E9', '#7DD3FC', '#0369A1', 0.9);
    drawInkEllipse(ctx, -3, -9, 2.2, 2.0, 0, '#F59E0B', '#FEF08A', '#92400E', 0.9);
  } else if (o.heroId === 'sandro') {
    // Sculpted rock bass guitar case slung across back
    drawTaperedLimb(ctx, -9.5, -23, -3, -3, 2.2, 3.6, '#1E1B2E', '#4C1D95', '#09090B', 1.1);
    drawRoundedRect(ctx, -11.5, -26, 4.2, 5.2, 1.0, '#581C87', INK, 1.0);
  } else if (o.heroId === 'koren') {
    // Cyber RC tech pack + glowing cyan core + whip antenna
    drawRoundedRect(ctx, -11.5, -16, 6.2, 12.5, 1.8, '#283140', INK, 1.1);
    ctx.fillStyle = '#00E5FF';
    ctx.fillRect(-10, -13.5, 3, 5);
    ctx.strokeStyle = '#E2E8F0';
    ctx.lineWidth = 1.1;
    ctx.beginPath();
    ctx.moveTo(-8.5, -16);
    ctx.lineTo(-9.5, -28);
    ctx.stroke();
    drawInkEllipse(ctx, -9.5, -28.5, 1.5, 1.5, 0, Math.floor(safeTime * 6) % 2 === 0 ? '#39FF14' : '#FF2A85', undefined, undefined, 0.7);
  } else if (o.heroId === 'bo') {
    // Compact cyber-deck backpack with glowing blue LED strip
    drawRoundedRect(ctx, -10.5, -15.5, 5.8, 11.5, 1.6, '#151B26', INK, 1.1);
    ctx.fillStyle = '#00E5FF';
    ctx.fillRect(-9, -13, 2.5, 6.5);
  }
  ctx.restore();

  // ── 2. BACK LEG (darker shading for depth) ──
  drawArticulatedLeg(
    ctx,
    o.heroId,
    -2.6 * prof.bodyScaleX,
    hipCenterY,
    backHip,
    backKnee,
    backFoot,
    thighLen,
    shinLen,
    thighR,
    shinR,
    sh(prof.pantsColor),
    c(prof.pantsColor),
    shadeHex(prof.pantsColor, -65),
    sh(prof.bootColor),
    c(prof.bootColor),
    INK,
    sh(prof.skinColor),
    true
  );

  // ── 3. FRONT LEG ──
  drawArticulatedLeg(
    ctx,
    o.heroId,
    2.4 * prof.bodyScaleX,
    hipCenterY,
    frontHip,
    frontKnee,
    frontFoot,
    thighLen,
    shinLen,
    thighR,
    shinR,
    c(prof.pantsColor),
    hi(prof.pantsColor),
    sh(prof.pantsColor),
    c(prof.bootColor),
    hi(prof.bootColor),
    sh(prof.bootColor),
    c(prof.skinColor),
    false
  );

  // ── 4. UPPER BODY RIG (Pelvis -> Sculpted Torso -> Head -> Arms & Weapon) ──
  ctx.save();
  ctx.translate(0, hipCenterY);
  ctx.rotate(torsoLean);

  const wHalf = 6.8 * prof.bodyScaleX;
  const sHalf = 8.4 * prof.bodyScaleX;
  const torsoH = 16.5 * prof.bodyScaleY;

  // Back support arm (drawn behind torso when aiming/holding 2-handed weapons)
  const localAimX = o.aimX * o.facing;
  const localAimY = o.aimY;
  const aimAngle = Math.atan2(
    localAimY,
    Math.max(0.001, Math.abs(localAimX) < 0.05 && localAimY !== 0 ? 0.01 : localAimX)
  );
  const recoil = o.shootTimer > 0 ? Math.min(3.4, (o.shootTimer / 0.14) * 3.4) : 0;

  if (o.meleeTimer <= 0) {
    // Support arm reaching forward to cradle the weapon forend
    const shoulderX = sHalf * 0.55;
    const shoulderY = -torsoH + 3.2;
    const gripDist = 13.5 - recoil;
    const handX = 2.5 + Math.cos(aimAngle) * gripDist;
    const handY = -torsoH + 7.2 + Math.sin(aimAngle) * gripDist;
    const elbowX = (shoulderX + handX) * 0.52 + 1.2;
    const elbowY = (shoulderY + handY) * 0.52 + 3.2;
    const armCol = prof.bareArms ? sh(prof.skinColor) : sh(prof.jacketColor);
    drawTaperedLimb(ctx, shoulderX, shoulderY, elbowX, elbowY, 2.7, 2.3, armCol, c(prof.bareArms ? prof.skinColor : prof.jacketColor), INK, 1.0);
    drawTaperedLimb(ctx, elbowX, elbowY, handX, handY, 2.3, 1.9, prof.bareArms ? sh(prof.skinColor) : armCol, c(prof.skinColor), INK, 1.0);
  }

  // Pelvis & Tactical Belt
  drawRoundedPoly(
    ctx,
    [
      [-wHalf, 1.5],
      [wHalf, 1.5],
      [wHalf * 0.92, -3.0],
      [-wHalf * 0.92, -3.0],
    ],
    '#1C1F26',
    INK,
    1.1
  );
  // Belt buckle
  drawRoundedRect(ctx, 0.2, -2.5, 3.2, 2.6, 0.5, '#D4AF37', INK, 0.75);

  // Sculpted Anatomical V-Tapered Torso (rounded belly for Ded, broad muscular chest for others!)
  if (o.heroId === 'ded') {
    // Rounded belly + open Hawaiian shirt silhouette
    drawInkEllipse(ctx, 0.5, -torsoH * 0.5, sHalf * 0.96, torsoH * 0.56, 0, c(prof.shirtColor), '#FFFFFF', sh(prof.shirtColor), 1.2);
    // Open Hawaiian shirt left/right panels
    drawRoundedPoly(
      ctx,
      [
        [-sHalf * 0.95, -torsoH + 1],
        [-2.2, -torsoH + 1.5],
        [-2.6, -1.5],
        [-wHalf * 1.08, -1.5],
      ],
      c(prof.jacketColor),
      INK,
      1.15
    );
    drawRoundedPoly(
      ctx,
      [
        [3.4, -torsoH + 1.5],
        [sHalf * 0.95, -torsoH + 1],
        [wHalf * 1.05, -1.5],
        [4.2, -1.5],
      ],
      c(prof.jacketColor),
      INK,
      1.15
    );
    // Vibrant tropical flower motifs on Hawaiian shirt
    drawInkEllipse(ctx, -5.8, -11.5, 2.2, 1.8, 0.3, '#FACC15', undefined, undefined, 0);
    drawInkEllipse(ctx, -4.5, -5.5, 2.0, 1.6, -0.2, '#2DD4BF', undefined, undefined, 0);
    drawInkEllipse(ctx, 6.2, -9.5, 1.9, 1.6, 0.2, '#39FF14', undefined, undefined, 0);
    // Open shirt lapels
    drawRoundedPoly(
      ctx,
      [
        [-4.2, -torsoH + 1],
        [-1.4, -torsoH + 4.5],
        [-3.4, -torsoH + 5.8],
      ],
      hi(prof.jacketColor),
      INK,
      0.9
    );
  } else {
    // Heroic V-tapered muscular chest & jacket/vest
    drawRoundedPoly(
      ctx,
      [
        [-wHalf, -1.8],
        [wHalf, -1.8],
        [sHalf, -torsoH + 2.2],
        [sHalf * 0.65, -torsoH - 0.5],
        [-sHalf * 0.65, -torsoH - 0.5],
        [-sHalf, -torsoH + 2.2],
      ],
      c(prof.jacketColor),
      INK,
      1.25
    );

    // Directional left neon rim light + right core shadow on torso
    ctx.strokeStyle = `${prof.rimColor}77`;
    ctx.lineWidth = 1.0;
    ctx.beginPath();
    ctx.moveTo(-sHalf + 1.2, -torsoH + 2.6);
    ctx.lineTo(-wHalf + 1.2, -2.5);
    ctx.stroke();

    // Inner chest shirt / muscular neckline
    if (o.heroId === 'vadek' || o.heroId === 'sandro' || o.heroId === 'bo') {
      drawRoundedPoly(
        ctx,
        [
          [-2.8, -torsoH + 0.5],
          [3.6, -torsoH + 0.5],
          [2.4, -2.0],
          [-1.8, -2.0],
        ],
        c(prof.shirtColor),
        INK,
        0.9
      );
    }

    // Hero-specific chest armor, lapels, pockets, LEDs, headphones!
    if (o.heroId === 'vadek') {
      // Classic biker leather folded notched lapels + zipper shine
      drawRoundedPoly(
        ctx,
        [
          [-4.8, -torsoH + 1],
          [-1.6, -torsoH + 2],
          [-2.0, -torsoH + 8.5],
          [-5.4, -torsoH + 5.5],
        ],
        hi(prof.jacketColor),
        INK,
        0.95
      );
      drawRoundedPoly(
        ctx,
        [
          [4.6, -torsoH + 1],
          [2.4, -torsoH + 2],
          [2.8, -torsoH + 7.5],
          [5.6, -torsoH + 4.8],
        ],
        hi(prof.jacketColor),
        INK,
        0.95
      );
      // Metallic snap buttons
      ctx.fillStyle = '#CBD5E1';
      ctx.fillRect(-4.2, -torsoH + 4.5, 1.2, 1.2);
      ctx.fillRect(4.0, -torsoH + 4.0, 1.2, 1.2);
    } else if (o.heroId === 'vano') {
      // Olive tactical vest center zipper + dual chest utility pockets
      ctx.strokeStyle = INK;
      ctx.lineWidth = 1.0;
      ctx.beginPath();
      ctx.moveTo(0.8, -torsoH + 1);
      ctx.lineTo(0.8, -2.2);
      ctx.stroke();
      drawRoundedRect(ctx, -5.6, -torsoH + 5.2, 4.6, 4.4, 0.8, sh(prof.jacketColor), INK, 0.9);
      drawRoundedRect(ctx, 2.2, -torsoH + 5.2, 4.4, 4.4, 0.8, sh(prof.jacketColor), INK, 0.9);
    } else if (o.heroId === 'koren') {
      // Cyber tactical armor plates + glowing electric cyan LED bars!
      drawRoundedRect(ctx, -5.5, -torsoH + 4.5, 4.5, 5.2, 0.8, '#161C24', INK, 0.9);
      drawRoundedRect(ctx, 1.8, -torsoH + 4.5, 4.5, 5.2, 0.8, '#161C24', INK, 0.9);
      ctx.fillStyle = '#00E5FF';
      ctx.fillRect(-4.6, -torsoH + 5.6, 2.7, 1.0);
      ctx.fillRect(-4.6, -torsoH + 7.3, 2.7, 1.0);
      ctx.fillRect(2.7, -torsoH + 5.6, 2.7, 1.2);
    } else if (o.heroId === 'hooper') {
      // Subtle t-shirt chest shading + studio headphones resting around neck with hanging cord!
      ctx.strokeStyle = sh(prof.jacketColor);
      ctx.lineWidth = 1.0;
      ctx.beginPath();
      ctx.moveTo(-4, -8);
      ctx.quadraticCurveTo(0, -6.5, 4.5, -8);
      ctx.stroke();
      // Neck headphone earcups (black & gold matching cover art!)
      drawInkEllipse(ctx, -3.5, -torsoH + 1.8, 2.3, 2.8, -0.25, '#18181B', '#52525B', INK, 1.0);
      drawInkEllipse(ctx, 3.8, -torsoH + 1.8, 2.3, 2.8, 0.25, '#18181B', '#52525B', INK, 1.0);
      ctx.fillStyle = '#F59E0B';
      ctx.fillRect(-4.3, -torsoH + 1.0, 1.5, 1.8);
      ctx.fillRect(3.1, -torsoH + 1.0, 1.5, 1.8);
      // Hanging headphone cord
      ctx.strokeStyle = '#111827';
      ctx.lineWidth = 0.9;
      ctx.beginPath();
      ctx.moveTo(3.4, -torsoH + 4.2);
      ctx.quadraticCurveTo(1.2, -9, 2.4, -4);
      ctx.stroke();
    } else if (o.heroId === 'sandro') {
      // Studded leather vest lapels + chrome shoulder spikes + pocket chain!
      drawRoundedPoly(
        ctx,
        [
          [-5.4, -torsoH + 0.5],
          [-2.0, -torsoH + 1.5],
          [-2.2, -torsoH + 7.8],
          [-5.6, -torsoH + 5.2],
        ],
        hi(prof.jacketColor),
        INK,
        0.9
      );
      ctx.fillStyle = '#E2E8F0';
      for (const [sx, sy] of [
        [-6.6, -torsoH + 0.2],
        [-4.8, -torsoH - 0.3],
        [4.8, -torsoH - 0.3],
        [-4.2, -torsoH + 4.0],
        [-3.8, -torsoH + 6.4],
      ]) {
        ctx.fillRect(sx, sy, 1.2, 1.2);
      }
      // Silver jeans chain hanging from hip
      ctx.strokeStyle = '#CBD5E1';
      ctx.lineWidth = 1.0;
      ctx.beginPath();
      ctx.moveTo(-4.8, -1.8);
      ctx.quadraticCurveTo(-1.0, 2.8, 3.2, -1.4);
      ctx.stroke();
    } else if (o.heroId === 'zavod_killer') {
      // Heavy mustard work parka high popped collar, vertical zipper & pockets
      drawRoundedPoly(
        ctx,
        [
          [-6.2, -torsoH + 1.2],
          [-4.2, -torsoH - 2.6],
          [4.2, -torsoH - 2.6],
          [6.2, -torsoH + 1.2],
        ],
        hi(prof.jacketColor),
        INK,
        1.1
      );
      ctx.strokeStyle = '#3F3A1D';
      ctx.lineWidth = 1.1;
      ctx.beginPath();
      ctx.moveTo(0.8, -torsoH + 1);
      ctx.lineTo(0.8, -1.8);
      ctx.stroke();
      drawRoundedRect(ctx, -6.8, -torsoH + 5.2, 5.0, 4.5, 0.8, sh(prof.jacketColor), INK, 0.9);
      drawRoundedRect(ctx, 2.4, -torsoH + 5.2, 4.8, 4.5, 0.8, sh(prof.jacketColor), INK, 0.9);
    } else if (o.heroId === 'bo') {
      // Cyber zip hoodie collar + drawstrings + kangaroo pocket
      drawRoundedPoly(
        ctx,
        [
          [-5.2, -torsoH + 1],
          [-4.0, -torsoH - 2.0],
          [3.6, -torsoH - 1.8],
          [5.0, -torsoH + 1],
        ],
        hi(prof.jacketColor),
        INK,
        1.0
      );
      ctx.strokeStyle = '#94A3B8';
      ctx.lineWidth = 0.8;
      ctx.beginPath();
      ctx.moveTo(-1.4, -torsoH + 1);
      ctx.lineTo(-1.8, -torsoH + 6.0);
      ctx.moveTo(2.4, -torsoH + 1);
      ctx.lineTo(2.6, -torsoH + 5.8);
      ctx.stroke();
      drawRoundedRect(ctx, -4.6, -6.5, 9.2, 4.2, 1.0, sh(prof.jacketColor), INK, 0.85);
    }
  }

  // ── 5. SCULPTED ANATOMICAL HEAD & FACE (1:1 Cover Portrait Match!) ──
  const headX = 0.6;
  const headY = -torsoH - 6.6;
  const headTilt = Math.max(-0.22, Math.min(0.22, aimAngle * 0.25)) + hurtTilt * 0.7;

  ctx.save();
  ctx.translate(headX, headY + 4.5);
  ctx.rotate(headTilt);
  ctx.translate(0, -4.5);

  // Muscular neck
  drawTaperedLimb(ctx, -0.4, 3.2, 0.2, 6.4, 2.7, 3.1, sh(prof.skinColor), c(prof.skinColor), shadeHex(prof.skinColor, -55), 1.0);

  // Sculpted masculine cranium + jaw contour (organic curve, NOT a square box!)
  drawInkEllipse(ctx, 0.2, -0.4, 5.4, 6.2, -0.05, c(prof.skinColor), hi(prof.skinColor), sh(prof.skinColor), 1.2);
  // Ear
  drawInkEllipse(ctx, -4.4, 0.2, 1.3, 2.0, -0.1, c(prof.skinColor), undefined, sh(prof.skinColor), 0.95);
  // Sculpted nose bridge
  ctx.strokeStyle = sh(prof.skinColor);
  ctx.lineWidth = 1.0;
  ctx.beginPath();
  ctx.moveTo(3.6, -1.4);
  ctx.lineTo(4.7, 0.8);
  ctx.lineTo(3.3, 1.2);
  ctx.stroke();

  // Hero-specific hair, beards, headgear, eyewear & likeness!
  if (o.heroId === 'vadek') {
    // Salt-and-pepper flat-top hair
    drawRoundedPoly(
      ctx,
      [
        [-5.2, -2.5],
        [-4.8, -6.8],
        [4.8, -6.8],
        [5.2, -3.5],
        [2.2, -4.2],
        [-3.2, -3.8],
      ],
      '#7A756E',
      INK,
      1.15
    );
    ctx.fillStyle = '#CBD5E1';
    ctx.fillRect(-3.6, -6.2, 6.8, 1.4);
    // Thick brown-gray sculpted beard & mustache
    drawRoundedPoly(
      ctx,
      [
        [-4.2, 1.6],
        [-2.8, 6.2],
        [2.8, 6.4],
        [5.2, 3.4],
        [5.0, 1.4],
        [2.2, 2.2],
        [-1.8, 2.0],
      ],
      '#5C4838',
      INK,
      1.1
    );
    ctx.fillStyle = '#9CA3AF';
    ctx.fillRect(0.6, 2.2, 3.8, 1.4); // graying mustache
    // Furrowed stern eye & brow
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(1.2, -1.7, 2.6, 1.4);
    ctx.fillStyle = INK;
    ctx.fillRect(2.4, -1.6, 1.3, 1.3);
    ctx.strokeStyle = '#3F2E21';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(0.8, -2.5);
    ctx.lineTo(4.2, -2.0);
    ctx.stroke();
  } else if (o.heroId === 'vano') {
    // Olive camo bandana + 2 physics-animated fluttering tails!
    const flutter1 = Math.sin(safeTime * 13) * 2.2;
    const flutter2 = Math.cos(safeTime * 11 + 0.8) * 2.0;
    drawRoundedPoly(
      ctx,
      [
        [-4.8, -2.8],
        [-11.5, -4.2 + flutter1],
        [-10.2, -1.8 + flutter1],
        [-5.0, -1.2],
      ],
      '#4D6435',
      INK,
      1.0
    );
    drawRoundedPoly(
      ctx,
      [
        [-4.8, -1.8],
        [-10.4, 0.2 + flutter2],
        [-8.8, 1.8 + flutter2],
        [-4.6, -0.4],
      ],
      '#394C27',
      INK,
      0.95
    );
    // Bandana dome
    drawRoundedPoly(
      ctx,
      [
        [-5.6, -2.0],
        [-4.6, -6.5],
        [3.6, -6.4],
        [5.6, -2.6],
        [0.0, -2.2],
      ],
      '#556B38',
      INK,
      1.15
    );
    drawInkEllipse(ctx, -1.5, -4.6, 2.2, 1.2, 0.2, '#344422', undefined, undefined, 0);
    // Rugged brown beard stubble
    drawRoundedPoly(
      ctx,
      [
        [-3.8, 1.8],
        [-2.2, 5.8],
        [2.6, 5.8],
        [5.0, 2.8],
        [4.8, 1.6],
        [1.5, 2.4],
      ],
      '#61422C',
      INK,
      1.0
    );
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(1.3, -1.6, 2.5, 1.3);
    ctx.fillStyle = INK;
    ctx.fillRect(2.5, -1.5, 1.2, 1.2);
  } else if (o.heroId === 'koren') {
    // Spiky swept-up brown hair
    drawRoundedPoly(
      ctx,
      [
        [-5.4, -2.4],
        [-6.2, -6.4],
        [-2.5, -8.4],
        [0.5, -7.2],
        [3.6, -8.2],
        [5.4, -4.0],
        [2.2, -3.8],
      ],
      '#6B4226',
      INK,
      1.15
    );
    // Glowing electric cyan cyber visor goggles!
    drawRoundedRect(ctx, -1.8, -3.2, 7.8, 3.8, 1.2, '#0B1622', INK, 1.1);
    drawRoundedRect(ctx, -0.8, -2.4, 6.2, 2.3, 0.8, '#00E5FF', '#0284C7', 0.6);
    ctx.fillStyle = '#E0F2FE';
    ctx.fillRect(0.2, -2.1, 4.2, 0.9);
    // Trimmed brown beard
    drawRoundedPoly(
      ctx,
      [
        [-3.6, 1.8],
        [-2.0, 5.6],
        [2.8, 5.6],
        [4.8, 2.8],
        [4.5, 1.6],
        [1.5, 2.3],
      ],
      '#5A3921',
      INK,
      1.0
    );
  } else if (o.heroId === 'hooper') {
    // Backwards dark-grey & red baseball cap with red rear brim + snapback strap!
    drawRoundedPoly(
      ctx,
      [
        [-10.2, -2.2],
        [-4.5, -3.4],
        [-4.5, -1.2],
        [-9.6, -0.6],
      ],
      '#DC2626',
      INK,
      1.05
    );
    drawRoundedPoly(
      ctx,
      [
        [-5.4, -2.2],
        [-4.6, -6.8],
        [3.8, -6.8],
        [5.4, -2.6],
      ],
      '#3F444E',
      INK,
      1.15
    );
    // Red snapback strap on forehead
    drawRoundedRect(ctx, 1.2, -3.6, 3.8, 1.3, 0.4, '#DC2626', INK, 0.7);
    // Sculpted dark beard
    drawRoundedPoly(
      ctx,
      [
        [-3.8, 1.8],
        [-2.0, 5.6],
        [2.8, 5.6],
        [4.8, 2.8],
        [4.6, 1.6],
        [1.5, 2.2],
      ],
      '#3B2F2A',
      INK,
      1.0
    );
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(1.3, -1.6, 2.5, 1.3);
    ctx.fillStyle = INK;
    ctx.fillRect(2.5, -1.5, 1.2, 1.2);
  } else if (o.heroId === 'sandro') {
    // SHORT swept-up dark brown rock hair (NO long hair!)
    drawRoundedPoly(
      ctx,
      [
        [-5.2, -1.6],
        [-5.4, -5.8],
        [-1.0, -7.8],
        [4.8, -6.8],
        [5.2, -3.6],
        [1.8, -4.0],
        [-3.2, -3.0],
      ],
      '#3B2B23',
      INK,
      1.15
    );
    ctx.fillStyle = '#6B5041';
    ctx.fillRect(-2.0, -6.6, 5.2, 1.2);
    // Gleaming gold hoop earring on ear!
    ctx.strokeStyle = '#FACC15';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.arc(-4.2, 2.0, 1.4, 0, Math.PI * 2);
    ctx.stroke();
    // Full trimmed rockstar beard
    drawRoundedPoly(
      ctx,
      [
        [-3.8, 1.5],
        [-2.2, 5.8],
        [2.8, 5.9],
        [5.0, 3.0],
        [4.8, 1.5],
        [1.6, 2.2],
      ],
      '#32241D',
      INK,
      1.05
    );
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(1.2, -1.6, 2.6, 1.3);
    ctx.fillStyle = INK;
    ctx.fillRect(2.4, -1.5, 1.2, 1.2);
  } else if (o.heroId === 'zavod_killer') {
    // Bright yellow ribbed construction hard hat + raised safety goggles!
    drawRoundedPoly(
      ctx,
      [
        [-6.6, -2.5],
        [-5.6, -7.8],
        [-1.2, -9.2],
        [3.6, -8.4],
        [5.8, -3.2],
        [7.4, -2.0],
        [-6.8, -1.6],
      ],
      '#FACC15',
      INK,
      1.2
    );
    // Specular ridge on hard hat
    ctx.fillStyle = '#FEF08A';
    ctx.fillRect(-2.2, -8.2, 4.4, 1.6);
    // Raised clear safety goggles on helmet front
    drawRoundedRect(ctx, -1.0, -6.0, 6.2, 2.8, 0.9, '#CBD5E1', INK, 0.9);
    ctx.fillStyle = '#F8FAFC';
    ctx.fillRect(0.2, -5.4, 3.8, 1.0);
    // Massive thick dark beard
    drawRoundedPoly(
      ctx,
      [
        [-4.6, 1.2],
        [-3.0, 6.6],
        [3.0, 6.8],
        [5.6, 3.4],
        [5.2, 1.2],
        [2.0, 2.0],
        [-2.0, 1.8],
      ],
      '#241E1B',
      INK,
      1.15
    );
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(1.4, -1.2, 2.4, 1.2);
    ctx.fillStyle = INK;
    ctx.fillRect(2.5, -1.1, 1.1, 1.1);
  } else if (o.heroId === 'bo') {
    // Gleaming clean-shaven bald dome specular highlight!
    ctx.fillStyle = '#FFF7ED';
    ctx.beginPath();
    ctx.ellipse(-1.4, -4.0, 2.2, 1.1, -0.35, 0, Math.PI * 2);
    ctx.fill();
    // Black-rimmed rectangular glasses with glowing electric cyan lens glint!
    drawRoundedRect(ctx, -1.4, -2.4, 6.8, 2.9, 0.7, '#0F172A', INK, 0.95);
    ctx.fillStyle = '#38BDF8';
    ctx.fillRect(-0.5, -1.8, 2.4, 1.7);
    ctx.fillRect(2.6, -1.8, 2.2, 1.7);
    ctx.fillStyle = '#E0F2FE';
    ctx.fillRect(0.0, -1.6, 1.2, 0.6);
    ctx.fillRect(3.0, -1.6, 1.1, 0.6);
    // Confident smirk
    ctx.strokeStyle = '#5C3A28';
    ctx.lineWidth = 0.95;
    ctx.beginPath();
    ctx.moveTo(1.2, 2.8);
    ctx.quadraticCurveTo(2.8, 3.4, 4.0, 2.4);
    ctx.stroke();
  } else if (o.heroId === 'ded') {
    // Messy swept-back brown hair
    drawRoundedPoly(
      ctx,
      [
        [-5.6, -1.6],
        [-6.2, -5.6],
        [-1.6, -7.4],
        [3.6, -6.6],
        [5.0, -3.8],
        [1.4, -4.0],
        [-3.6, -2.4],
      ],
      '#6B4226',
      INK,
      1.15
    );
    // Round green-tinted glasses!
    drawInkEllipse(ctx, 0.5, -1.0, 1.8, 1.8, 0, '#4ADE80', '#BBF7D0', '#15803D', 1.0);
    drawInkEllipse(ctx, 4.0, -1.0, 1.7, 1.7, 0, '#4ADE80', '#BBF7D0', '#15803D', 1.0);
    // Thick bushy brown beard + cheerful grin
    drawRoundedPoly(
      ctx,
      [
        [-4.8, 1.2],
        [-3.4, 7.0],
        [3.4, 7.2],
        [5.8, 3.4],
        [5.2, 1.2],
        [1.6, 1.8],
      ],
      '#6B4226',
      INK,
      1.15
    );
    // White cheerful smile peeking through beard
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(1.6, 2.3, 2.5, 1.0);
  }
  ctx.restore();

  // ── 6. FRONT SHOULDER, ARM & MELEE SLASH / 8-DIRECTION SCULPTED WEAPON ──
  const frontShoulderX = -2.4 * prof.bodyScaleX;
  const frontShoulderY = -torsoH + 3.4;
  const upperArmCol = prof.bareArms ? c(prof.skinColor) : c(prof.jacketColor);
  const upperArmHi = prof.bareArms ? hi(prof.skinColor) : hi(prof.jacketColor);
  const upperArmSh = prof.bareArms ? sh(prof.skinColor) : sh(prof.jacketColor);

  // Rounded muscular deltoid shoulder cap
  drawInkEllipse(
    ctx,
    frontShoulderX,
    frontShoulderY,
    3.5 * prof.bodyScaleX,
    3.4 * prof.bodyScaleX,
    -0.2,
    o.heroId === 'hooper' || o.heroId === 'ded' ? c(prof.jacketColor) : upperArmCol,
    hi(o.heroId === 'hooper' || o.heroId === 'ded' ? prof.jacketColor : upperArmCol),
    sh(o.heroId === 'hooper' || o.heroId === 'ded' ? prof.jacketColor : upperArmCol),
    1.15
  );

  if (o.meleeTimer > 0) {
    // Explosive multi-stage melee punch / heavy strike!
    const heavy = o.heroId === 'zavod_killer' || o.heroId === 'sandro' || o.heroId === 'ded';
    const punchReach = 8 + meleeStrike * (heavy ? 15 : 13);
    const punchY = frontShoulderY + 2 - meleeStrike * 2.5;
    const elbowX = frontShoulderX + punchReach * 0.48;
    const elbowY = frontShoulderY + 3.5;

    drawTaperedLimb(ctx, frontShoulderX, frontShoulderY, elbowX, elbowY, 3.1, 2.6, upperArmCol, upperArmHi, upperArmSh, 1.15);
    drawTaperedLimb(
      ctx,
      elbowX,
      elbowY,
      frontShoulderX + punchReach,
      punchY,
      2.6,
      2.3,
      prof.bareArms ? c(prof.skinColor) : upperArmCol,
      hi(prof.skinColor),
      sh(prof.skinColor),
      1.15
    );
    // Impact fist
    drawInkEllipse(
      ctx,
      frontShoulderX + punchReach + 2.2,
      punchY,
      heavy ? 3.8 : 3.1,
      heavy ? 3.5 : 2.9,
      0,
      o.heroId === 'vadek' ? '#1F242D' : c(prof.skinColor),
      '#FFFFFF',
      sh(prof.skinColor),
      1.15
    );

    // 3-layer glowing kinetic crescent smear!
    ctx.save();
    ctx.translate(frontShoulderX + punchReach - 1, punchY);
    ctx.strokeStyle = heavy ? 'rgba(251, 146, 60, 0.88)' : `${prof.rimColor}DD`;
    ctx.lineWidth = heavy ? 5 : 3.8;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.arc(0, 0, heavy ? 15 : 12.5, -1.15, 1.15);
    ctx.stroke();

    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.arc(1.2, 0, heavy ? 13 : 10.5, -0.88, 0.88);
    ctx.stroke();
    ctx.restore();
  } else {
    // 8-direction weapon + articulated gripping arm
    ctx.save();
    ctx.translate(frontShoulderX + 2.2, frontShoulderY + 4.2);
    ctx.rotate(aimAngle);

    // Sculpted weapon drawn in-hand with recoil kickback
    drawWeaponInHand(ctx, o.weaponId, 4.5 - recoil, -3.5, o.shootTimer > 0, safeTime);

    // Front bicep -> elbow -> forearm -> trigger hand overlapping weapon grip!
    const triggerX = 6.8 - recoil;
    const triggerY = 0.6;
    const elbowX = 1.4 - recoil * 0.4;
    const elbowY = 4.2;
    drawTaperedLimb(ctx, -2.2, -3.6, elbowX, elbowY, 3.0, 2.5, upperArmCol, upperArmHi, upperArmSh, 1.15);
    drawTaperedLimb(
      ctx,
      elbowX,
      elbowY,
      triggerX,
      triggerY,
      2.5,
      2.0,
      prof.bareArms ? c(prof.skinColor) : upperArmCol,
      hi(prof.bareArms ? prof.skinColor : upperArmCol),
      sh(prof.bareArms ? prof.skinColor : upperArmCol),
      1.15
    );
    // Studded wristband on Sandro / fingerless gloves on Vadek & Koren
    if (o.heroId === 'sandro') {
      drawRoundedRect(ctx, triggerX - 3.0, triggerY - 1.8, 2.6, 3.6, 0.5, '#18181B', INK, 0.8);
      ctx.fillStyle = '#E2E8F0';
      ctx.fillRect(triggerX - 2.2, triggerY - 0.8, 1.0, 1.0);
    }
    const gloveCol = o.heroId === 'vadek' || o.heroId === 'koren' ? '#1E242E' : c(prof.skinColor);
    drawInkEllipse(ctx, triggerX + 1.0, triggerY, 2.2, 2.0, 0, gloveCol, hi(gloveCol), sh(gloveCol), 1.0);
    ctx.restore();
  }

  ctx.restore(); // end upper body rig
  ctx.restore(); // end hero sprite
  void hero;
}

function drawHeroOnBike(
  ctx: CanvasRenderingContext2D,
  o: HeroRenderOpts,
  prof: HeroStyleProfile,
  flash: boolean,
  c: (s: string) => string,
  hi: (s: string) => string,
  sh: (s: string) => string
): void {
  const hero = HERO_MAP[o.heroId];
  const p = hero.palette;
  const safeTime = Math.max(0, o.animTime);
  const wheelAngle = safeTime * 22;
  const rumble = Math.sin(safeTime * 42) * 0.85;

  // Neon underglow reflection on highway
  ctx.fillStyle = `${p.bikeAccent}38`;
  ctx.beginPath();
  ctx.ellipse(0, 0, 29, 5.5, 0, 0, Math.PI * 2);
  ctx.fill();

  // Blazing afterburner exhaust flame cone
  const flameLen = 11 + Math.sin(safeTime * 55) * 4.5;
  drawRoundedPoly(
    ctx,
    [
      [-23, -11.5 + rumble],
      [-23 - flameLen, -9 + rumble],
      [-23, -6.5 + rumble],
    ],
    '#FF2A85',
    'transparent',
    0
  );
  drawRoundedPoly(
    ctx,
    [
      [-23, -10.4 + rumble],
      [-23 - flameLen * 0.65, -9 + rumble],
      [-23, -7.6 + rumble],
    ],
    '#FEF08A',
    'transparent',
    0
  );

  // Smooth circular spinning motorcycle wheels with metallic rims & spokes
  for (const wx of [-18, 20]) {
    const wy = -8;
    drawInkEllipse(ctx, wx, wy, 8.2, 8.2, 0, '#111827', '#374151', INK, 1.3);
    drawInkEllipse(ctx, wx, wy, 4.8, 4.8, 0, '#334155', '#94A3B8', '#0F172A', 1.0);
    ctx.strokeStyle = p.bikeAccent;
    ctx.lineWidth = 1.2;
    for (let s = 0; s < 3; s++) {
      const a = wheelAngle + (s * Math.PI) / 3;
      ctx.beginPath();
      ctx.moveTo(wx - Math.cos(a) * 4.2, wy - Math.sin(a) * 4.2);
      ctx.lineTo(wx + Math.cos(a) * 4.2, wy + Math.sin(a) * 4.2);
      ctx.stroke();
    }
    drawInkEllipse(ctx, wx, wy, 1.6, 1.6, 0, '#E2E8F0', undefined, undefined, 0.8);
  }

  // Chrome exhaust pipe & engine block
  drawTaperedLimb(ctx, -23, -9 + rumble, -3, -10 + rumble, 1.8, 2.2, '#94A3B8', '#F8FAFC', '#334155', 1.0);
  drawRoundedRect(ctx, -9, -15 + rumble, 17, 7.5, 1.8, '#283140', INK, 1.1);

  // Sculpted Cyber-Streetfighter Fairing & Fuel Tank
  drawRoundedPoly(
    ctx,
    [
      [-20, -16 + rumble],
      [-12, -21 + rumble],
      [6, -24 + rumble],
      [21, -20 + rumble],
      [24, -14 + rumble],
      [8, -11 + rumble],
      [-15, -12 + rumble],
    ],
    c(p.bikeMain),
    INK,
    1.3
  );
  // Racing neon stripe
  drawRoundedPoly(
    ctx,
    [
      [-11, -19 + rumble],
      [7, -22 + rumble],
      [19, -18 + rumble],
      [6, -17 + rumble],
    ],
    c(p.bikeAccent),
    INK,
    0.8
  );

  // Angled front fork & bright headlight cone
  drawTaperedLimb(ctx, 13, -25 + rumble, 20, -8, 2.0, 1.6, '#CBD5E1', '#FFFFFF', '#475569', 1.1);
  drawInkEllipse(ctx, 21.5, -19.5 + rumble, 3.2, 2.8, 0.2, '#FEF08A', '#FFFFFF', '#D97706', 1.0);
  ctx.fillStyle = 'rgba(254, 240, 138, 0.18)';
  ctx.beginPath();
  ctx.moveTo(24, -21 + rumble);
  ctx.lineTo(88, -33 + rumble);
  ctx.lineTo(88, -3 + rumble);
  ctx.lineTo(24, -17 + rumble);
  ctx.closePath();
  ctx.fill();

  // Signature hero bike mods
  if (o.heroId === 'sandro') {
    drawRoundedRect(ctx, -26, -30 + rumble, 9, 13, 1.5, '#18181B', INK, 1.1);
    drawInkEllipse(ctx, -21.5, -25 + rumble, 2.8, 2.8, 0, '#C084FC', '#F5D0FE', '#581C87', 0.9);
    drawInkEllipse(ctx, -21.5, -20 + rumble, 2.2, 2.2, 0, '#E879F9', '#FFFFFF', '#701A75', 0.8);
  } else if (o.heroId === 'ded') {
    drawRoundedRect(ctx, -14, -13 + rumble, 24, 6.5, 2.0, '#9D174D', INK, 1.1);
    drawRoundedRect(ctx, -6, -21 + rumble, 5, 9, 1.5, '#06B6D4', INK, 1.0);
    ctx.fillStyle = 'rgba(57, 255, 20, 0.42)';
    ctx.beginPath();
    ctx.arc(-18 - ((safeTime * 28) % 14), -25 + Math.sin(safeTime * 9) * 2, 5.5, 0, Math.PI * 2);
    ctx.fill();
  }

  // Leaning articulated rider matching hero's jacket & head!
  // Rider leg bent on footpeg
  drawTaperedLimb(ctx, -6, -20 + rumble, 2, -14 + rumble, 3.0, 2.5, c(prof.pantsColor), hi(prof.pantsColor), sh(prof.pantsColor), 1.1);
  drawTaperedLimb(ctx, 2, -14 + rumble, -3, -8 + rumble, 2.5, 2.1, c(prof.bootColor), hi(prof.bootColor), INK, 1.1);
  // Rider leaning torso
  drawRoundedPoly(
    ctx,
    [
      [-10, -20 + rumble],
      [-5, -34 + rumble],
      [6, -33 + rumble],
      [2, -19 + rumble],
    ],
    c(prof.jacketColor),
    INK,
    1.2
  );
  // Rider head
  drawInkEllipse(ctx, 1, -40 + rumble, 5.2, 5.6, 0.1, c(prof.skinColor), hi(prof.skinColor), sh(prof.skinColor), 1.2);
  if (o.heroId === 'zavod_killer') {
    drawRoundedPoly(
      ctx,
      [
        [-5, -42 + rumble],
        [-3, -47 + rumble],
        [5, -46 + rumble],
        [7, -41 + rumble],
      ],
      '#FACC15',
      INK,
      1.15
    );
  } else if (o.heroId === 'koren') {
    drawRoundedRect(ctx, -1, -42.5 + rumble, 7, 3.2, 0.9, '#00E5FF', INK, 0.95);
  } else if (o.heroId === 'hooper') {
    drawRoundedPoly(ctx, [[-8, -42 + rumble], [-3, -46 + rumble], [5, -45 + rumble], [6, -42 + rumble]], '#DC2626', INK, 1.0);
  } else if (o.heroId === 'bo') {
    drawRoundedRect(ctx, 0, -42 + rumble, 6.2, 2.6, 0.6, '#0F172A', INK, 0.9);
    ctx.fillStyle = '#00E5FF';
    ctx.fillRect(1.2, -41.4 + rumble, 4.2, 1.4);
  } else {
    drawRoundedPoly(
      ctx,
      [
        [-5, -42 + rumble],
        [-4, -46 + rumble],
        [5, -45.5 + rumble],
        [6, -42 + rumble],
      ],
      p.hair,
      INK,
      1.05
    );
  }

  // 8-direction mounted weapon
  const localAimX = o.aimX * o.facing;
  const angle = Math.atan2(o.aimY, Math.max(0.01, localAimX));
  ctx.save();
  ctx.translate(2, -29 + rumble);
  ctx.rotate(angle);
  drawWeaponInHand(ctx, o.weaponId, 4, -3, o.shootTimer > 0, safeTime);
  ctx.restore();

  void flash;
}

export function drawWeaponInHand(
  ctx: CanvasRenderingContext2D,
  weaponId: WeaponId,
  x: number,
  y: number,
  firing: boolean,
  time = 0
): void {
  const w = WEAPON_MAP[weaponId];
  switch (weaponId) {
    case 'chaindog':
      // Tactical pump shotgun with wooden stock & ribbed forend (Vadek portrait!)
      drawRoundedPoly(
        ctx,
        [
          [x - 5, y + 1.5],
          [x + 2, y + 0.8],
          [x + 2, y + 4.8],
          [x - 5.5, y + 6.2],
        ],
        '#7C3F19',
        INK,
        1.0
      );
      drawRoundedRect(ctx, x + 1, y, 16, 3.2, 0.8, '#475569', INK, 1.0);
      drawRoundedRect(ctx, x + 4, y + 2.8, 11, 2.3, 0.6, '#1E293B', INK, 0.9);
      drawRoundedRect(ctx, x + 7.5, y + 3.0, 5.5, 2.6, 0.7, '#D97706', INK, 0.8); // ribbed pump
      ctx.fillStyle = '#CBD5E1';
      ctx.fillRect(x + 2, y + 0.6, 13, 0.8);
      break;
    case 'spinning':
      // Sleek cyber MP5 SMG with curved magazine & cyan LED status dots (Vano portrait!)
      drawRoundedRect(ctx, x - 2, y + 0.4, 14.5, 4.4, 1.0, '#1E293B', INK, 1.0);
      drawRoundedPoly(
        ctx,
        [
          [x + 6, y + 4.6],
          [x + 9, y + 4.6],
          [x + 10.5, y + 10.5],
          [x + 7.4, y + 10.5],
        ],
        '#334155',
        INK,
        0.95
      );
      drawRoundedRect(ctx, x + 12, y + 1.2, 5.2, 2.6, 0.6, '#475569', INK, 0.9);
      ctx.fillStyle = '#00E5FF';
      ctx.fillRect(x + 3.5, y + 1.8, 4.2, 1.2);
      break;
    case 'rc_launcher':
      // Futuristic cyan coil plasma grenade launcher (Koren portrait!)
      drawRoundedRect(ctx, x - 3, y - 0.8, 18.5, 6.8, 1.5, '#27303F', INK, 1.1);
      drawRoundedRect(ctx, x + 4, y - 0.2, 10.5, 4.8, 1.0, '#0C4A6E', INK, 0.85);
      // Glowing plasma coils
      ctx.fillStyle = '#00E5FF';
      for (let i = 0; i < 4; i++) {
        ctx.fillRect(x + 5.2 + i * 2.4, y + 0.5, 1.4, 3.4);
      }
      ctx.fillStyle = '#E0F2FE';
      ctx.fillRect(x + 5.2, y + 1.4, 8.8, 1.1);
      drawRoundedRect(ctx, x + 15, y - 1.5, 3.2, 8.2, 0.8, '#334155', INK, 1.0);
      break;
    case 'blast_beat': {
      // Massive rotary 6-barrel minigun with hanging curved brass bullet belt (Hooper portrait!)
      const spin = Math.floor(time * 28) % 2;
      // Curved brass ammo belt
      for (let i = 0; i < 6; i++) {
        const bx = x + 1 + i * 1.4;
        const by = y + 6.5 + Math.sin(i * 0.65) * 3.8;
        drawRoundedRect(ctx, bx, by, 2.0, 3.4, 0.4, i % 2 === 0 ? '#FACC15' : '#D97706', INK, 0.6);
      }
      drawRoundedRect(ctx, x - 4, y - 1.2, 11, 8.2, 1.5, '#2E3440', INK, 1.1);
      // Top carry handle
      ctx.strokeStyle = '#94A3B8';
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.moveTo(x + 1, y - 1.2);
      ctx.lineTo(x + 2, y - 3.6);
      ctx.lineTo(x + 8, y - 3.6);
      ctx.lineTo(x + 9, y - 1.2);
      ctx.stroke();
      // Rotating multi-barrel cluster
      drawRoundedRect(ctx, x + 6.5, y - 0.5, 14.5, 6.8, 1.0, '#1F2937', INK, 1.05);
      ctx.fillStyle = '#CBD5E1';
      ctx.fillRect(x + 7.5, y + (spin ? 0.5 : 1.2), 12.5, 1.1);
      ctx.fillStyle = '#FF2A85';
      ctx.fillRect(x + 7.5, y + 2.8, 12.5, 1.0);
      ctx.fillStyle = '#CBD5E1';
      ctx.fillRect(x + 7.5, y + (spin ? 4.8 : 4.2), 12.5, 1.1);
      // Barrel clamp rings
      ctx.fillStyle = '#64748B';
      ctx.fillRect(x + 11.5, y - 0.5, 1.8, 6.8);
      ctx.fillRect(x + 17.5, y - 0.5, 1.8, 6.8);
      break;
    }
    case 'bass_beam':
      // Sleek glowing neon-violet bass railgun rifle (Sandro portrait!)
      drawRoundedPoly(
        ctx,
        [
          [x - 4, y + 0.2],
          [x + 17, y - 1.0],
          [x + 20, y + 1.2],
          [x + 19, y + 5.6],
          [x - 3, y + 6.2],
        ],
        '#4C1D95',
        INK,
        1.1
      );
      // Glowing plasma rail trench
      drawRoundedRect(ctx, x + 4.5, y + 1.2, 13.5, 2.8, 0.8, '#D946EF', '#581C87', 0.6);
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(x + 6, y + 2.0, 10.5, 1.0);
      // Top scope
      drawRoundedRect(ctx, x + 4.5, y - 2.6, 6.5, 2.2, 0.7, '#7E22CE', INK, 0.85);
      break;
    case 'domna':
      // Heavy industrial steel flamethrower with braided hose & dancing pilot flame (Zavod Killer portrait!)
      ctx.strokeStyle = '#374151';
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.moveTo(x - 1, y + 5.5);
      ctx.quadraticCurveTo(x + 3, y + 10.5, x + 8, y + 5.5);
      ctx.stroke();
      drawRoundedRect(ctx, x - 3, y, 14, 5.8, 1.2, '#64748B', INK, 1.05);
      drawRoundedRect(ctx, x + 10.5, y + 0.5, 7.5, 4.6, 0.9, '#94A3B8', INK, 1.0);
      // Heat vents
      ctx.fillStyle = '#1E293B';
      for (let i = 0; i < 3; i++) {
        ctx.fillRect(x + 11.8 + i * 2.0, y + 1.5, 1.1, 2.4);
      }
      // Dancing pilot flame!
      const fl = Math.sin(time * 32) * 1.4;
      drawInkEllipse(ctx, x + 20.5, y + 2.2 + fl * 0.3, 3.2 + Math.abs(fl) * 0.4, 2.2, -0.2, '#F97316', '#FEF08A', '#DC2626', 0);
      drawInkEllipse(ctx, x + 19.8, y + 2.4, 1.6, 1.1, 0, '#FFFFFF', undefined, undefined, 0);
      break;
    case 'firewall':
      // High-voltage copper-coil Tesla stun pistol with crackling cyan arc (Bo portrait!)
      drawRoundedRect(ctx, x - 1, y + 0.4, 13.5, 5.2, 1.1, '#1E293B', INK, 1.05);
      // Copper induction coil
      drawRoundedRect(ctx, x + 6.5, y + 1.0, 4.8, 4.0, 0.6, '#D97706', INK, 0.8);
      // Twin prongs
      drawRoundedRect(ctx, x + 12, y - 0.3, 4.8, 1.5, 0.4, '#94A3B8', INK, 0.8);
      drawRoundedRect(ctx, x + 12, y + 4.4, 4.8, 1.5, 0.4, '#94A3B8', INK, 0.8);
      // Electric arc crackle
      ctx.strokeStyle = Math.floor(time * 20) % 2 === 0 ? '#FFFFFF' : '#00E5FF';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(x + 15.5, y + 0.6);
      ctx.lineTo(x + 14.2, y + 2.5);
      ctx.lineTo(x + 16.2, y + 4.8);
      ctx.stroke();
      break;
    case 'dymok':
      // Crazy glowing neon-green cyber hookah smoke cannon (Ded portrait!)
      drawRoundedRect(ctx, x - 2, y - 0.8, 18, 7.2, 1.8, '#263238', INK, 1.1);
      // Glowing toxic green glass chamber
      drawRoundedRect(ctx, x + 3.5, y + 0.5, 8.5, 4.6, 1.0, '#22C55E', '#14532D', 0.8);
      ctx.fillStyle = '#BBF7D0';
      ctx.fillRect(x + 4.5, y + 1.3, 6.2, 1.4);
      // Wide nozzle + rising green vapor curl!
      drawRoundedRect(ctx, x + 14.5, y - 1.5, 3.8, 8.6, 1.0, '#374151', INK, 1.05);
      const puffY = (time * 18) % 8;
      ctx.fillStyle = 'rgba(57, 255, 20, 0.55)';
      ctx.beginPath();
      ctx.arc(x + 19.5 + Math.sin(time * 8) * 1.4, y + 1 - puffY * 0.7, 2.2, 0, Math.PI * 2);
      ctx.fill();
      break;
  }

  // Intense multi-layered arcade muzzle flash bloom!
  if (firing) {
    const mx = x + 20.5;
    const my = y + 2.6;
    ctx.save();
    ctx.fillStyle = w.color;
    ctx.beginPath();
    ctx.ellipse(mx + 2, my, 6.5, 4.8, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = w.glowColor;
    ctx.beginPath();
    ctx.ellipse(mx + 1, my, 4.5, 3.2, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.ellipse(mx, my, 2.4, 1.8, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

export function drawPickupSprite(
  ctx: CanvasRenderingContext2D,
  kind: 'beer' | 'weapon',
  x: number,
  y: number,
  t: number,
  weaponId?: WeaponId
): void {
  const bob = Math.sin(t * 5.5) * 2.5;
  ctx.save();
  ctx.translate(Math.round(x), Math.round(y));

  ctx.fillStyle = 'rgba(0,0,0,0.5)';
  ctx.beginPath();
  ctx.ellipse(0, 2, 11, 3.5, 0, 0, Math.PI * 2);
  ctx.fill();

  if (kind === 'beer') {
    // Glowing golden classic beer mug with frothy foam
    ctx.strokeStyle = 'rgba(255, 176, 0, 0.7)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(0, -8 + bob, 11 + Math.sin(t * 8) * 1.5, 0, Math.PI * 2);
    ctx.stroke();

    box(ctx, -6, -15 + bob, 11, 14, '#D97706', '#FCD34D', '#78350F');
    px(ctx, -4, -13 + bob, 2, 10, '#FEF08A'); // glass highlight
    box(ctx, -7, -18 + bob, 13, 5, '#FEF9C3', '#FFFFFF', '#E5E7EB'); // foam crown
    box(ctx, 5, -13 + bob, 4, 9, '#F59E0B', '#FEF08A', '#92400E'); // handle
    px(ctx, 6, -11 + bob, 2, 5, '#090C11');
  } else if (weaponId) {
    const w = WEAPON_MAP[weaponId];
    box(ctx, -14, -15 + bob, 28, 14, '#111827', w.color, '#090C11');
    px(ctx, -12, -13 + bob, 24, 10, '#0B1018');
    drawWeaponInHand(ctx, weaponId, -9, -10 + bob, false, t);
  }
  ctx.restore();
}

export interface EnemyRenderOpts {
  kind: EnemyKind;
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
  variant?: number;
}

export function drawEnemySprite(ctx: CanvasRenderingContext2D, e: EnemyRenderOpts): void {
  ctx.save();
  ctx.translate(e.x, e.y);

  const isBoss = e.kind.startsWith('boss_');
  const shadowW = e.kind === 'boss_caravan' ? 62 : isBoss ? 34 : e.kind === 'beer_truck' ? 35 : 13;
  ctx.fillStyle = 'rgba(0,0,0,0.56)';
  ctx.beginPath();
  ctx.ellipse(0, 2, shadowW, isBoss ? 9 : 4.6, 0, 0, Math.PI * 2);
  ctx.fill();

  // Pulsing lethal danger telegraph ring!
  if (e.telegraphTimer > 0) {
    const blink = Math.floor(e.animTime * 24) % 2 === 0;
    ctx.strokeStyle = blink ? '#FFB000' : '#FF2A85';
    ctx.lineWidth = isBoss ? 2.6 : 2.0;
    ctx.beginPath();
    ctx.ellipse(0, 2, shadowW + 8, isBoss ? 12 : 7.5, 0, 0, Math.PI * 2);
    ctx.stroke();
  }

  // Allied hacked cyan ring
  if (e.hacked) {
    ctx.strokeStyle = '#00E5FF';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(0, 2, shadowW + 5, 7, 0, 0, Math.PI * 2);
    ctx.stroke();
  }

  ctx.translate(0, -e.z);
  ctx.scale(e.facing, 1);

  const flash = e.hurtTimer > 0 && Math.floor(e.hurtTimer * 26) % 2 === 0;
  const c = (col: string) => (flash ? '#FFFFFF' : col);
  const hi = (col: string) => (flash ? '#FFFFFF' : shadeHex(col, 34));
  const sh = (col: string) => (flash ? '#CBD5E1' : shadeHex(col, -38));

  const t = Math.max(0, e.animTime);
  const walkPhase = t * 9.5;
  const s = Math.sin(walkPhase);
  const bob = -Math.abs(s) * 2.0;
  const rage = isBoss && e.phase >= 2;
  const pulse = 0.5 + 0.5 * Math.sin(t * (rage ? 14 : 7));

  switch (e.kind) {
    case 'drunk': {
      // Infected PIZED-77 bar mutant-zombie: hunched spine, articulated shambling legs, foaming green maw & jagged bottle
      const sway = Math.sin(t * 4.8) * 0.14;
      const hipY = -17 + bob * 0.7;
      // Shambling back & front articulated legs
      drawTaperedLimb(ctx, -2, hipY, -4 - s * 4, -8, 2.7, 2.2, sh('#2E3A48'), '#475569', INK, 1.0);
      drawTaperedLimb(ctx, -4 - s * 4, -8, -5 - s * 5, 0, 2.2, 2.0, sh('#1E293B'), '#334155', INK, 1.0);
      drawTaperedLimb(ctx, 2, hipY, 4 + s * 4, -8, 2.8, 2.2, c('#334155'), hi('#334155'), sh('#334155'), 1.05);
      drawTaperedLimb(ctx, 4 + s * 4, -8, 5 + s * 5, 0, 2.2, 2.1, c('#1E293B'), '#475569', INK, 1.05);

      ctx.save();
      ctx.translate(0, hipY);
      ctx.rotate(0.24 + sway); // creepy hunched posture
      // Ragged torn green-stained hoodie/jacket
      drawRoundedPoly(
        ctx,
        [
          [-6.5, 1],
          [6.5, 1],
          [8.2, -14],
          [2.0, -17],
          [-6.8, -15],
        ],
        c('#365314'),
        INK,
        1.2
      );
      // Glowing toxic vomit stain & exposed green veins on chest
      drawInkEllipse(ctx, 2.5, -7, 3.8, 4.5, 0.2, '#14532D', '#39FF14', '#052E16', 0.8);
      // Sickly mutated head with glowing sunken eyes & dripping neon mouth
      drawInkEllipse(ctx, 3.2, -21, 5.4, 5.8, 0.15, c('#84CC16'), '#D9F99D', '#3F6212', 1.2);
      // Tangled greasy hair tufts
      drawRoundedPoly(ctx, [[-2, -24], [1, -28], [5, -27], [8, -23], [2, -24]], '#1C1917', INK, 0.9);
      // Glowing infected eyes
      drawInkEllipse(ctx, 5.8, -22.2, 1.8, 1.3, 0, '#39FF14', '#FFFFFF', '#15803D', 0.7);
      // Gaping foaming viral mouth
      drawInkEllipse(ctx, 6.2, -18.2, 2.6, 2.0, 0.1, '#052E16', undefined, undefined, 0.8);
      ctx.fillStyle = '#39FF14';
      ctx.fillRect(5.6, -17.5, 1.8, 3.2 + pulse * 1.5); // dripping slime!

      // Outstretched clawed arm clutching a broken glowing green beer bottle
      const bottleSwing = e.telegraphTimer > 0 ? -0.9 : Math.sin(t * 6) * 0.2;
      ctx.save();
      ctx.translate(4, -12);
      ctx.rotate(bottleSwing);
      drawTaperedLimb(ctx, 0, 0, 8, 3, 2.6, 2.1, c('#65A30D'), '#BEF264', '#365314', 1.05);
      // Broken jagged glowing bottle
      drawRoundedPoly(
        ctx,
        [
          [7, 4],
          [11, -6],
          [13, -8],
          [14, -4],
          [12, 4],
        ],
        '#22C55E',
        INK,
        1.0
      );
      ctx.fillStyle = '#BBF7D0';
      ctx.fillRect(10.5, -5, 1.6, 6);
      ctx.restore();
      ctx.restore();
      break;
    }

    case 'buffalo': {
      // Hulking horned market bruiser: muscular tapered limbs, butcher apron, curved ivory bull horns & massive fist
      const hipY = -19 + bob;
      drawTaperedLimb(ctx, -4, hipY, -6 - s * 4.5, -9, 4.0, 3.4, sh('#1E293B'), '#475569', INK, 1.2);
      drawTaperedLimb(ctx, -6 - s * 4.5, -9, -6 - s * 5, 0, 3.4, 3.6, '#14171D', '#334155', INK, 1.2);
      drawTaperedLimb(ctx, 4, hipY, 6 + s * 4.5, -9, 4.1, 3.4, c('#27303F'), '#64748B', INK, 1.2);
      drawTaperedLimb(ctx, 6 + s * 4.5, -9, 6 + s * 5, 0, 3.4, 3.6, '#181C24', '#475569', INK, 1.2);

      // Barrel-chested muscular torso
      drawRoundedPoly(
        ctx,
        [
          [-10.5, hipY + 1],
          [10.5, hipY + 1],
          [13.5, hipY - 19],
          [8.0, hipY - 23],
          [-8.0, hipY - 23],
          [-13.5, hipY - 19],
        ],
        c('#9A3412'),
        INK,
        1.3
      );
      // Stained dark-green butcher market apron
      drawRoundedPoly(
        ctx,
        [
          [-7.5, hipY - 18],
          [7.5, hipY - 18],
          [9.0, hipY + 3],
          [-9.0, hipY + 3],
        ],
        c('#14532D'),
        INK,
        1.1
      );
      // Steel shoulder strap & hazard stain
      ctx.fillStyle = '#39FF14';
      ctx.fillRect(-3, hipY - 11, 6, 3);

      // Bull-helmeted brute head with wicked curved horns!
      const hy = hipY - 27;
      drawInkEllipse(ctx, 1, hy, 7.2, 6.8, 0, c('#C88D6B'), '#E8B898', '#7C4B32', 1.25);
      // Iron helmet crown + razor-curved ivory horns
      drawRoundedPoly(ctx, [[-7, hy - 2], [-5, hy - 8], [6, hy - 8], [8, hy - 2]], '#475569', INK, 1.15);
      drawRoundedPoly(ctx, [[-6, hy - 5], [-13, hy - 11], [-10, hy - 14], [-4, hy - 7]], '#F1F5F9', INK, 1.0);
      drawRoundedPoly(ctx, [[6, hy - 5], [14, hy - 11], [11, hy - 14], [4, hy - 7]], '#F1F5F9', INK, 1.0);
      // Glowing rage eyes + brass nose ring
      ctx.fillStyle = '#FF2A85';
      ctx.fillRect(2.5, hy - 1.8, 4.2, 2.0);
      ctx.strokeStyle = '#FACC15';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.arc(6.5, hy + 2.2, 1.8, 0, Math.PI * 2);
      ctx.stroke();

      // Massive brawny arm & iron knuckle fist
      const swing = e.telegraphTimer > 0 ? -1.1 : s * 0.35;
      ctx.save();
      ctx.translate(7, hipY - 17);
      ctx.rotate(swing);
      drawTaperedLimb(ctx, 0, 0, 5, 10, 4.0, 3.3, c('#C88D6B'), '#E8B898', '#7C4B32', 1.2);
      drawInkEllipse(ctx, 6, 12, 4.2, 3.8, 0, '#334155', '#94A3B8', INK, 1.15);
      ctx.restore();
      break;
    }

    case 'guard_gunner':
    case 'guard_shield': {
      // Sleek armored cyberpunk factory riot trooper
      const hipY = -18 + bob;
      drawTaperedLimb(ctx, -3, hipY, -4 - s * 4, -8, 3.1, 2.5, sh('#1E293B'), '#475569', INK, 1.1);
      drawTaperedLimb(ctx, -4 - s * 4, -8, -4 - s * 5, 0, 2.5, 2.6, '#0F172A', '#334155', INK, 1.1);
      drawTaperedLimb(ctx, 3, hipY, 4 + s * 4, -8, 3.2, 2.5, c('#1E293B'), '#64748B', INK, 1.1);
      drawTaperedLimb(ctx, 4 + s * 4, -8, 4 + s * 5, 0, 2.5, 2.6, '#111827', '#475569', INK, 1.1);

      // Angled tactical armor torso
      drawRoundedPoly(
        ctx,
        [
          [-7.5, hipY + 1],
          [7.5, hipY + 1],
          [9.5, hipY - 16],
          [6.0, hipY - 19],
          [-6.0, hipY - 19],
          [-9.5, hipY - 16],
        ],
        c('#131B26'),
        INK,
        1.2
      );
      // Glowing green corporate chest armor plate
      drawRoundedPoly(
        ctx,
        [
          [-6.0, hipY - 15],
          [6.5, hipY - 15],
          [5.2, hipY - 6],
          [-4.8, hipY - 6],
        ],
        c('#15803D'),
        INK,
        1.0
      );
      ctx.fillStyle = '#39FF14';
      ctx.fillRect(-1.5, hipY - 12.5, 4.5, 2.2);

      // Predatory cyber combat helmet + neon slit visor
      drawInkEllipse(ctx, 0.5, hipY - 24, 6.2, 6.4, 0, c('#283445'), '#64748B', '#0F172A', 1.2);
      drawRoundedPoly(ctx, [[0, hipY - 26], [7.2, hipY - 25], [6.8, hipY - 22], [0, hipY - 22.5]], '#39FF14', INK, 0.8);

      if (e.kind === 'guard_shield') {
        // Towering curved hydraulic riot shield with electric shock grid!
        drawRoundedPoly(
          ctx,
          [
            [6.5, hipY - 23],
            [14.5, hipY - 20],
            [15.5, hipY + 16],
            [7.5, hipY + 18],
          ],
          c('#283445'),
          INK,
          1.3
        );
        drawRoundedRect(ctx, 9.2, hipY - 16, 4.2, 28, 1.0, '#0F172A', INK, 0.9);
        ctx.fillStyle = '#39FF14';
        ctx.fillRect(10.5, hipY - 12, 1.8, 20);
      } else {
        // Armored arm + sleek cyber pulse rifle
        drawTaperedLimb(ctx, -1, hipY - 13, 8, hipY - 9, 2.7, 2.2, c('#1E293B'), '#64748B', INK, 1.05);
        drawRoundedRect(ctx, 5, hipY - 12, 16, 4.6, 1.0, '#334155', INK, 1.05);
        ctx.fillStyle = '#39FF14';
        ctx.fillRect(15, hipY - 10.8, 5, 2.2);
      }
      break;
    }

    case 'turret': {
      const tint = e.hacked ? '#00E5FF' : '#39FF14';
      // Articulated steel tripod legs
      drawTaperedLimb(ctx, -12, 0, -4, -12, 2.6, 2.2, '#334155', '#94A3B8', '#0F172A', 1.1);
      drawTaperedLimb(ctx, 12, 0, 4, -12, 2.6, 2.2, '#334155', '#94A3B8', '#0F172A', 1.1);
      drawRoundedRect(ctx, -10, -14, 20, 5, 1.2, '#1E293B', INK, 1.1);
      // Rotating armored gun dome
      drawInkEllipse(ctx, 0, -21, 11, 8.5, 0, c('#263242'), '#64748B', '#0F172A', 1.25);
      // Optical sensor eye
      drawInkEllipse(ctx, 4, -21, 4.2, 3.6, 0, tint, '#FFFFFF', sh(tint), 0.9);
      // Twin heavy barrels
      drawRoundedRect(ctx, 8, -24.5, 15, 2.8, 0.6, '#64748B', INK, 1.0);
      drawRoundedRect(ctx, 8, -20.0, 15, 2.8, 0.6, '#475569', INK, 1.0);
      break;
    }

    case 'drone': {
      const hover = Math.sin(t * 9) * 3.8;
      const tint = e.hacked ? '#00E5FF' : '#FF2A85';
      // Translucent spinning rotor blurs
      ctx.fillStyle = 'rgba(203, 213, 225, 0.45)';
      ctx.beginPath();
      ctx.ellipse(-12, -43 + hover, 7 + pulse * 2, 1.8, 0, 0, Math.PI * 2);
      ctx.ellipse(12, -43 + hover, 7 + pulse * 2, 1.8, 0, 0, Math.PI * 2);
      ctx.fill();
      // Thruster struts
      drawTaperedLimb(ctx, -6, -37 + hover, -12, -42 + hover, 1.6, 1.4, '#475569', '#CBD5E1', INK, 0.9);
      drawTaperedLimb(ctx, 6, -37 + hover, 12, -42 + hover, 1.6, 1.4, '#475569', '#CBD5E1', INK, 0.9);
      // Sleek curved hunter-killer body
      drawRoundedPoly(
        ctx,
        [
          [-13, -36 + hover],
          [-6, -42 + hover],
          [8, -41 + hover],
          [14, -35 + hover],
          [7, -30 + hover],
          [-8, -31 + hover],
        ],
        c('#1E293B'),
        INK,
        1.25
      );
      // Glowing predatory scanner eye
      drawInkEllipse(ctx, 6, -36 + hover, 4.2, 2.6, 0, tint, '#FFFFFF', sh(tint), 0.9);
      // Underslung blaster barrel
      drawRoundedRect(ctx, 2, -31 + hover, 12, 3.2, 0.7, '#475569', INK, 0.9);
      break;
    }

    case 'biker': {
      const wheelRot = t * 22;
      const rumble = Math.sin(t * 36) * 0.9;
      for (const wx of [-17, 17]) {
        drawInkEllipse(ctx, wx, -8, 7.5, 7.5, 0, '#0F172A', '#334155', INK, 1.2);
        drawInkEllipse(ctx, wx, -8, 4.2, 4.2, 0, '#334155', '#94A3B8', INK, 0.9);
        ctx.strokeStyle = '#39FF14';
        ctx.lineWidth = 1.1;
        ctx.beginPath();
        ctx.moveTo(wx - Math.cos(wheelRot) * 3.8, -8 - Math.sin(wheelRot) * 3.8);
        ctx.lineTo(wx + Math.cos(wheelRot) * 3.8, -8 + Math.sin(wheelRot) * 3.8);
        ctx.stroke();
      }
      // Jagged green biker fairing
      drawRoundedPoly(
        ctx,
        [
          [-18, -14 + rumble],
          [-8, -21 + rumble],
          [16, -20 + rumble],
          [22, -13 + rumble],
          [8, -10 + rumble],
          [-14, -11 + rumble],
        ],
        c('#15803D'),
        INK,
        1.25
      );
      // Raider torso & skull-visor helmet
      drawRoundedPoly(ctx, [[-8, -19 + rumble], [-3, -33 + rumble], [7, -32 + rumble], [3, -18 + rumble]], c('#1E293B'), INK, 1.2);
      drawInkEllipse(ctx, 2, -39 + rumble, 5.4, 5.6, 0.1, '#283445', '#64748B', INK, 1.2);
      drawRoundedRect(ctx, 1, -41 + rumble, 6.2, 2.8, 0.8, '#39FF14', INK, 0.8);
      drawRoundedRect(ctx, 5, -28 + rumble, 13, 3.8, 0.8, '#475569', INK, 1.0);
      break;
    }

    case 'beer_truck': {
      const rb = Math.sin(t * 28) * 1.0;
      const wheelRot = t * 18;
      // Armored pressurized glass-green cistern trailer
      drawRoundedRect(ctx, -40, -44 + rb, 54, 32, 5, c('#14532D'), INK, 1.35);
      drawRoundedRect(ctx, -35, -38 + rb, 44, 17, 3, '#052E16', INK, 1.0);
      ctx.fillStyle = '#39FF14';
      ctx.fillRect(-33, -32 + rb, 40, 9);
      // Armored steel cab
      drawRoundedPoly(
        ctx,
        [
          [14, -12 + rb],
          [14, -36 + rb],
          [32, -35 + rb],
          [39, -24 + rb],
          [39, -12 + rb],
        ],
        c('#1E293B'),
        INK,
        1.3
      );
      drawRoundedPoly(ctx, [[22, -32 + rb], [31, -32 + rb], [36, -24 + rb], [22, -24 + rb]], '#00E5FF', INK, 1.0);
      // Heavy rotating rubber tires
      for (const wx of [-26, 22]) {
        drawInkEllipse(ctx, wx, -9, 9.5, 9.5, 0, '#0F172A', '#334155', INK, 1.3);
        drawInkEllipse(ctx, wx, -9, 5.0, 5.0, 0, '#475569', '#94A3B8', INK, 1.0);
        ctx.fillStyle = '#FACC15';
        ctx.fillRect(wx + Math.cos(wheelRot) * 2.5 - 1, -9 + Math.sin(wheelRot) * 2.5 - 1, 2.2, 2.2);
      }
      break;
    }

    case 'elite': {
      // Level 5 Director's sleek cyber-assassin exo-commando!
      const hipY = -20 + bob;
      drawTaperedLimb(ctx, -3, hipY, -5 - s * 5, -9, 3.2, 2.5, sh('#18181B'), '#3F3F46', INK, 1.15);
      drawTaperedLimb(ctx, -5 - s * 5, -9, -5 - s * 6, 0, 2.5, 2.4, '#09090B', '#3F3F46', INK, 1.15);
      drawTaperedLimb(ctx, 3, hipY, 5 + s * 5, -9, 3.2, 2.5, c('#27272A'), '#52525B', INK, 1.15);
      drawTaperedLimb(ctx, 5 + s * 5, -9, 5 + s * 6, 0, 2.5, 2.4, '#111118', '#52525B', INK, 1.15);

      // Sharp V-armored indigo/obsidian exo-chest
      drawRoundedPoly(
        ctx,
        [
          [-7.5, hipY + 1],
          [7.5, hipY + 1],
          [11, hipY - 18],
          [6, hipY - 21],
          [-6, hipY - 21],
          [-11, hipY - 18],
        ],
        c('#2E1065'),
        INK,
        1.25
      );
      drawRoundedPoly(ctx, [[-5, hipY - 15], [6, hipY - 15], [4, hipY - 9], [-4, hipY - 9]], '#FF2A85', INK, 0.9);
      // Angular cyber-skull visor helmet
      drawRoundedPoly(
        ctx,
        [
          [-6, hipY - 21],
          [-7, hipY - 30],
          [0, hipY - 33],
          [7, hipY - 30],
          [6.5, hipY - 21],
        ],
        c('#0F172A'),
        INK,
        1.2
      );
      drawRoundedRect(ctx, -1, hipY - 29, 8.2, 3.0, 0.8, '#FF2A85', '#FFFFFF', 0.6);
      // Twin-rail smart rifle
      drawTaperedLimb(ctx, -1, hipY - 15, 8, hipY - 11, 2.8, 2.2, '#312E81', '#818CF8', INK, 1.1);
      drawRoundedRect(ctx, 5, hipY - 14, 18, 5.2, 1.0, '#1E293B', INK, 1.1);
      ctx.fillStyle = '#FF2A85';
      ctx.fillRect(10, hipY - 12.2, 12, 1.8);
      break;
    }

    case 'acid_punk': {
      // Street Fighter / Final Fight style Acid Punk with tall colorful neon Mohawk (walks in pairs!)
      const vIdx = Math.abs(e.variant ?? 0) % 3;
      const mohawkColors = ['#FF2A85', '#39FF14', '#A855F7'];
      const mohawkTips = ['#00E5FF', '#FACC15', '#FB923C'];
      const vestColors = ['#18181B', '#1E1B4B', '#27132A'];
      const pantsColors = ['#0F766E', '#7E22CE', '#BE123C'];
      const mohawkMain = mohawkColors[vIdx];
      const mohawkTip = mohawkTips[vIdx];
      const hipY = -19 + bob;

      // Agile combat-booted punk legs with neon knee patches
      drawTaperedLimb(ctx, -3, hipY, -6 - s * 6, -9, 3.2, 2.6, sh(pantsColors[vIdx]), '#FFFFFF', INK, 1.15);
      drawTaperedLimb(ctx, -6 - s * 6, -9, -6 - s * 7, 0, 2.6, 2.8, '#09090B', '#52525B', INK, 1.15);
      drawTaperedLimb(ctx, 3, hipY, 6 + s * 6, -9, 3.2, 2.6, c(pantsColors[vIdx]), '#F8FAFC', INK, 1.15);
      drawTaperedLimb(ctx, 6 + s * 6, -9, 6 + s * 7, 0, 2.6, 2.8, '#111827', '#64748B', INK, 1.15);
      // Studded punk belt
      px(ctx, -6, hipY - 1, 12, 2.5, '#090C11');
      px(ctx, -4, hipY - 0.5, 2, 1.5, '#FACC15');
      px(ctx, 2, hipY - 0.5, 2, 1.5, '#FACC15');

      // Spiked sleeveless leather punk vest + glowing torn neon shirt
      drawRoundedPoly(
        ctx,
        [
          [-7, hipY],
          [7, hipY],
          [9.5, hipY - 16],
          [5, hipY - 19],
          [-5, hipY - 19],
          [-9.5, hipY - 16],
        ],
        c(vestColors[vIdx]),
        INK,
        1.25
      );
      // Exposed neon-splattered shirt chest & chrome shoulder spikes
      px(ctx, -2.5, hipY - 16, 5, 13, c(mohawkTip));
      drawRoundedPoly(ctx, [[-9.5, hipY - 16], [-12.5, hipY - 19], [-7.5, hipY - 19]], '#E2E8F0', INK, 0.8);
      drawRoundedPoly(ctx, [[9.5, hipY - 16], [12.5, hipY - 19], [7.5, hipY - 19]], '#E2E8F0', INK, 0.8);

      // Head with aggressive Street Fighter jawline + cyber punk shades
      drawInkEllipse(ctx, 0.5, hipY - 24, 5.4, 5.8, 0, c('#E8B496'), '#FDE68A', INK, 1.15);
      // Neon punk mirror visor / shades
      drawRoundedRect(ctx, -1, hipY - 26.5, 7.2, 2.8, 0.7, '#090C11', mohawkTip, 0.7);
      px(ctx, 0.5, hipY - 25.8, 4.5, 1.1, mohawkTip);

      // MASSIVE ICONIC COLORFUL SPIKED MOHAWK (4 jagged tall spikes!)
      drawRoundedPoly(
        ctx,
        [
          [-6, hipY - 27],
          [-9, hipY - 35],
          [-3, hipY - 31],
          [-2, hipY - 41],
          [2.5, hipY - 32],
          [6.5, hipY - 40],
          [6, hipY - 30],
          [9.5, hipY - 34],
          [5.5, hipY - 26],
        ],
        c(mohawkMain),
        INK,
        1.15
      );
      // Bright contrasting Mohawk tips
      px(ctx, -8, hipY - 34, 2.5, 2.5, mohawkTip);
      px(ctx, -2, hipY - 39.5, 2.5, 3, mohawkTip);
      px(ctx, 5.2, hipY - 38.5, 2.5, 3, mohawkTip);

      // Forward brawling arm holding glowing acid bottle / spiked club
      const swing = e.telegraphTimer > 0 ? -7 : Math.sin(t * 11) * 2.5;
      drawTaperedLimb(ctx, 2, hipY - 14, 10, hipY - 9 + swing, 2.8, 2.3, c('#E8B496'), '#FDE68A', INK, 1.1);
      // Studded leather wristband
      px(ctx, 7.5, hipY - 11 + swing, 3.5, 3, '#090C11');
      // Glowing green acid molotov bottle
      drawRoundedRect(ctx, 9.5, hipY - 16 + swing, 5.5, 9, 1.5, '#39FF14', INK, 1.0);
      px(ctx, 11, hipY - 19 + swing, 2.5, 3.5, '#FFB000');
      break;
    }

    case 'boss_elevator': {
      // LEVEL 5 BOSS: «МЕХА-ЛИФТЁР ГИДРАВЛИК-99» — Towering industrial yellow-black hydraulic exo-loader mech!
      const hipY = -28 + bob;
      const slamArm = e.telegraphTimer > 0 ? -12 : Math.sin(t * 5.2) * 3.5;

      if (rage) {
        ctx.fillStyle = `rgba(0, 229, 255, ${0.14 + pulse * 0.14})`;
        ctx.beginPath();
        ctx.ellipse(0, -46, 46, 48, 0, 0, Math.PI * 2);
        ctx.fill();
      }

      // Massive armored piston walker legs
      drawTaperedLimb(ctx, -12, hipY, -16 - s * 6, -12, 8.2, 6.8, '#1E293B', '#64748B', INK, 1.6);
      drawTaperedLimb(ctx, -16 - s * 6, -12, -16 - s * 7, 0, 7.2, 8.8, '#FACC15', '#FEF08A', INK, 1.6);
      drawTaperedLimb(ctx, 12, hipY, 16 + s * 6, -12, 8.2, 6.8, '#334155', '#94A3B8', INK, 1.6);
      drawTaperedLimb(ctx, 16 + s * 6, -12, 16 + s * 7, 0, 7.2, 8.8, '#EAB308', '#FEF08A', INK, 1.6);

      // Heavy industrial caterpillar-yellow exo-chassis with black hazard stripes
      drawRoundedPoly(
        ctx,
        [
          [-24, hipY + 3],
          [24, hipY + 3],
          [30, hipY - 30],
          [20, hipY - 46],
          [-20, hipY - 46],
          [-30, hipY - 30],
        ],
        c('#EAB308'),
        INK,
        1.7
      );
      // Armored chest plate & hazard chevrons
      drawRoundedRect(ctx, -18, hipY - 36, 36, 26, 2.5, '#1E293B', INK, 1.4);
      for (let st = -14; st <= 10; st += 8) {
        px(ctx, st, hipY - 12, 4, 7, '#FACC15');
        px(ctx, st + 4, hipY - 12, 4, 7, '#090C11');
      }
      // Pulsing glowing reactor core in chest
      const coreCol = rage ? '#FF2A85' : '#00E5FF';
      drawInkEllipse(ctx, 0, hipY - 23, 8.5, 8.5, 0, coreCol, '#FFFFFF', INK, 1.3);

      // Shoulder exhaust smokestacks & warning beacon dome
      box(ctx, -26, hipY - 58, 9, 18, '#334155', '#94A3B8', INK);
      box(ctx, 17, hipY - 58, 9, 18, '#334155', '#94A3B8', INK);
      drawInkEllipse(ctx, 0, hipY - 50, 9, 6, 0, '#0F172A', '#334155', INK, 1.3);
      // Glowing cyclops optical scanner eye
      drawRoundedRect(ctx, -5, hipY - 52, 13, 4.2, 1.0, rage ? '#FF2A85' : '#39FF14', '#FFFFFF', 0.8);

      // Massive twin hydraulic crusher clamp arms!
      drawTaperedLimb(ctx, -18, hipY - 32, -26, hipY - 12 + slamArm, 6.2, 5.2, '#475569', '#CBD5E1', INK, 1.5);
      drawRoundedRect(ctx, -33, hipY - 14 + slamArm, 14, 14, 2, '#FACC15', INK, 1.4);
      drawTaperedLimb(ctx, 18, hipY - 32, 28, hipY - 10 + slamArm, 6.4, 5.4, '#475569', '#CBD5E1', INK, 1.5);
      // Front power-claw pincers
      drawRoundedPoly(
        ctx,
        [
          [24, hipY - 16 + slamArm],
          [42, hipY - 18 + slamArm],
          [45, hipY - 10 + slamArm],
          [34, hipY - 10 + slamArm],
          [34, hipY - 4 + slamArm],
          [45, hipY - 4 + slamArm],
          [42, hipY + 4 + slamArm],
          [24, hipY + 2 + slamArm],
        ],
        c('#FACC15'),
        INK,
        1.5
      );
      break;
    }

    // ==================== NIGHTMARE CONTRA HARD CORPS BOSSES ====================

    case 'boss_drunk': {
      // LEVEL 1 BOSS: «ВЕРХОВНЫЙ ЗАБУЛДЫГА» — Towering 84px grotesque mutated PIZED-77 bio-horror!
      const breathe = Math.sin(t * (rage ? 8 : 4.2)) * 2.2;
      const slam = e.telegraphTimer > 0 ? -1.15 : Math.sin(t * 4.5) * 0.2;
      const hipY = -24 + bob;

      // Radioactive Phase 2 aura
      if (rage) {
        ctx.fillStyle = `rgba(57, 255, 20, ${0.14 + pulse * 0.14})`;
        ctx.beginPath();
        ctx.ellipse(0, -42, 42, 46, 0, 0, Math.PI * 2);
        ctx.fill();
      }

      // Colossal mutated articulated legs & tattered heavy stompers
      drawTaperedLimb(ctx, -10, hipY, -13 - s * 6, -11, 7.5, 6.2, sh('#1E293B'), '#475569', INK, 1.5);
      drawTaperedLimb(ctx, -13 - s * 6, -11, -14 - s * 7, 0, 6.2, 7.2, '#0F172A', '#334155', INK, 1.5);
      drawTaperedLimb(ctx, 10, hipY, 13 + s * 6, -11, 7.8, 6.4, c('#263242'), '#64748B', INK, 1.5);
      drawTaperedLimb(ctx, 13 + s * 6, -11, 14 + s * 7, 0, 6.4, 7.4, '#111827', '#475569', INK, 1.5);

      // Enormous hunched mutated torso with exposed pulsing green tumor belly & rib scars!
      drawRoundedPoly(
        ctx,
        [
          [-21, hipY + 2],
          [21, hipY + 2],
          [28, hipY - 26],
          [18, hipY - 38],
          [-18, hipY - 38],
          [-28, hipY - 24],
        ],
        c('#365314'),
        INK,
        1.6
      );
      // Shredded biker leather jacket halves barely containing the mutant bulk
      drawRoundedPoly(ctx, [[-27, hipY - 24], [-13, hipY - 36], [-11, hipY - 4], [-23, hipY - 2]], c('#1F242D'), INK, 1.4);
      drawRoundedPoly(ctx, [[27, hipY - 26], [13, hipY - 36], [12, hipY - 4], [22, hipY - 2]], c('#1F242D'), INK, 1.4);

      // Swollen translucent glowing radioactive PIZED-77 gut with pulsing veins & exposed ribs!
      const gutCol = rage ? '#39FF14' : '#84CC16';
      drawInkEllipse(ctx, 0, hipY - 15 + breathe * 0.4, 15.5, 14.5 + breathe * 0.3, 0, gutCol, '#ECFCCB', '#15803D', 1.4);
      // Exposed dark jagged ribs & radioactive cracks across swollen belly
      ctx.strokeStyle = '#052E16';
      ctx.lineWidth = 1.6;
      for (const ry of [-22, -17, -12]) {
        ctx.beginPath();
        ctx.moveTo(-11, hipY + ry);
        ctx.quadraticCurveTo(0, hipY + ry + 3, 11, hipY + ry);
        ctx.stroke();
      }

      // Crushed rusted green-beer keg fused into his left shoulder with leaking toxic tubes!
      ctx.save();
      ctx.translate(-22, hipY - 34);
      ctx.rotate(-0.3);
      drawRoundedRect(ctx, -10, -14, 18, 24, 4, '#475569', INK, 1.4);
      ctx.fillStyle = '#39FF14';
      ctx.fillRect(-8, -5, 14, 7);
      ctx.restore();
      // Glowing viral hose feeding from keg into monster neck!
      ctx.strokeStyle = '#39FF14';
      ctx.lineWidth = 2.6;
      ctx.beginPath();
      ctx.moveTo(-16, hipY - 44);
      ctx.quadraticCurveTo(-8, hipY - 56, -2, hipY - 45);
      ctx.stroke();

      // Nightmarish mutated head: elongated snarling jaw, jagged teeth, 3 crimson rage eyes!
      const hy = hipY - 44 + breathe * 0.3;
      drawInkEllipse(ctx, 2, hy, 12.5, 11.5, 0.1, c('#65A30D'), '#BEF264', '#365314', 1.5);
      // Shredded wild hair spikes
      drawRoundedPoly(ctx, [[-9, hy - 7], [-5, hy - 16], [1, hy - 12], [6, hy - 17], [11, hy - 8]], '#1C1917', INK, 1.2);
      // 3 asymmetrical glowing crimson rage eyes
      drawInkEllipse(ctx, 3, hy - 4, 2.8, 2.2, 0.2, '#FF2A85', '#FFFFFF', '#831843', 0.9);
      drawInkEllipse(ctx, 9, hy - 3, 2.2, 1.8, -0.2, '#FF2A85', '#FFFFFF', '#831843', 0.9);
      drawInkEllipse(ctx, 6, hy - 7.5, 1.7, 1.4, 0, '#FACC15', '#FFFFFF', '#92400E', 0.7);
      // Wide gaping monster jaw with jagged fangs & dripping neon-green acid foam!
      drawRoundedPoly(
        ctx,
        [
          [-3, hy + 2],
          [13, hy + 1],
          [12, hy + 10],
          [-2, hy + 9],
        ],
        '#052E16',
        INK,
        1.3
      );
      // Jagged white fangs
      ctx.fillStyle = '#F8FAFC';
      for (let fx = 0; fx <= 9; fx += 3) {
        ctx.beginPath();
        ctx.moveTo(fx, hy + 2);
        ctx.lineTo(fx + 1.5, hy + 5.5);
        ctx.lineTo(fx + 3, hy + 2);
        ctx.fill();
      }
      ctx.fillStyle = '#39FF14';
      ctx.fillRect(6, hy + 8, 2.5, 5 + pulse * 4); // dripping radioactive foam!

      // Colossal mutated smash arm wrapped in barbed steel chains & jagged brass spikes!
      ctx.save();
      ctx.translate(18, hipY - 28);
      ctx.rotate(slam);
      drawTaperedLimb(ctx, 0, 0, 10, 14, 7.2, 6.2, c('#65A30D'), '#D9F99D', '#365314', 1.5);
      drawTaperedLimb(ctx, 10, 14, 14, 28, 6.5, 7.6, c('#84CC16'), '#ECFCCB', '#3F6212', 1.5);
      // Massive spiked iron gauntlet + shattered glass shards
      drawInkEllipse(ctx, 15, 31, 8.8, 7.4, 0.2, '#283445', '#94A3B8', INK, 1.4);
      for (const spY of [26, 30, 34]) {
        drawRoundedPoly(ctx, [[22, spY - 1.5], [29, spY], [22, spY + 1.5]], '#FACC15', INK, 0.9);
      }
      ctx.restore();
      break;
    }

    case 'boss_buffalo': {
      // LEVEL 2 BOSS: «БУЙВОЛ-ВОЖАК» — Towering 88px cyber-minotaur warlord!
      const breathe = Math.sin(t * 5) * 1.8;
      const slam = e.telegraphTimer > 0 ? -0.95 : 0;
      const hipY = -25 + bob;

      // Armored hooved war-legs
      drawTaperedLimb(ctx, -11, hipY, -13 - s * 5.5, -12, 7.8, 6.4, sh('#292524'), '#57534E', INK, 1.5);
      drawTaperedLimb(ctx, -13 - s * 5.5, -12, -13 - s * 6, 0, 6.4, 7.6, '#141210', '#44403C', INK, 1.5);
      drawTaperedLimb(ctx, 11, hipY, 13 + s * 5.5, -12, 8.0, 6.6, c('#292524'), '#78716C', INK, 1.5);
      drawTaperedLimb(ctx, 13 + s * 5.5, -12, 13 + s * 6, 0, 6.6, 7.8, '#1C1917', '#57534E', INK, 1.5);

      // Colossal muscular chest + spiked riveted steel shoulder pauldrons
      drawRoundedPoly(
        ctx,
        [
          [-22, hipY + 2],
          [22, hipY + 2],
          [31, hipY - 28],
          [20, hipY - 40],
          [-20, hipY - 40],
          [-31, hipY - 28],
        ],
        c('#9A3412'),
        INK,
        1.6
      );
      // Heavy leather butcher apron + gold kingpin chain & skull clasp
      drawRoundedPoly(ctx, [[-15, hipY - 30], [15, hipY - 30], [18, hipY + 6], [-18, hipY + 6]], c('#14532D'), INK, 1.35);
      ctx.strokeStyle = '#FACC15';
      ctx.lineWidth = 2.6;
      ctx.beginPath();
      ctx.moveTo(-14, hipY - 32);
      ctx.quadraticCurveTo(0, hipY - 20, 14, hipY - 32);
      ctx.stroke();
      drawInkEllipse(ctx, 0, hipY - 24, 4.2, 4.5, 0, '#FACC15', '#FEF08A', '#92400E', 1.1);

      // Twin spiked titanium shoulder pauldrons
      for (const sx of [-26, 26]) {
        drawInkEllipse(ctx, sx, hipY - 34, 11, 10, sx < 0 ? -0.3 : 0.3, '#475569', '#CBD5E1', '#0F172A', 1.4);
        drawRoundedPoly(ctx, [[sx - 3, hipY - 42], [sx + (sx < 0 ? -6 : 6), hipY - 52], [sx + 3, hipY - 42]], '#E2E8F0', INK, 1.1);
      }

      // Nightmarish bull-skull cyber-helmet with ENORMOUS serrated curved steel horns!
      const hy = hipY - 46 + breathe * 0.4;
      drawInkEllipse(ctx, 1, hy, 13.5, 11.5, 0, c('#334155'), '#94A3B8', '#0F172A', 1.5);
      // Giant serrated horns sweeping high & wide!
      drawRoundedPoly(ctx, [[-9, hy - 5], [-26, hy - 14], [-30, hy - 28], [-20, hy - 22], [-15, hy - 14], [-6, hy - 9]], '#E2E8F0', INK, 1.35);
      drawRoundedPoly(ctx, [[9, hy - 5], [26, hy - 14], [30, hy - 28], [20, hy - 22], [15, hy - 14], [6, hy - 9]], '#E2E8F0', INK, 1.35);
      // Furnace-red visor eyes + iron grill muzzle + snorting steam!
      drawRoundedPoly(ctx, [[0, hy - 3], [11, hy - 5], [10, hy], [0, hy + 1]], '#FF2A85', '#FFFFFF', 0.9);
      drawRoundedRect(ctx, 2, hy + 3, 10, 6, 1.5, '#1E293B', INK, 1.0);
      // Snorting steam puff from nose vents
      ctx.fillStyle = `rgba(226, 232, 240, ${0.35 + pulse * 0.35})`;
      ctx.beginPath();
      ctx.arc(14 + pulse * 6, hy + 4 - pulse * 3, 4.5, 0, Math.PI * 2);
      ctx.fill();

      // Massive arm hoisting a glowing explosive green-beer crate!
      ctx.save();
      ctx.translate(22, hipY - 28);
      ctx.rotate(slam);
      drawTaperedLimb(ctx, 0, 0, 10, 12, 6.8, 5.8, c('#C88D6B'), '#E8B898', '#7C4B32', 1.4);
      drawRoundedRect(ctx, 4, -8, 20, 20, 2.5, '#15803D', INK, 1.4);
      drawRoundedRect(ctx, 7, -4, 14, 12, 1.2, '#052E16', '#39FF14', 0.9);
      ctx.fillStyle = '#39FF14';
      ctx.fillRect(9, 0, 10, 4);
      ctx.restore();
      break;
    }

    case 'boss_chief': {
      // LEVEL 3 BOSS: «НАЧАЛЬНИК ОХРАНЫ» — 90px Predator Exo-Juggernaut with Siege Plasma Shield!
      const hipY = -26 + bob;
      const shieldCol = e.phase >= 2 ? '#FF2A85' : '#00E5FF';

      // Heavy articulated exo-mech legs with glowing knee pistons
      drawTaperedLimb(ctx, -10, hipY, -12 - s * 5, -13, 6.8, 5.5, sh('#0F172A'), '#334155', INK, 1.5);
      drawTaperedLimb(ctx, -12 - s * 5, -13, -12 - s * 6, 0, 5.5, 6.6, '#090D14', '#475569', INK, 1.5);
      drawTaperedLimb(ctx, 10, hipY, 12 + s * 5, -13, 7.0, 5.6, c('#1E293B'), '#64748B', INK, 1.5);
      drawTaperedLimb(ctx, 12 + s * 5, -13, 12 + s * 6, 0, 5.6, 6.8, '#131B26', '#64748B', INK, 1.5);

      // Shoulder-mounted dual missile/plasma pods!
      drawRoundedRect(ctx, -31, hipY - 54, 18, 17, 2.5, '#283445', INK, 1.4);
      for (const my of [-50, -43]) {
        drawInkEllipse(ctx, -15, hipY + my, 3.0, 2.8, 0, '#FF2A85', '#FFFFFF', '#831843', 0.8);
      }

      // Angular armored war-chest with glowing corporate reactor grille
      drawRoundedPoly(
        ctx,
        [
          [-19, hipY + 2],
          [19, hipY + 2],
          [26, hipY - 28],
          [16, hipY - 38],
          [-16, hipY - 38],
          [-26, hipY - 28],
        ],
        c('#1E293B'),
        INK,
        1.6
      );
      drawRoundedPoly(ctx, [[-12, hipY - 30], [13, hipY - 30], [10, hipY - 12], [-9, hipY - 12]], '#0C4A6E', INK, 1.2);
      ctx.fillStyle = shieldCol;
      ctx.fillRect(-7, hipY - 25, 14, 3);
      ctx.fillRect(-5, hipY - 19, 10, 3);

      // Skull-shaped cybernetic command helmet with sweeping crimson cyclops laser eye!
      const hy = hipY - 45;
      drawRoundedPoly(
        ctx,
        [
          [-11, hy + 8],
          [-13, hy - 6],
          [-4, hy - 13],
          [8, hy - 12],
          [13, hy - 3],
          [10, hy + 8],
        ],
        c('#334155'),
        INK,
        1.5
      );
      drawRoundedRect(ctx, -3, hy - 5, 15, 5.2, 1.2, '#090C11', INK, 1.0);
      const scanX = 4 + Math.sin(t * 7) * 4.5;
      drawInkEllipse(ctx, scanX, hy - 2.4, 3.4, 2.0, 0, '#FF2A85', '#FFFFFF', '#9D174D', 0);

      // Colossal spiked electro-plasma riot shield with crackling energy!
      drawRoundedPoly(
        ctx,
        [
          [15, hipY - 42],
          [28, hipY - 36],
          [30, hipY + 22],
          [17, hipY + 26],
        ],
        '#17202D',
        INK,
        1.6
      );
      drawRoundedPoly(
        ctx,
        [
          [19, hipY - 34],
          [26, hipY - 30],
          [27, hipY + 16],
          [20, hipY + 19],
        ],
        shieldCol,
        '#FFFFFF',
        1.0
      );
      // Razor ram spikes along shield front
      for (const sy of [-26, -8, 10]) {
        drawRoundedPoly(ctx, [[28, hipY + sy - 3], [35, hipY + sy], [28, hipY + sy + 3]], '#CBD5E1', INK, 1.0);
      }
      break;
    }

    case 'boss_caravan': {
      // LEVEL 4 BOSS: «БРОНЕКАРАВАН «ЗЕЛЁНЫЙ ПОТОК»» — 136px Mad-Max cyberpunk highway dreadnought!
      const rb = Math.sin(t * 32) * 1.1;
      const wheelRot = t * 22;

      // Twin roaring vertical exhaust stacks belching toxic flame & dark smoke
      for (const sx of [16, 22]) {
        drawRoundedRect(ctx, sx, -74 + rb, 5, 28, 1, '#334155', INK, 1.2);
        drawInkEllipse(ctx, sx + 2.5, -78 + rb - pulse * 5, 5.5, 4.5, 0, '#FF2A85', '#FEF08A', '#7F1D1D', 0);
      }

      // Massive reinforced fermentation war-cistern with glowing glass ribcage & floating viral skulls!
      drawRoundedRect(ctx, -68, -68 + rb, 88, 50, 7, c('#14532D'), INK, 1.6);
      drawRoundedRect(ctx, -62, -60 + rb, 76, 27, 4, '#052E16', INK, 1.2);
      ctx.fillStyle = '#39FF14';
      ctx.fillRect(-60, -51 + rb, 72, 16);
      // Glowing bubbles & armored tank ribs
      for (let b = 0; b < 5; b++) {
        const bx = -52 + b * 15;
        const by = -38 - ((t * 26 + b * 7) % 16);
        drawInkEllipse(ctx, bx, by + rb, 3.2, 3.2, 0, '#D9F99D', '#FFFFFF', '#15803D', 0.7);
      }
      for (let rx = -48; rx <= 2; rx += 16) {
        drawRoundedRect(ctx, rx, -66 + rb, 4, 46, 1, '#334155', INK, 0.9);
      }
      // Hazard chevrons along armored skirt
      for (let hx = -64; hx < 16; hx += 12) {
        ctx.fillStyle = '#FACC15';
        ctx.fillRect(hx, -24 + rb, 6, 5);
        ctx.fillStyle = INK;
        ctx.fillRect(hx + 6, -24 + rb, 6, 5);
      }

      // Terrifying armored cab with demonic crimson glowing windshield & razor-toothed ram plow!
      drawRoundedPoly(
        ctx,
        [
          [20, -16 + rb],
          [20, -56 + rb],
          [44, -54 + rb],
          [56, -38 + rb],
          [56, -16 + rb],
        ],
        c('#1E293B'),
        INK,
        1.6
      );
      drawRoundedPoly(ctx, [[32, -49 + rb], [44, -49 + rb], [52, -38 + rb], [32, -38 + rb]], '#FF2A85', '#FFFFFF', 1.1);
      // Spiked steel cowcatcher ram plow!
      drawRoundedPoly(ctx, [[54, -36 + rb], [68, -16 + rb], [54, -16 + rb]], '#475569', INK, 1.4);
      for (const py of [-31, -24, -18]) {
        drawRoundedPoly(ctx, [[58, py - 2], [67, py], [58, py + 2]], '#E2E8F0', INK, 0.9);
      }

      // Roof-mounted twin-barrel rail-autocannon turret!
      drawRoundedPoly(ctx, [[-32, -68 + rb], [-26, -86 + rb], [4, -86 + rb], [10, -68 + rb]], '#283445', INK, 1.4);
      drawRoundedRect(ctx, -56, -82 + rb, 30, 5.2, 1.0, '#64748B', INK, 1.2);
      drawRoundedRect(ctx, -56, -74 + rb, 30, 5.2, 1.0, '#475569', INK, 1.2);
      drawInkEllipse(ctx, -11, -77 + rb, 6.2, 4.5, 0, e.phase >= 2 ? '#FF2A85' : '#00E5FF', '#FFFFFF', INK, 1.0);

      // 3 gigantic spiked monster tires!
      for (const wx of [-48, -14, 34]) {
        drawInkEllipse(ctx, wx, -11, 11.5, 11.5, 0, '#0F172A', '#334155', INK, 1.5);
        drawInkEllipse(ctx, wx, -11, 6.0, 6.0, 0, '#475569', '#CBD5E1', INK, 1.1);
        ctx.strokeStyle = '#FACC15';
        ctx.lineWidth = 1.6;
        for (let sp = 0; sp < 3; sp++) {
          const a = wheelRot + (sp * Math.PI) / 3;
          ctx.beginPath();
          ctx.moveTo(wx - Math.cos(a) * 5.2, -11 - Math.sin(a) * 5.2);
          ctx.lineTo(wx + Math.cos(a) * 5.2, -11 + Math.sin(a) * 5.2);
          ctx.stroke();
        }
      }
      break;
    }

    case 'boss_director': {
      // LEVEL 5 FINAL BOSS: «ДИРЕКТОР «ЗЕЛЁНОГО ПОТОКА» — ЭКЗО-МЕХ PIZED-77 OMEGA» (102px apocalyptic nightmare!)
      const hover = Math.sin(t * 4.2) * 4.5;
      const coreCol = e.phase >= 3 ? '#FF2A85' : '#39FF14';

      // Apocalyptic glowing energy halo behind mech in Phase 2/3!
      if (e.phase >= 2) {
        ctx.strokeStyle = e.phase >= 3 ? 'rgba(255,42,133,0.55)' : 'rgba(57,255,20,0.45)';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.arc(0, -56 + hover, 46 + pulse * 5, 0, Math.PI * 2);
        ctx.stroke();
      }

      // 4 articulated mechanical spider-injector wings flaring behind shoulders!
      for (const side of [-1, 1]) {
        for (const tier of [0, 1]) {
          const baseAng = side * (0.65 + tier * 0.45) + Math.sin(t * 5 + tier) * 0.14;
          const x1 = side * 20;
          const y1 = -62 + tier * 10 + hover;
          const x2 = x1 + Math.sin(baseAng) * 26;
          const y2 = y1 - Math.cos(baseAng) * 18;
          const x3 = x2 + side * 14;
          const y3 = y2 + (tier === 0 ? -10 : 8);
          drawTaperedLimb(ctx, x1, y1, x2, y2, 3.6, 2.6, '#334155', '#94A3B8', '#0F172A', 1.2);
          drawTaperedLimb(ctx, x2, y2, x3, y3, 2.6, 1.4, '#1E293B', coreCol, INK, 1.1);
          drawInkEllipse(ctx, x3, y3, 2.8, 2.8, 0, coreCol, '#FFFFFF', INK, 0.8);
        }
      }

      // Roaring plasma hover thrusters
      const flame = 12 + pulse * 11;
      for (const fx of [-18, 18]) {
        drawRoundedPoly(ctx, [[fx - 6, -6 + hover], [fx, -6 + flame + hover], [fx + 6, -6 + hover]], coreCol, 'transparent', 0);
        drawRoundedPoly(ctx, [[fx - 3, -6 + hover], [fx, -6 + flame * 0.55 + hover], [fx + 3, -6 + hover]], '#FFFFFF', 'transparent', 0);
      }

      // Heavy reverse-joint obsidian mech legs
      drawTaperedLimb(ctx, -16, -26 + hover, -22, -14 + hover, 6.8, 5.2, c('#1E293B'), '#64748B', INK, 1.5);
      drawTaperedLimb(ctx, -22, -14 + hover, -18, -4 + hover, 5.2, 6.2, '#0F172A', '#475569', INK, 1.5);
      drawTaperedLimb(ctx, 16, -26 + hover, 22, -14 + hover, 6.8, 5.2, c('#1E293B'), '#64748B', INK, 1.5);
      drawTaperedLimb(ctx, 22, -14 + hover, 18, -4 + hover, 5.2, 6.2, '#0F172A', '#475569', INK, 1.5);

      // Massive obsidian & gold-trimmed corporate juggernaut torso
      drawRoundedPoly(
        ctx,
        [
          [-24, -22 + hover],
          [24, -22 + hover],
          [34, -56 + hover],
          [24, -72 + hover],
          [-24, -72 + hover],
          [-34, -56 + hover],
        ],
        c('#141A24'),
        INK,
        1.7
      );
      // Gold corporate trim ribs
      ctx.strokeStyle = '#FACC15';
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(-26, -62 + hover);
      ctx.lineTo(-14, -48 + hover);
      ctx.moveTo(26, -62 + hover);
      ctx.lineTo(14, -48 + hover);
      ctx.stroke();

      // Split open beating PIZED-77 bio-reactor core!
      drawInkEllipse(ctx, 0, -47 + hover, 15.5, 13.5, 0, '#052E16', coreCol, INK, 1.4);
      drawInkEllipse(ctx, 0, -47 + hover, 10 + pulse * 2.2, 8.5 + pulse * 1.8, 0, coreCol, '#FFFFFF', sh(coreCol), 1.0);

      // Domed armored glass cockpit housing the maniacal cyber-Director!
      drawInkEllipse(ctx, 0, -82 + hover, 18, 16, 0, 'rgba(15, 23, 42, 0.92)', '#38BDF8', '#020617', 1.6);
      // Pale gaunt Director face inside cockpit
      drawInkEllipse(ctx, 0, -81 + hover, 9.5, 10.5, 0, c('#DEC2B0'), '#FDE6D2', '#8B624C', 1.1);
      // Slicked-back silver executive hair
      drawRoundedPoly(ctx, [[-10, -85 + hover], [-8, -93 + hover], [8, -93 + hover], [10, -85 + hover], [0, -88 + hover]], '#CBD5E1', INK, 1.0);
      // Glowing cybernetic executive visor glasses
      drawRoundedRect(ctx, -7.5, -84 + hover, 15, 4.2, 1.0, '#0F172A', INK, 0.9);
      ctx.fillStyle = coreCol;
      ctx.fillRect(-6, -83 + hover, 5.2, 2.2);
      ctx.fillRect(1, -83 + hover, 5.2, 2.2);
      // Psychotic wide shark-toothed grin!
      drawRoundedPoly(ctx, [[-5, -75 + hover], [5, -75 + hover], [4, -72 + hover], [-4, -72 + hover]], '#FFFFFF', INK, 0.8);
      // Glass dome specular gleam
      ctx.strokeStyle = 'rgba(186, 230, 253, 0.65)';
      ctx.lineWidth = 2.0;
      ctx.beginPath();
      ctx.arc(0, -82 + hover, 14.5, -2.5, -1.7);
      ctx.stroke();

      // Twin colossal forearm viral plasma laser cannons!
      for (const cx of [-34, 34]) {
        drawRoundedRect(ctx, cx - 7, -68 + hover, 14, 34, 3, '#283445', INK, 1.45);
        drawRoundedRect(ctx, cx - 4.5, -62 + hover, 9, 18, 1.5, '#0F172A', coreCol, 0.9);
        drawInkEllipse(ctx, cx, -32 + hover, 6.2, 5.2, 0, coreCol, '#FFFFFF', sh(coreCol), 1.0);
      }
      break;
    }
  }

  // Boss Phase 2/3 damaged sparks & crackling arcs
  if (isBoss && e.phase >= 2) {
    const sp = Math.floor(t * 16) % 3;
    drawInkEllipse(ctx, -14 + sp * 11, -50 - sp * 5, 3.2, 3.2, 0, '#FFB000', '#FFFFFF', '#B45309', 0);
  }

  // Status overlays (Stun lightning / Domna burn flames)
  if (e.stunTimer > 0) {
    ctx.strokeStyle = '#00E5FF';
    ctx.lineWidth = 2;
    const j = Math.sin(t * 42) * 5;
    ctx.beginPath();
    ctx.moveTo(-12, -30 + j);
    ctx.lineTo(0, -38 - j);
    ctx.lineTo(12, -28 + j);
    ctx.stroke();
  }
  if (e.burnTimer > 0) {
    const f = Math.sin(t * 24) * 3;
    drawInkEllipse(ctx, f, -34, 5.5, 8.5, 0.1, '#F97316', '#FEF08A', '#DC2626', 0);
  }

  // Crisp HP bar on damaged regular enemies
  if (!isBoss && e.hpRatio < 1 && e.hpRatio > 0) {
    ctx.scale(e.facing, 1);
    drawRoundedRect(ctx, -13, -55, 26, 4.2, 1, INK, INK, 0.5);
    ctx.fillStyle = e.hacked ? '#00E5FF' : '#39FF14';
    ctx.fillRect(-12, -54, Math.max(1.5, 24 * e.hpRatio), 2.2);
  }

  ctx.restore();
}

function drawCyberSkyline(
  ctx: CanvasRenderingContext2D,
  level: LevelDef,
  camX: number,
  time: number,
  speedOverride?: number
): void {
  // Layer 1: Deep cyberpunk night gradient + toxic atmospheric smog glow
  const grad = ctx.createLinearGradient(0, 0, 0, FLOOR_MIN_Y);
  grad.addColorStop(0, level.skyTop);
  grad.addColorStop(0.68, level.skyBottom);
  grad.addColorStop(1, level.id === 4 ? '#2C1248' : level.id === 2 ? '#2B112B' : '#0E2424');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, VIRTUAL_W, FLOOR_MIN_Y);

  // Giant neon smog moon / megacorp orbital glow
  const moonX = VIRTUAL_W - 88 - ((camX * 0.025) % 40);
  const moonGrad = ctx.createRadialGradient(moonX, 34, 4, moonX, 34, 48);
  moonGrad.addColorStop(0, level.id === 4 ? 'rgba(255,42,133,0.38)' : 'rgba(57,255,20,0.28)');
  moonGrad.addColorStop(0.5, 'rgba(0,229,255,0.09)');
  moonGrad.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = moonGrad;
  ctx.beginPath();
  ctx.arc(moonX, 34, 48, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = level.id === 4 ? '#FFD1E8' : '#D9F99D';
  ctx.beginPath();
  ctx.arc(moonX, 34, 11, 0, Math.PI * 2);
  ctx.fill();

  // Drifting cyber-smog cloud ribbons
  const cloudScroll = Math.floor((speedOverride ?? camX * 0.09) + time * 6);
  for (let i = -1; i < 7; i++) {
    const cx = i * 96 - (cloudScroll % 96);
    px(ctx, cx, 14 + (i % 2) * 10, 74, 8, 'rgba(255,255,255,0.04)');
    px(ctx, cx + 18, 10 + (i % 2) * 10, 44, 5, level.id === 4 ? 'rgba(255,42,133,0.07)' : 'rgba(57,255,20,0.06)');
  }

  // Flying cyber-spinner traffic streaks in distant sky
  for (let s = 0; s < 5; s++) {
    const dir = s % 2 === 0 ? 1 : -1;
    const sp = 28 + s * 14;
    const sx = dir > 0
      ? ((time * sp + s * 113) % (VIRTUAL_W + 60)) - 30
      : VIRTUAL_W + 30 - ((time * sp + s * 89) % (VIRTUAL_W + 60));
    const sy = 22 + s * 11;
    px(ctx, sx, sy, 8, 1.5, dir > 0 ? '#00E5FF' : '#FF2A85');
    px(ctx, sx - dir * 7, sy, 7, 1, dir > 0 ? 'rgba(0,229,255,0.35)' : 'rgba(255,42,133,0.35)');
  }

  // Layer 2: Varied Cyberpunk Arcology Skyline (indexed by world slot, non-repeating silhouettes)
  const farScroll = Math.floor(speedOverride !== undefined ? speedOverride * 0.32 : camX * 0.22);
  const farW = 54;
  const startFar = Math.floor(farScroll / farW) - 1;
  for (let k = 0; k < 12; k++) {
    const wIdx = startFar + k;
    const bx = wIdx * farW - farScroll;
    const hash = Math.abs((wIdx * 73 + level.id * 19) % 17);
    const bh = 50 + (hash % 7) * 10;
    const bw = 42 + (hash % 3) * 5;
    const topY = FLOOR_MIN_Y - bh - 12;
    const archType = Math.abs(wIdx) % 5;

    // Tower body
    ctx.fillStyle = archType === 2 ? '#101526' : '#0B101B';
    if (archType === 1) {
      // Brutalist cyberpunk pyramid arcology (Blade Runner style)
      ctx.beginPath();
      ctx.moveTo(bx - 4, FLOOR_MIN_Y);
      ctx.lineTo(bx + 10, topY + 6);
      ctx.lineTo(bx + bw - 10, topY + 6);
      ctx.lineTo(bx + bw + 4, FLOOR_MIN_Y);
      ctx.closePath();
      ctx.fill();
      px(ctx, bx + 11, topY + 6, bw - 22, 2, '#39FF14');
    } else {
      px(ctx, bx, topY, bw, bh + 12, archType === 3 ? '#0E1624' : '#0B101B');
      px(ctx, bx + 1, topY, bw - 2, 2, archType === 0 ? '#334155' : '#1E293B');
    }

    // Rooftop spires, antennas, dish or holographic megacorp logo
    if (archType === 0) {
      px(ctx, bx + bw / 2 - 1, topY - 22, 2, 22, '#334155');
      if (Math.floor(time * 2.5 + wIdx) % 2 === 0) {
        px(ctx, bx + bw / 2 - 2, topY - 24, 4, 3, '#FF2A85');
      }
    } else if (archType === 2) {
      // Glowing vertical neon strip along skyscraper edge
      const stripCol = wIdx % 2 === 0 ? '#00E5FF' : '#FF2A85';
      px(ctx, bx + 4, topY + 8, 2, bh - 16, stripCol);
      px(ctx, bx + bw - 6, topY + 14, 2, bh - 24, 'rgba(57,255,20,0.45)');
    } else if (archType === 4) {
      // Giant floating sky-hologram sign above tower
      const pulse = 0.55 + Math.sin(time * 4 + wIdx) * 0.25;
      ctx.fillStyle = `rgba(57, 255, 20, ${0.14 * pulse})`;
      ctx.fillRect(bx + 4, topY - 18, 34, 14);
      ctx.strokeStyle = `rgba(57, 255, 20, ${0.55 * pulse})`;
      ctx.lineWidth = 1;
      ctx.strokeRect(bx + 4, topY - 18, 34, 14);
      ctx.fillStyle = `rgba(187, 247, 208, ${0.8 * pulse})`;
      ctx.font = 'bold 5px monospace';
      ctx.fillText(wIdx % 2 === 0 ? 'PIZED' : 'BEER77', bx + 7, topY - 9);
    }

    // Lit cyber-tower windows
    for (let wy = topY + 8; wy < FLOOR_MIN_Y - 22; wy += 8) {
      for (let wxOff = 6; wxOff < bw - 10; wxOff += 11) {
        if ((wIdx + wy + wxOff) % 5 !== 0) {
          const wCol =
            (wIdx + wy) % 7 === 0
              ? '#FF2A85'
              : (wIdx + wxOff) % 4 === 0
                ? '#00E5FF'
                : level.id === 6
                  ? '#15803D'
                  : '#1F3A3D';
          px(ctx, bx + wxOff, wy, 5, 2.5, wCol);
        }
      }
    }
  }

  // Distant elevated cyberpunk monorail zipping behind the midground
  if (level.id === 1 || level.id === 2 || level.id === 4) {
    const trackY = FLOOR_MIN_Y - 36;
    px(ctx, 0, trackY, VIRTUAL_W, 3, '#172033');
    px(ctx, 0, trackY + 3, VIRTUAL_W, 1, '#00E5FF');
    const trainX = ((time * 135) % (VIRTUAL_W + 260)) - 130;
    px(ctx, trainX, trackY - 7, 74, 7, '#0F172A');
    px(ctx, trainX + 2, trackY - 5, 70, 2, '#00E5FF');
    px(ctx, trainX + 70, trackY - 5, 4, 3, '#FF2A85');
  }
}

export function drawLevelBackground(
  ctx: CanvasRenderingContext2D,
  level: LevelDef,
  camX: number,
  time: number,
  elevatorFloor = 1
): void {
  const midScroll = Math.floor(camX * 0.65);

  // =========================================================================
  // LEVEL 5: HIGH-SPEED VERTICAL FREIGHT ELEVATOR TO DIRECTOR'S PENTHOUSE!
  // =========================================================================
  if (level.mode === 'elevator') {
    const vScroll = time * 190; // Rapid downward shaft parallax = ascending high speed!

    // Deep night cyberpunk sky seen through panoramic elevator glass bay
    const skyG = ctx.createLinearGradient(0, 0, 0, FLOOR_MIN_Y);
    skyG.addColorStop(0, '#040712');
    skyG.addColorStop(0.55, '#0F172E');
    skyG.addColorStop(1, '#1B2D3E');
    ctx.fillStyle = skyG;
    ctx.fillRect(0, 0, VIRTUAL_W, FLOOR_MIN_Y + 6);

    // Distant megacity neon towers rushing downward as elevator climbs!
    const cityScroll = (vScroll * 0.14) % 90;
    for (let i = 0; i < 8; i++) {
      const bx = 78 + i * 44;
      const bh = 90 + ((i * 29) % 55);
      px(ctx, bx, FLOOR_MIN_Y - bh + cityScroll * 0.35, 34, bh, '#0B1221');
      for (let wy = 14; wy < bh - 8; wy += 9) {
        const lit = (i + wy) % 3 !== 0;
        if (lit) {
          px(
            ctx,
            bx + 5,
            FLOOR_MIN_Y - bh + wy + cityScroll * 0.35,
            22,
            2.5,
            (i + wy) % 5 === 0 ? '#FF2A85' : '#00E5FF'
          );
        }
      }
    }

    // Left & Right Concrete/Steel Elevator Shaft Walls scrolling rapidly DOWNWARD
    px(ctx, 0, 0, 68, FLOOR_MIN_Y, '#0E1520');
    px(ctx, VIRTUAL_W - 68, 0, 68, FLOOR_MIN_Y, '#0E1520');

    // Repeating horizontal structural shaft girders + passing illuminated floor markers!
    const beamGap = 54;
    const beamOffset = Math.floor(vScroll) % beamGap;
    for (let y = -beamGap + beamOffset; y < FLOOR_MIN_Y + 12; y += beamGap) {
      // Heavy shaft steel crossbeams behind glass
      px(ctx, 68, y, VIRTUAL_W - 136, 7, 'rgba(15, 23, 42, 0.78)');
      px(ctx, 68, y + 6, VIRTUAL_W - 136, 1.5, 'rgba(0, 229, 255, 0.32)');

      // Left & right shaft wall structural ribs + neon floor strips
      box(ctx, 4, y, 58, 12, '#1E293B', '#475569', INK);
      box(ctx, VIRTUAL_W - 62, y, 58, 12, '#1E293B', '#475569', INK);
      px(ctx, 10, y + 4, 18, 3, '#39FF14');
      px(ctx, VIRTUAL_W - 28, y + 4, 18, 3, '#FF2A85');

      // Passing floor numbers on shaft concrete pillars
      const markerFl = Math.max(1, Math.min(88, Math.round(elevatorFloor) + Math.floor((FLOOR_MIN_Y - y) / 48)));
      ctx.fillStyle = '#64748B';
      ctx.font = 'bold 7px monospace';
      ctx.fillText(`F-${markerFl.toString().padStart(2, '0')}`, 32, y + 9);
      ctx.fillText(`F-${markerFl.toString().padStart(2, '0')}`, VIRTUAL_W - 56, y + 9);
    }

    // Heavy vertical guide rails & rushing tensioned lift cables
    for (const rx of [62, 74, VIRTUAL_W - 76, VIRTUAL_W - 64]) {
      px(ctx, rx, 0, 4, FLOOR_MIN_Y, '#334155');
      px(ctx, rx + 1, 0, 1.5, FLOOR_MIN_Y, '#94A3B8');
    }
    // Downward-streaking wind/speed lines for exhilaration
    for (let w = 0; w < 8; w++) {
      const wx = 92 + ((w * 47) % (VIRTUAL_W - 184));
      const wy = ((vScroll * 1.45 + w * 43) % (FLOOR_MIN_Y + 30)) - 20;
      px(ctx, wx, wy, 1.5, 18, 'rgba(0, 229, 255, 0.25)');
    }

    // Heavy Overhead Lift Cables bolted to Rear Guardrail
    for (const cx of [118, VIRTUAL_W - 122]) {
      px(ctx, cx, 0, 5, FLOOR_MIN_Y - 12, '#1E293B');
      px(ctx, cx + 1.5, 0, 2, FLOOR_MIN_Y - 12, '#CBD5E1');
    }

    // Rear Elevator Steel Bulkhead Guardrail + Glowing LED Floor Indicator!
    const vib = Math.sin(time * 42) * 0.6;
    box(ctx, 18, FLOOR_MIN_Y - 26 + vib, VIRTUAL_W - 36, 26, '#1E293B', '#64748B', INK);
    for (let x = 24; x < VIRTUAL_W - 32; x += 28) {
      px(ctx, x, FLOOR_MIN_Y - 22 + vib, 18, 16, '#0F172A');
      px(ctx, x + 2, FLOOR_MIN_Y - 20 + vib, 14, 2, '#334155');
    }
    // Central Digital Floor Display Panel («01F -> 88F»)
    const flStr = `${Math.max(1, Math.min(88, Math.round(elevatorFloor))).toString().padStart(2, '0')}F / 88F`;
    box(ctx, VIRTUAL_W / 2 - 48, FLOOR_MIN_Y - 32 + vib, 96, 22, '#090C11', '#00E5FF', INK);
    ctx.fillStyle = '#39FF14';
    ctx.font = 'bold 9px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(`▲ ${flStr}`, VIRTUAL_W / 2, FLOOR_MIN_Y - 18 + vib);
    ctx.textAlign = 'left';

    // Heavy Diamond-Plate Industrial Elevator Deck Floor
    px(ctx, 0, FLOOR_MIN_Y, VIRTUAL_W, VIRTUAL_H - FLOOR_MIN_Y, '#141B24');
    // Left & Right Hazard Curb Edges of the Elevator Platform
    px(ctx, 0, FLOOR_MIN_Y, 16, VIRTUAL_H - FLOOR_MIN_Y, '#05080F');
    px(ctx, VIRTUAL_W - 16, FLOOR_MIN_Y, 16, VIRTUAL_H - FLOOR_MIN_Y, '#05080F');
    for (let s = 16; s < VIRTUAL_W - 22; s += 16) {
      px(ctx, s, FLOOR_MIN_Y, 8, 6, '#FACC15');
      px(ctx, s + 8, FLOOR_MIN_Y, 8, 6, '#090C11');
      px(ctx, s, VIRTUAL_H - 8, 8, 8, '#FACC15');
      px(ctx, s + 8, VIRTUAL_H - 8, 8, 8, '#090C11');
    }
    // Diamond-plate steel deck grid & glowing central elevator logo
    for (let x = 24; x < VIRTUAL_W - 24; x += 36) {
      px(ctx, x, FLOOR_MIN_Y + 8, 2, VIRTUAL_H - FLOOR_MIN_Y - 18, '#1E293B');
    }
    for (let y = FLOOR_MIN_Y + 26; y < VIRTUAL_H - 12; y += 26) {
      px(ctx, 18, y, VIRTUAL_W - 36, 1.5, '#1E293B');
    }
    ctx.strokeStyle = 'rgba(0, 229, 255, 0.22)';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(180, FLOOR_MIN_Y + 24, 120, 44);
    ctx.fillStyle = 'rgba(0, 229, 255, 0.26)';
    ctx.font = 'bold 8px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('PIZED LIFT #01', VIRTUAL_W / 2, FLOOR_MIN_Y + 49);
    ctx.textAlign = 'left';

    drawLevelLandmarks(ctx, level, camX, time);
    return;
  }

  // =========================================================================
  // LEVEL 1: CYBERPUNK NEON STREETS, BARS, ARCADE, METRO OVERPASS & QUARANTINE
  // =========================================================================
  if (level.id === 1) {
    drawCyberSkyline(ctx, level, camX, time);

    const tileW = 132;
    const startIdx = Math.floor(midScroll / tileW) - 1;
    for (let k = 0; k < 6; k++) {
      const wIdx = startIdx + k;
      const wx = wIdx * tileW - midScroll;
      const variant = ((wIdx % 6) + 6) % 6;
      const neonBlink = Math.sin(time * 7 + wIdx * 2.3) > -0.78;

      if (variant === 0) {
        // Archetype 0: Iconic Neon Dive Bar «GREEN BEER» with holographic foam mug
        px(ctx, wx, 36, 126, FLOOR_MIN_Y - 36, '#151B28');
        px(ctx, wx + 3, 40, 120, FLOOR_MIN_Y - 42, '#1E2636');
        for (let by = 48; by < FLOOR_MIN_Y - 6; by += 10) px(ctx, wx + 4, by, 118, 1, '#121824');
        px(ctx, wx - 2, 33, 130, 5, '#334155');
        // Rooftop AC + vent pipe
        box(ctx, wx + 92, 42, 22, 14, '#334155', '#64748B', '#0F172A');
        px(ctx, wx + 96, 46, 14, 7, '#0F172A');
        // Big glowing neon sign
        box(ctx, wx + 10, 44, 74, 22, '#090C11', neonBlink ? '#39FF14' : '#1E293B', '#090C11');
        if (neonBlink) {
          ctx.fillStyle = 'rgba(57,255,20,0.16)';
          ctx.fillRect(wx + 6, 40, 82, 30);
          ctx.fillStyle = '#39FF14';
          ctx.font = 'bold 8px monospace';
          ctx.fillText('GREEN BEER', wx + 16, 58);
        }
        // Hanging holographic beer mug on bracket
        px(ctx, wx + 90, 74, 28, 2, '#64748B');
        ctx.fillStyle = 'rgba(57,255,20,0.22)';
        ctx.fillRect(wx + 94, 78, 18, 22);
        ctx.strokeStyle = '#39FF14';
        ctx.lineWidth = 1.2;
        ctx.strokeRect(wx + 94, 78, 18, 22);
        px(ctx, wx + 96, 75, 14, 4, '#ECFCCB');
        // Glowing bar doorway + smashed crates
        box(ctx, wx + 18, 96, 42, 54, '#0B1018', '#334155', INK);
        px(ctx, wx + 22, 100, 34, 24, 'rgba(57,255,20,0.2)');
        px(ctx, wx + 22, 126, 34, 2, '#39FF14');
        box(ctx, wx + 68, 132, 18, 18, '#5C3A21', '#9A6338', '#29180C');
      } else if (variant === 1) {
        // Archetype 1: Cyberpunk Arcade & Ramen Noodle Kiosk + Glowing Vending Machine
        px(ctx, wx, 42, 126, FLOOR_MIN_Y - 42, '#1A1626');
        px(ctx, wx + 4, 46, 118, FLOOR_MIN_Y - 48, '#231D33');
        // Magenta & cyan striped rain awning
        box(ctx, wx + 4, 82, 82, 14, '#831843', '#FF2A85', INK);
        for (let st = 0; st < 76; st += 14) px(ctx, wx + 8 + st, 83, 6, 12, '#0F172A');
        // Vertical glowing Japanese/Cyrillic arcade sign
        box(ctx, wx + 92, 46, 26, 62, '#090C11', '#00E5FF', INK);
        ctx.fillStyle = '#00E5FF';
        ctx.font = 'bold 7px monospace';
        ctx.fillText('КИ', wx + 99, 60);
        ctx.fillText('БЕ', wx + 99, 72);
        ctx.fillText('Р', wx + 101, 84);
        ctx.fillStyle = '#FF2A85';
        ctx.fillText('77', wx + 99, 98);
        // Arcade counter window + CRT cabinets glow
        box(ctx, wx + 10, 98, 68, 42, '#090C11', '#475569', INK);
        px(ctx, wx + 15, 106, 16, 14, 'rgba(0,229,255,0.45)');
        px(ctx, wx + 36, 106, 16, 14, 'rgba(255,42,133,0.45)');
        px(ctx, wx + 56, 106, 16, 14, 'rgba(57,255,20,0.45)');
        // Glowing street vending machine
        box(ctx, wx + 88, 114, 28, 36, '#1E293B', '#38BDF8', INK);
        px(ctx, wx + 92, 118, 20, 16, '#0F172A');
        for (let r = 0; r < 3; r++) {
          px(ctx, wx + 94, 120 + r * 4, 16, 2, r === 1 ? '#39FF14' : '#FF2A85');
        }
        px(ctx, wx + 95, 138, 14, 6, '#090C11');
      } else if (variant === 2) {
        // Archetype 2: Cyber-Metro Concrete Overpass Pillar + ALUPKA ROCK Poster + Steam Vent
        px(ctx, wx, 26, 132, 20, '#1E293B');
        px(ctx, wx, 46, 132, 3, '#00E5FF');
        // Massive concrete bridge support pillars
        box(ctx, wx + 10, 48, 26, FLOOR_MIN_Y - 48, '#263040', '#475569', '#0F172A');
        box(ctx, wx + 96, 48, 26, FLOOR_MIN_Y - 48, '#263040', '#475569', '#0F172A');
        // Chain-link alley fence between pillars
        px(ctx, wx + 36, 76, 60, FLOOR_MIN_Y - 76, '#0D131D');
        for (let fx = 40; fx < 94; fx += 8) px(ctx, wx + fx, 78, 1, FLOOR_MIN_Y - 78, 'rgba(148,163,184,0.22)');
        for (let fy = 82; fy < FLOOR_MIN_Y; fy += 8) px(ctx, wx + 36, fy, 60, 1, 'rgba(148,163,184,0.2)');
        // Upper Alupka Rock Concert Poster pasted on pillar!
        box(ctx, wx + 12, 82, 22, 34, '#443931', '#A8A29E', '#1C1917');
        ctx.fillStyle = '#FEF08A';
        ctx.font = 'bold 5px monospace';
        ctx.fillText('ALUPKA', wx + 13, 92);
        ctx.fillStyle = '#FF2A85';
        ctx.fillText('ROCK', wx + 15, 100);
        px(ctx, wx + 15, 104, 16, 8, '#1C1917');
        // Neon graffiti tag on back wall
        ctx.fillStyle = '#39FF14';
        ctx.font = 'bold 9px monospace';
        ctx.fillText('PIZED!', wx + 44, 114);
        // Glowing blue streetlamp under overpass
        px(ctx, wx + 56, 50, 20, 3, '#00E5FF');
        ctx.fillStyle = 'rgba(0,229,255,0.08)';
        ctx.beginPath();
        ctx.moveTo(wx + 56, 53);
        ctx.lineTo(wx + 36, FLOOR_MIN_Y);
        ctx.lineTo(wx + 96, FLOOR_MIN_Y);
        ctx.lineTo(wx + 76, 53);
        ctx.closePath();
        ctx.fill();
      } else if (variant === 3) {
        // Archetype 3: Quarantine Hologram Billboard + Burning Oil Drum + Police Barricade
        px(ctx, wx, 54, 126, FLOOR_MIN_Y - 54, '#141923');
        // Huge roof-mounted holographic warning billboard
        box(ctx, wx + 8, 22, 110, 42, '#090C11', '#FF2A85', INK);
        const scanY = 25 + ((Math.floor(time * 28) + wIdx * 7) % 34);
        px(ctx, wx + 11, scanY, 104, 2, 'rgba(57,255,20,0.35)');
        ctx.fillStyle = '#FF2A85';
        ctx.font = 'bold 8px monospace';
        ctx.fillText('VIRUS PIZED-77', wx + 22, 39);
        ctx.fillStyle = '#39FF14';
        ctx.font = 'bold 7px monospace';
        ctx.fillText('QUARANTINE ZONE', wx + 22, 53);
        // Yellow/black police barricade & burning barrel
        for (let bx = 12; bx < 78; bx += 12) {
          px(ctx, wx + bx, 134, 6, 14, '#FACC15');
          px(ctx, wx + bx + 6, 134, 6, 14, '#090C11');
        }
        // Burning metal trash barrel with flickering flame
        box(ctx, wx + 90, 126, 20, 24, '#334155', '#64748B', INK);
        const fl = Math.sin(time * 16 + wIdx) * 3;
        ctx.fillStyle = '#F97316';
        ctx.beginPath();
        ctx.moveTo(wx + 93, 126);
        ctx.lineTo(wx + 100, 108 + fl);
        ctx.lineTo(wx + 107, 126);
        ctx.fill();
        ctx.fillStyle = '#FEF08A';
        ctx.beginPath();
        ctx.moveTo(wx + 96, 126);
        ctx.lineTo(wx + 100, 115 + fl * 0.6);
        ctx.lineTo(wx + 104, 126);
        ctx.fill();
      } else if (variant === 4) {
        // Archetype 4: Multi-Story Cyber-Slum with Fire Escapes, Satellite Dishes & Hanging Cables
        px(ctx, wx, 24, 126, FLOOR_MIN_Y - 24, '#181E2B');
        px(ctx, wx + 4, 28, 118, FLOOR_MIN_Y - 30, '#212A3B');
        // Apartment windows with warm/neon glow
        for (let wy = 38; wy < 126; wy += 24) {
          for (let wx2 = 12; wx2 < 104; wx2 += 32) {
            const lit = (wIdx + wy + wx2) % 3 !== 0;
            box(ctx, wx + wx2, wy, 20, 14, lit ? '#1E3A3F' : '#0B0F17', '#475569', INK);
            if (lit) px(ctx, wx + wx2 + 3, wy + 3, 14, 8, (wy + wx2) % 2 === 0 ? 'rgba(0,229,255,0.35)' : 'rgba(255,176,0,0.3)');
          }
        }
        // Zig-zag iron fire escape
        px(ctx, wx + 8, 60, 56, 3, '#0F172A');
        px(ctx, wx + 8, 96, 56, 3, '#0F172A');
        ctx.strokeStyle = '#64748B';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(wx + 18, 60);
        ctx.lineTo(wx + 52, 96);
        ctx.lineTo(wx + 24, 138);
        ctx.stroke();
        // Overhead tangled power wires
        ctx.strokeStyle = '#090C11';
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(wx, 34);
        ctx.quadraticCurveTo(wx + 66, 54, wx + 132, 34);
        ctx.stroke();
      } else {
        // Archetype 5: Club «BAR PIZED» with Strobe Spotlights & Neon Doorway
        px(ctx, wx, 34, 126, FLOOR_MIN_Y - 34, '#161124');
        box(ctx, wx + 12, 42, 102, 24, '#090C11', '#FF2A85', INK);
        ctx.fillStyle = neonBlink ? '#FF2A85' : '#831843';
        ctx.font = 'bold 9px monospace';
        ctx.fillText('CLUB PIZED-77', wx + 20, 58);
        // Pulsing equalizer bars in club window
        box(ctx, wx + 14, 74, 46, 36, '#090C11', '#334155', INK);
        for (let b = 0; b < 6; b++) {
          const bh = 6 + Math.abs(Math.sin(time * 9 + b * 1.1)) * 22;
          px(ctx, wx + 18 + b * 7, 106 - bh, 5, bh, b % 2 === 0 ? '#39FF14' : '#00E5FF');
        }
        // Heavy velvet-rope doorway
        box(ctx, wx + 72, 86, 40, 64, '#0B0F17', '#FF2A85', INK);
        px(ctx, wx + 76, 92, 32, 26, 'rgba(255,42,133,0.22)');
      }
    }

    // Wet neon-lit asphalt street, glowing crosswalks, steam manholes & puddles
    px(ctx, 0, FLOOR_MIN_Y, VIRTUAL_W, VIRTUAL_H - FLOOR_MIN_Y, '#101520');
    px(ctx, 0, FLOOR_MIN_Y, VIRTUAL_W, 6, '#2A364B');
    px(ctx, 0, FLOOR_MIN_Y + 6, VIRTUAL_W, 2, '#070A0F');
    const roadTile = 92;
    const roadStart = Math.floor(camX / roadTile) - 1;
    for (let k = 0; k < 8; k++) {
      const rIdx = roadStart + k;
      const rx = rIdx * roadTile - camX;
      // Road lane dashes
      px(ctx, rx + 8, 206, 34, 3, '#334155');
      // Storm grate + rising manhole steam on every 3rd tile
      px(ctx, rx + 12, FLOOR_MIN_Y + 8, 18, 6, '#070A0F');
      px(ctx, rx + 14, FLOOR_MIN_Y + 9, 14, 1, '#475569');
      if (Math.abs(rIdx) % 3 === 1) {
        const st = (time * 24 + rIdx * 11) % 26;
        ctx.fillStyle = `rgba(203, 213, 225, ${0.22 * (1 - st / 26)})`;
        ctx.beginPath();
        ctx.arc(rx + 21 + Math.sin(time * 3 + rIdx) * 3, FLOOR_MIN_Y + 8 - st, 4 + st * 0.28, 0, Math.PI * 2);
        ctx.fill();
      }
      // Crosswalk bars every 5th tile
      if (Math.abs(rIdx) % 5 === 2) {
        for (let cy = FLOOR_MIN_Y + 14; cy < VIRTUAL_H - 12; cy += 14) {
          px(ctx, rx + 42, cy, 24, 6, 'rgba(226, 232, 240, 0.14)');
        }
      }
      // Colorful cyber puddle reflections
      px(ctx, rx + 24, 174, 28, 5, rIdx % 2 === 0 ? 'rgba(57, 255, 20, 0.17)' : 'rgba(0, 229, 255, 0.17)');
      px(ctx, rx + 54, 234, 24, 4, 'rgba(255, 42, 133, 0.18)');
      px(ctx, rx + 68, FLOOR_MIN_Y + 12, 5, 2, '#39FF14');
    }

    // Diagonal cyberpunk pixel rain streaks
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.16)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let r = 0; r < 28; r++) {
      const rx = ((r * 47 + Math.floor(time * 185)) % (VIRTUAL_W + 40)) - 20;
      const ry = (r * 31 + Math.floor(time * 365)) % VIRTUAL_H;
      ctx.moveTo(rx, ry);
      ctx.lineTo(rx - 4, ry + 11);
    }
    ctx.stroke();

  // =========================================================================
  // LEVEL 2: CYBER NIGHT MARKET, BAZAAR ARCHES, SHIPPING CONTAINERS & KEG DEPOT
  // =========================================================================
  } else if (level.id === 2) {
    drawCyberSkyline(ctx, level, camX, time);

    const tileW = 128;
    const startIdx = Math.floor(midScroll / tileW) - 1;
    for (let k = 0; k < 6; k++) {
      const wIdx = startIdx + k;
      const sx = wIdx * tileW - midScroll;
      const variant = ((wIdx % 6) + 6) % 6;

      if (variant === 0) {
        // Double-decker Green Beer Stall with lanterns & stacked crates
        box(ctx, sx + 4, 58, 114, 16, '#9D174D', '#F472B6', INK);
        for (let st = 0; st < 110; st += 16) px(ctx, sx + 6 + st, 59, 8, 14, '#111827');
        px(ctx, sx + 8, 74, 5, 78, '#475569');
        px(ctx, sx + 109, 74, 5, 78, '#475569');
        box(ctx, sx + 12, 118, 98, 32, '#292524', '#57534E', INK);
        box(ctx, sx + 18, 102, 22, 16, '#15803D', '#4ADE80', '#052E16');
        box(ctx, sx + 44, 102, 22, 16, '#15803D', '#4ADE80', '#052E16');
        box(ctx, sx + 30, 86, 22, 16, '#22C55E', '#BBF7D0', '#14532D');
        box(ctx, sx + 74, 104, 24, 14, '#A84A28', '#F97316', '#431407');
        // Swaying cyber lanterns
        const sw = Math.sin(time * 4 + wIdx) * 2;
        px(ctx, sx + 22 + sw, 76, 5, 7, '#FFB000');
        px(ctx, sx + 60 - sw, 76, 5, 7, '#39FF14');
        px(ctx, sx + 96 + sw, 76, 5, 7, '#FF2A85');
      } else if (variant === 1) {
        // Giant Cyber-Bazaar Neon Archway + Hanging LED Ticker
        box(ctx, sx + 8, 30, 16, FLOOR_MIN_Y - 30, '#1E293B', '#475569', INK);
        box(ctx, sx + 104, 30, 16, FLOOR_MIN_Y - 30, '#1E293B', '#475569', INK);
        box(ctx, sx + 4, 24, 120, 26, '#0F172A', '#FF2A85', INK);
        px(ctx, sx + 8, 28, 112, 18, '#090C11');
        ctx.fillStyle = '#39FF14';
        ctx.font = 'bold 8px monospace';
        ctx.fillText('РЫНОК PIZED-77', sx + 20, 40);
        // Holographic fish / bull market sign hanging under arch
        ctx.strokeStyle = '#00E5FF';
        ctx.lineWidth = 1.4;
        ctx.strokeRect(sx + 38, 56, 52, 22);
        ctx.fillStyle = 'rgba(0,229,255,0.18)';
        ctx.fillRect(sx + 38, 56, 52, 22);
        ctx.fillStyle = '#00E5FF';
        ctx.font = 'bold 7px monospace';
        ctx.fillText('FRESH KEG', sx + 44, 70);
      } else if (variant === 2) {
        // Black-Market Stacked Shipping Containers («PIZED CARGO» / «ALUPKA»)
        box(ctx, sx + 4, 86, 118, 64, '#164E63', '#00E5FF', INK);
        for (let rib = 12; rib < 114; rib += 10) px(ctx, sx + rib, 90, 2, 56, '#0E3747');
        box(ctx, sx + 16, 36, 98, 50, '#581C87', '#E879F9', INK);
        for (let rib = 24; rib < 108; rib += 10) px(ctx, sx + rib, 40, 2, 42, '#3B0764');
        ctx.fillStyle = '#FDE047';
        ctx.font = 'bold 7px monospace';
        ctx.fillText('PIZED CARGO', sx + 30, 64);
        ctx.fillStyle = '#39FF14';
        ctx.fillText('77-SECTOR', sx + 32, 122);
      } else if (variant === 3) {
        // Cyber Butcher & Taproom Booth with Neon Hooks & Kegs
        px(ctx, sx + 4, 46, 118, FLOOR_MIN_Y - 46, '#231622');
        box(ctx, sx + 10, 52, 106, 18, '#090C11', '#FFB000', INK);
        ctx.fillStyle = '#FFB000';
        ctx.font = 'bold 8px monospace';
        ctx.fillText('БУЙВОЛ-ГРИЛЬ', sx + 22, 64);
        // Hanging neon meat/keg rack inside glowing window
        box(ctx, sx + 14, 76, 98, 44, '#120A12', '#FF2A85', INK);
        px(ctx, sx + 18, 82, 90, 2, '#94A3B8');
        for (let h = 0; h < 4; h++) {
          px(ctx, sx + 28 + h * 22, 84, 2, 8, '#CBD5E1');
          box(ctx, sx + 23 + h * 22, 92, 12, 16, h % 2 === 0 ? '#991B1B' : '#15803D', '#FCA5A5', INK);
        }
        box(ctx, sx + 10, 124, 106, 26, '#33232D', '#64748B', INK);
      } else if (variant === 4) {
        // Hoist Crane & Dripping Toxic Keg Vat Tower
        px(ctx, sx + 10, 26, 6, FLOOR_MIN_Y - 26, '#475569');
        px(ctx, sx + 10, 26, 96, 6, '#FACC15');
        for (let s = 14; s < 100; s += 12) px(ctx, sx + s, 26, 6, 6, '#090C11');
        // Swinging suspended green-beer keg on steel chain
        const kegBob = Math.sin(time * 2.5 + wIdx) * 4;
        px(ctx, sx + 68, 32, 2, 34 + kegBob, '#94A3B8');
        box(ctx, sx + 54, 66 + kegBob, 30, 36, '#14532D', '#39FF14', INK);
        px(ctx, sx + 58, 78 + kegBob, 22, 8, '#39FF14');
        // Dripping green drops
        const dripY = 104 + ((time * 48 + wIdx * 19) % 44);
        px(ctx, sx + 68, dripY, 3, 5, '#39FF14');
        // Stacked wooden pallet base
        box(ctx, sx + 28, 134, 80, 16, '#5C3A21', '#9A6338', INK);
      } else {
        // Black-Market Loading Bay Warehouse with Open Rolling Shutter
        px(ctx, sx + 2, 38, 122, FLOOR_MIN_Y - 38, '#1B1A26');
        box(ctx, sx + 14, 54, 98, 96, '#090C11', '#475569', INK);
        // Half-raised corrugated shutter
        for (let ry = 56; ry < 92; ry += 6) px(ctx, sx + 16, ry, 94, 4, '#334155');
        // Glowing green warehouse interior + warning beacon
        px(ctx, sx + 18, 94, 90, 54, 'rgba(57,255,20,0.12)');
        box(ctx, sx + 26, 120, 26, 26, '#15803D', '#4ADE80', INK);
        box(ctx, sx + 58, 124, 22, 22, '#9A3412', '#FB923C', INK);
        if (Math.floor(time * 4 + wIdx) % 2 === 0) {
          px(ctx, sx + 58, 42, 12, 8, '#FF2A85');
        }
      }

      // Continuous overhead festive/cyber cable with glowing bulbs
      ctx.strokeStyle = '#0F172A';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(sx, 28);
      ctx.quadraticCurveTo(sx + 64, 44, sx + 128, 28);
      ctx.stroke();
      px(ctx, sx + 32, 35, 3, 3, '#39FF14');
      px(ctx, sx + 64, 38, 3, 3, '#FF2A85');
      px(ctx, sx + 96, 35, 3, 3, '#FFB000');
    }

    // Wet neon bazaar tile floor with spilled green beer & market drain lines
    px(ctx, 0, FLOOR_MIN_Y, VIRTUAL_W, VIRTUAL_H - FLOOR_MIN_Y, '#181421');
    px(ctx, 0, FLOOR_MIN_Y, VIRTUAL_W, 5, '#44403C');
    const tScroll = Math.floor(camX) % 52;
    for (let x = -tScroll; x < VIRTUAL_W; x += 52) {
      px(ctx, x, FLOOR_MIN_Y + 5, 1, VIRTUAL_H - FLOOR_MIN_Y, '#272034');
      px(ctx, x + 12, 184, 24, 4, 'rgba(57,255,20,0.16)');
      px(ctx, x + 28, 228, 18, 4, 'rgba(255,42,133,0.14)');
    }

  // =========================================================================
  // LEVEL 3: FACTORY PERIMETER — SEARCHLIGHTS, SUBSTATION, COLLECTOR, WATCHTOWERS
  // =========================================================================
  } else if (level.id === 3) {
    drawCyberSkyline(ctx, level, camX, time);

    // Distant colossal glowing brewery cooling towers + rising vapor
    const siloScroll = Math.floor(camX * 0.35);
    for (let s = -1; s < 5; s++) {
      const sx = s * 164 - (siloScroll % 164);
      ctx.fillStyle = '#0D1924';
      ctx.beginPath();
      ctx.moveTo(sx + 20, FLOOR_MIN_Y - 12);
      ctx.lineTo(sx + 32, 38);
      ctx.lineTo(sx + 74, 38);
      ctx.lineTo(sx + 86, FLOOR_MIN_Y - 12);
      ctx.closePath();
      ctx.fill();
      px(ctx, sx + 32, 42, 42, 3, '#39FF14');
    }

    // Volumetric sweeping cyan security searchlights
    for (let i = 0; i < 3; i++) {
      const originX = 76 + i * 168;
      const tipX = originX + Math.sin(time * 1.45 + i * 2.1) * 74;
      ctx.fillStyle = 'rgba(0, 229, 255, 0.11)';
      ctx.beginPath();
      ctx.moveTo(originX, FLOOR_MIN_Y - 14);
      ctx.lineTo(tipX - 36, 0);
      ctx.lineTo(tipX + 36, 0);
      ctx.closePath();
      ctx.fill();
    }

    const tileW = 124;
    const startIdx = Math.floor(midScroll / tileW) - 1;
    for (let k = 0; k < 6; k++) {
      const wIdx = startIdx + k;
      const fx = wIdx * tileW - midScroll;
      const variant = ((wIdx % 6) + 6) % 6;

      if (variant === 0) {
        // Laser-Wired Fence + Armored Guard Watchtower + Rotating Radar
        px(ctx, fx, 68, 120, 84, '#131D2A');
        box(ctx, fx + 72, 26, 42, 124, '#1E293B', '#475569', INK);
        box(ctx, fx + 68, 22, 50, 24, '#0F172A', '#00E5FF', INK);
        px(ctx, fx + 74, 28, 38, 10, 'rgba(0,229,255,0.4)');
        // Rotating radar dish
        const dishW = 6 + Math.abs(Math.sin(time * 3 + wIdx)) * 10;
        px(ctx, fx + 93 - dishW / 2, 14, dishW, 5, '#94A3B8');
        // Pulsing laser fence beams
        for (let ly = 78; ly < 136; ly += 14) {
          px(ctx, fx, ly, 72, 1.5, Math.floor(time * 6 + ly) % 3 === 0 ? '#FF2A85' : 'rgba(255,42,133,0.45)');
        }
      } else if (variant === 1) {
        // Pressurized PIZED-77 Toxic Pipeline Junction & Steam Valves
        px(ctx, fx, 64, 124, 88, '#141F2D');
        box(ctx, fx, 82, 124, 12, '#334155', '#94A3B8', '#0F172A');
        box(ctx, fx, 104, 124, 10, '#14532D', '#39FF14', '#052E16');
        // Glowing pressure gauge & valve wheel
        ctx.fillStyle = '#0F172A';
        ctx.beginPath();
        ctx.arc(fx + 62, 88, 9, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#FF2A85';
        ctx.lineWidth = 1.6;
        ctx.stroke();
        // Animated venting steam
        const puff = (time * 32 + wIdx * 17) % 28;
        ctx.fillStyle = `rgba(203, 213, 225, ${0.28 * (1 - puff / 28)})`;
        ctx.beginPath();
        ctx.arc(fx + 32, 80 - puff, 4 + puff * 0.24, 0, Math.PI * 2);
        ctx.fill();
      } else if (variant === 2) {
        // High-Voltage Cyber Transformer Substation with Crackling Cyan Arcs
        px(ctx, fx, 62, 124, 90, '#111926');
        box(ctx, fx + 12, 74, 34, 68, '#1E293B', '#00E5FF', INK);
        box(ctx, fx + 74, 74, 34, 68, '#1E293B', '#00E5FF', INK);
        // Copper/cyan coils
        for (let cy = 82; cy < 130; cy += 10) {
          px(ctx, fx + 16, cy, 26, 4, '#38BDF8');
          px(ctx, fx + 78, cy, 26, 4, '#38BDF8');
        }
        // Live crackling lightning arc between coils
        if (Math.floor(time * 12 + wIdx) % 3 !== 0) {
          ctx.strokeStyle = '#00E5FF';
          ctx.lineWidth = 1.8;
          ctx.beginPath();
          ctx.moveTo(fx + 46, 94);
          ctx.lineTo(fx + 56, 88 + Math.sin(time * 40) * 6);
          ctx.lineTo(fx + 64, 99 + Math.cos(time * 35) * 6);
          ctx.lineTo(fx + 74, 94);
          ctx.stroke();
        }
      } else if (variant === 3) {
        // Armored Security Checkpoint Booth + Barrier Arm + CCTV Camera
        px(ctx, fx, 66, 124, 86, '#151E2B');
        box(ctx, fx + 12, 72, 46, 78, '#1F2937', '#64748B', INK);
        px(ctx, fx + 18, 82, 34, 18, 'rgba(0,229,255,0.28)');
        px(ctx, fx + 22, 108, 26, 4, '#39FF14');
        // Striped security barrier gate
        px(ctx, fx + 64, 118, 52, 6, '#FF2A85');
        for (let bx = 68; bx < 112; bx += 12) px(ctx, fx + bx, 118, 6, 6, '#F8FAFC');
        box(ctx, fx + 58, 114, 10, 36, '#334155', '#94A3B8', INK);
        // Blinking red CCTV camera
        px(ctx, fx + 92, 68, 14, 6, '#475569');
        if (Math.floor(time * 3 + wIdx) % 2 === 0) px(ctx, fx + 90, 70, 3, 3, '#FF2A85');
      } else if (variant === 4) {
        // Toxic Drainage Culvert Pouring Glowing PIZED-77 Green Sludge
        px(ctx, fx, 58, 124, 94, '#131C26');
        ctx.fillStyle = '#070B10';
        ctx.beginPath();
        ctx.arc(fx + 62, 108, 28, Math.PI, 0);
        ctx.lineTo(fx + 90, 148);
        ctx.lineTo(fx + 34, 148);
        ctx.closePath();
        ctx.fill();
        // Flowing toxic green waterfall
        const flowOffset = Math.floor(time * 48) % 12;
        px(ctx, fx + 48, 104, 28, 46, 'rgba(57,255,20,0.45)');
        for (let wy = 104 + flowOffset; wy < 146; wy += 12) {
          px(ctx, fx + 52, wy, 20, 4, '#BBF7D0');
        }
        // Overhead biohazard sign
        box(ctx, fx + 34, 62, 56, 16, '#090C11', '#FACC15', INK);
        ctx.fillStyle = '#FACC15';
        ctx.font = 'bold 7px monospace';
        ctx.fillText('BIO-FLOW 77', fx + 39, 73);
      } else {
        // Heavy Blast Bulkhead Door «ЗЕЛЁНЫЙ ПОТОК» + Spinning Amber Hazard Lights
        px(ctx, fx, 48, 124, 104, '#182230');
        box(ctx, fx + 14, 58, 96, 92, '#243040', '#64748B', INK);
        px(ctx, fx + 61, 60, 2, 88, '#090C11');
        ctx.fillStyle = '#39FF14';
        ctx.font = 'bold 8px monospace';
        ctx.fillText('СЕКТОР-77', sxCenter(fx + 62, 46), 92);
        // Spinning amber beacons
        const beacon = Math.floor(time * 6 + wIdx) % 2 === 0;
        px(ctx, fx + 22, 50, 10, 6, beacon ? '#FFB000' : '#451A03');
        px(ctx, fx + 92, 50, 10, 6, !beacon ? '#FFB000' : '#451A03');
      }

      // Continuous yellow/black hazard curb strip at wall base
      for (let s = 0; s < 120; s += 12) {
        px(ctx, fx + s, 144, 6, 8, '#FACC15');
        px(ctx, fx + s + 6, 144, 6, 8, '#090C11');
      }
    }

    // Industrial concrete floor with drainage grates & glowing cable channels
    px(ctx, 0, FLOOR_MIN_Y, VIRTUAL_W, VIRTUAL_H - FLOOR_MIN_Y, '#121922');
    const cScroll = Math.floor(camX) % 72;
    for (let x = -cScroll; x < VIRTUAL_W; x += 72) {
      px(ctx, x, 198, 38, 3, '#243244');
      px(ctx, x + 12, 168, 22, 3, 'rgba(0,229,255,0.22)');
      px(ctx, x + 40, 232, 24, 4, 'rgba(57,255,20,0.16)');
    }

  // =========================================================================
  // LEVEL 4: HIGH-SPEED CYBER HIGHWAY — 4 BIOMES (OVERPASS -> TUNNEL -> BRIDGE -> REFINERY)
  // =========================================================================
  } else if (level.id === 4) {
    const speedScroll = Math.floor(time * 520);
    const biome = camX < 2500 ? 0 : camX < 4600 ? 1 : camX < 7300 ? 2 : 3;

    if (biome === 1) {
      // BIOME 1: High-Speed Strobe Cyber-Tunnel
      px(ctx, 0, 0, VIRTUAL_W, FLOOR_MIN_Y, '#080B16');
      px(ctx, 0, 0, VIRTUAL_W, 18, '#13192C');
      for (let x = -(speedScroll % 96); x < VIRTUAL_W; x += 96) {
        px(ctx, x, 10, 22, FLOOR_MIN_Y - 10, '#182038');
        px(ctx, x + 4, 16, 14, 7, '#00E5FF');
        px(ctx, x + 4, 24, 14, 2, '#FFFFFF');
        // Glowing magenta guide strip
        px(ctx, x + 28, 76, 56, 3, '#FF2A85');
        px(ctx, x + 28, 86, 56, 2, 'rgba(57,255,20,0.45)');
      }
    } else {
      drawCyberSkyline(ctx, level, camX, time, speedScroll * 0.14);

      if (biome === 0) {
        // BIOME 0: Neon Megacity Overpass with Giant Overhead Hologram Billboards
        for (let x = -(speedScroll % 180); x < VIRTUAL_W; x += 180) {
          px(ctx, x, 18, 8, FLOOR_MIN_Y - 18, '#26183D');
          px(ctx, x, 18, 180, 5, '#FF2A85');
          px(ctx, x + 12, 24, 156, 2, '#00E5FF');
          // Suspended neon highway gantry billboard
          box(ctx, x + 36, 30, 88, 28, '#090C11', '#39FF14', INK);
          ctx.fillStyle = '#39FF14';
          ctx.font = 'bold 8px monospace';
          ctx.fillText('NEXT: ZAVOD', x + 48, 43);
          ctx.fillStyle = '#FF2A85';
          ctx.font = 'bold 7px monospace';
          ctx.fillText('PIZED-77 HWY', x + 48, 53);
        }
      } else if (biome === 2) {
        // BIOME 2: Cyber Suspension Mega-Bridge over Shimmering Neon Bay
        // Shimmering dark water reflection horizon
        px(ctx, 0, FLOOR_MIN_Y - 26, VIRTUAL_W, 26, '#091124');
        for (let w = 0; w < 14; w++) {
          const wx = ((w * 43 - Math.floor(time * 90)) % VIRTUAL_W + VIRTUAL_W) % VIRTUAL_W;
          px(ctx, wx, FLOOR_MIN_Y - 20 + (w % 4) * 5, 22, 2, w % 2 === 0 ? 'rgba(255,42,133,0.35)' : 'rgba(0,229,255,0.35)');
        }
        // Towering neon cable-stay bridge pylons & sweeping diagonal cables
        for (let x = -(Math.floor(speedScroll * 0.85) % 240); x < VIRTUAL_W + 240; x += 240) {
          box(ctx, x, 6, 16, FLOOR_MIN_Y - 6, '#1E1B3A', '#FF2A85', INK);
          px(ctx, x + 6, 10, 4, FLOOR_MIN_Y - 20, '#00E5FF');
          ctx.strokeStyle = 'rgba(0, 229, 255, 0.45)';
          ctx.lineWidth = 1.2;
          ctx.beginPath();
          for (let c = 1; c <= 4; c++) {
            ctx.moveTo(x + 8, 12 + c * 10);
            ctx.lineTo(x + 8 - c * 28, FLOOR_MIN_Y - 12);
            ctx.moveTo(x + 8, 12 + c * 10);
            ctx.lineTo(x + 8 + c * 28, FLOOR_MIN_Y - 12);
          }
          ctx.stroke();
        }
      } else {
        // BIOME 3: Refinery Viaduct Approach — Flaming Gas Stacks & Red-Alert Arches
        for (let x = -(Math.floor(speedScroll * 0.75) % 156); x < VIRTUAL_W + 156; x += 156) {
          // Industrial steel refinery arch + flaming chimney
          px(ctx, x + 16, 12, 10, FLOOR_MIN_Y - 12, '#2D1A26');
          px(ctx, x, 12, 156, 6, '#7F1D1D');
          px(ctx, x + 8, 19, 140, 2, '#FF2A85');
          // Overhead toxic green pipeline crossing highway
          box(ctx, x, 46, 156, 9, '#14532D', '#39FF14', INK);
          // Flaming gas flare on chimney
          const fl = Math.sin(time * 18 + x) * 4;
          ctx.fillStyle = '#F97316';
          ctx.beginPath();
          ctx.moveTo(x + 15, 12);
          ctx.lineTo(x + 21, 0 + fl * 0.5);
          ctx.lineTo(x + 27, 12);
          ctx.fill();
        }
      }
    }

    // High-speed neon guardrail
    box(ctx, 0, FLOOR_MIN_Y - 12, VIRTUAL_W, 12, '#334155', '#64748B', '#0F172A');
    for (let x = -(speedScroll % 42); x < VIRTUAL_W; x += 42) {
      px(ctx, x, FLOOR_MIN_Y - 8, 18, 4, biome === 3 ? '#FF2A85' : '#39FF14');
    }

    // Asphalt & rushing cyber-highway lanes
    px(ctx, 0, FLOOR_MIN_Y, VIRTUAL_W, VIRTUAL_H - FLOOR_MIN_Y, '#0F111B');
    for (const laneY of [184, 220]) {
      for (let x = -(speedScroll % 72); x < VIRTUAL_W; x += 72) {
        px(ctx, x, laneY, 36, 3, biome === 2 ? '#00E5FF' : '#FACC15');
      }
    }
    // Wind & neon reflection speed-lines
    for (let s = 0; s < 10; s++) {
      const lx = VIRTUAL_W - ((Math.floor(time * 720) + s * 83) % (VIRTUAL_W + 60));
      px(ctx, lx, 158 + (s * 11) % 94, 24, 1, s % 2 === 0 ? 'rgba(0,229,255,0.28)' : 'rgba(255,42,133,0.24)');
    }
    px(ctx, 0, VIRTUAL_H - 9, VIRTUAL_W, 9, '#1E293B');

  // =========================================================================
  // LEVEL 5: 3-ACT FACTORY CORE (BIO-VATS -> SERVER MAINFRAME -> DIRECTOR'S PENTHOUSE)
  // =========================================================================
  } else {
    if (camX > 6400) {
      // ACT 3: DIRECTOR'S PANORAMIC CYBER-PENTHOUSE (Boss Arena!)
      drawCyberSkyline(ctx, level, camX * 0.4, time);
      // Tinted floor-to-ceiling armored glass overlay
      px(ctx, 0, 0, VIRTUAL_W, FLOOR_MIN_Y, 'rgba(4, 19, 14, 0.56)');
      // Obsidian & emerald penthouse window mullions
      for (let x = -(midScroll % 88); x < VIRTUAL_W; x += 88) {
        box(ctx, x, 0, 10, FLOOR_MIN_Y, '#111827', '#334155', INK);
        px(ctx, x + 4, 4, 2, FLOOR_MIN_Y - 8, '#39FF14');
      }
      // Giant rotating holographic PIZED-77 Viral Reactor Emblem
      const cx = VIRTUAL_W / 2;
      const cy = 78;
      ctx.strokeStyle = 'rgba(57,255,20,0.48)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(cx, cy, 38, 0, Math.PI * 2);
      ctx.stroke();
      ctx.strokeStyle = 'rgba(0,229,255,0.45)';
      ctx.beginPath();
      ctx.arc(cx, cy, 46, time * 1.4, time * 1.4 + Math.PI * 1.2);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(cx, cy, 46, time * 1.4 + Math.PI, time * 1.4 + Math.PI * 2.1);
      ctx.stroke();
      ctx.fillStyle = 'rgba(57,255,20,0.8)';
      ctx.font = 'bold 10px monospace';
      ctx.fillText('PIZED-77', cx - 26, cy + 3);
      ctx.fillStyle = 'rgba(255,42,133,0.75)';
      ctx.font = 'bold 6px monospace';
      ctx.fillText('DIRECTOR SUITE', cx - 28, cy + 16);

      // Polished obsidian & laser-grid penthouse floor
      px(ctx, 0, FLOOR_MIN_Y, VIRTUAL_W, VIRTUAL_H - FLOOR_MIN_Y, '#0B1615');
      px(ctx, 0, FLOOR_MIN_Y, VIRTUAL_W, 4, '#39FF14');
      for (let x = -(Math.floor(camX) % 64); x < VIRTUAL_W; x += 64) {
        px(ctx, x, FLOOR_MIN_Y + 4, 2, VIRTUAL_H - FLOOR_MIN_Y, '#14302B');
        px(ctx, x + 16, 198, 28, 2, 'rgba(57,255,20,0.16)');
      }
    } else if (camX > 3100) {
      // ACT 2: CYBER-SERVER MAINFRAME & PIZED-77 VIRAL LABORATORY
      px(ctx, 0, 0, VIRTUAL_W, FLOOR_MIN_Y, '#060D14');
      const tileW = 116;
      const startIdx = Math.floor(midScroll / tileW) - 1;
      for (let k = 0; k < 6; k++) {
        const wIdx = startIdx + k;
        const sx = wIdx * tileW - midScroll;
        const variant = ((wIdx % 3) + 3) % 3;

        if (variant === 0) {
          // Tall Blinking Quantum Server Racks
          box(ctx, sx + 8, 24, 44, 126, '#0F172A', '#00E5FF', INK);
          box(ctx, sx + 60, 24, 44, 126, '#0F172A', '#39FF14', INK);
          for (let ry = 32; ry < 140; ry += 10) {
            const blinkA = Math.floor(time * 8 + ry + wIdx) % 3 === 0;
            const blinkB = Math.floor(time * 6 + ry * 2 + wIdx) % 2 === 0;
            px(ctx, sx + 14, ry, 20, 3, blinkA ? '#00E5FF' : '#1E293B');
            px(ctx, sx + 38, ry, 8, 3, blinkB ? '#FF2A85' : '#1E293B');
            px(ctx, sx + 66, ry, 24, 3, blinkB ? '#39FF14' : '#1E293B');
            px(ctx, sx + 94, ry, 5, 3, '#FFB000');
          }
        } else if (variant === 1) {
          // Cryo-Specimen Tube containing Floating Mutant Silhouette
          box(ctx, sx + 20, 22, 74, 128, '#111827', '#475569', INK);
          box(ctx, sx + 30, 34, 54, 102, '#052E16', '#39FF14', INK);
          const bob = Math.sin(time * 2.4 + wIdx) * 4;
          // Mutant silhouette floating inside glass
          ctx.fillStyle = 'rgba(6, 78, 59, 0.85)';
          ctx.beginPath();
          ctx.ellipse(sx + 57, 78 + bob, 14, 22, 0, 0, Math.PI * 2);
          ctx.fill();
          px(ctx, sx + 52, 68 + bob, 3, 3, '#FF2A85');
          px(ctx, sx + 60, 68 + bob, 3, 3, '#FF2A85');
          // Rising bubbles
          const by = 128 - (Math.floor(time * 40 + wIdx * 19) % 86);
          px(ctx, sx + 40, by, 4, 4, '#BBF7D0');
          px(ctx, sx + 70, ((by + 30) % 86) + 42, 3, 3, '#39FF14');
        } else {
          // Holographic DNA / Virus Double-Helix Terminal
          box(ctx, sx + 10, 34, 96, 82, '#090C11', '#00E5FF', INK);
          for (let d = 0; d < 12; d++) {
            const dx = sx + 18 + d * 7;
            const y1 = 75 + Math.sin(time * 4 + d * 0.7) * 18;
            const y2 = 75 - Math.sin(time * 4 + d * 0.7) * 18;
            px(ctx, dx, Math.min(y1, y2), 1, Math.abs(y2 - y1), 'rgba(57,255,20,0.4)');
            px(ctx, dx - 1, y1 - 1, 3, 3, '#39FF14');
            px(ctx, dx - 1, y2 - 1, 3, 3, '#FF2A85');
          }
          box(ctx, sx + 22, 122, 72, 28, '#1E293B', '#475569', INK);
        }
      }

      // Illuminated circuit-grid laboratory floor
      px(ctx, 0, FLOOR_MIN_Y, VIRTUAL_W, VIRTUAL_H - FLOOR_MIN_Y, '#0C141E');
      px(ctx, 0, FLOOR_MIN_Y, VIRTUAL_W, 4, '#00E5FF');
      const fScroll = Math.floor(camX) % 56;
      for (let x = -fScroll; x < VIRTUAL_W; x += 56) {
        px(ctx, x, FLOOR_MIN_Y + 4, 1, VIRTUAL_H - FLOOR_MIN_Y, '#16273B');
        px(ctx, x + 10, 206, 26, 2, 'rgba(0,229,255,0.22)');
      }
    } else {
      // ACT 1: BREWERY FERMENTATION BIO-VATS, ROBOT ARMS & BOTTLING CONVEYORS
      px(ctx, 0, 0, VIRTUAL_W, FLOOR_MIN_Y, '#07110D');
      // Overhead steel catwalk gantry
      px(ctx, 0, 18, VIRTUAL_W, 5, '#1E293B');
      px(ctx, 0, 23, VIRTUAL_W, 2, '#39FF14');

      const tileW = 114;
      const startIdx = Math.floor(midScroll / tileW) - 1;
      for (let k = 0; k < 6; k++) {
        const wIdx = startIdx + k;
        const vx = wIdx * tileW - midScroll;
        const variant = ((wIdx % 3) + 3) % 3;

        if (variant === 0) {
          // Colossal Bubbling Green-Beer Fermentation Vat
          box(ctx, vx + 12, 30, 62, 120, '#1F2937', '#475569', '#0F172A');
          box(ctx, vx + 19, 40, 48, 90, '#052E16', '#39FF14', INK);
          const by = 122 - (Math.floor(time * 38 + wIdx * 25) % 74);
          px(ctx, vx + 28, by, 6, 6, '#39FF14');
          px(ctx, vx + 46, ((by + 28) % 74) + 48, 5, 5, '#BBF7D0');
          // Side vertical feed pipe
          box(ctx, vx + 82, 24, 14, 126, '#334155', '#94A3B8', INK);
          px(ctx, vx + 86, 30, 4, 114, '#39FF14');
        } else if (variant === 1) {
          // Articulated Overhead Robot Bottling Claw + Sparking Fuse Panel
          px(ctx, vx + 6, 26, 102, 124, '#111A18');
          const armSwing = Math.sin(time * 3.5 + wIdx) * 12;
          ctx.strokeStyle = '#FACC15';
          ctx.lineWidth = 4;
          ctx.beginPath();
          ctx.moveTo(vx + 56, 24);
          ctx.lineTo(vx + 56 + armSwing, 68);
          ctx.lineTo(vx + 56 + armSwing * 0.5, 102);
          ctx.stroke();
          px(ctx, vx + 50 + armSwing * 0.5, 100, 12, 8, '#FF2A85');
          // Industrial control panel with blinking alerts
          box(ctx, vx + 16, 98, 28, 42, '#1E293B', '#64748B', INK);
          px(ctx, vx + 20, 104, 20, 10, '#090C11');
          px(ctx, vx + 22, 106, 10, 3, Math.floor(time * 5 + wIdx) % 2 === 0 ? '#39FF14' : '#FF2A85');
        } else {
          // Pressurized Mixing Boiler + Giant «PIZED-77» Stencil Tank
          box(ctx, vx + 8, 38, 96, 108, '#172226', '#475569', INK);
          box(ctx, vx + 18, 52, 76, 42, '#090C11', '#39FF14', INK);
          ctx.fillStyle = '#39FF14';
          ctx.font = 'bold 9px monospace';
          ctx.fillText('PIZED-77', vx + 28, 72);
          ctx.fillStyle = '#FFB000';
          ctx.font = 'bold 6px monospace';
          ctx.fillText('BATCH #999', vx + 32, 86);
          // Hazard stripes
          for (let s = 12; s < 96; s += 12) {
            px(ctx, vx + s, 134, 6, 10, '#FACC15');
            px(ctx, vx + s + 6, 134, 6, 10, '#090C11');
          }
        }
      }

      // Factory floor + animated green-beer bottling conveyor belt
      px(ctx, 0, FLOOR_MIN_Y, VIRTUAL_W, VIRTUAL_H - FLOOR_MIN_Y, '#141B23');
      box(ctx, 0, FLOOR_MIN_Y + 6, VIRTUAL_W, 14, '#272E3B', '#475569', INK);
      const bScroll = Math.floor(time * 75) % 24;
      for (let x = -bScroll; x < VIRTUAL_W; x += 24) {
        px(ctx, x, FLOOR_MIN_Y + 9, 9, 8, '#39FF14');
        px(ctx, x + 2, FLOOR_MIN_Y + 8, 5, 2, '#ECFCCB');
      }
      const gScroll = Math.floor(camX) % 64;
      for (let x = -gScroll; x < VIRTUAL_W; x += 64) {
        px(ctx, x, 212, 34, 2, '#1F2C38');
      }
    }
  }

  // Render monumental signature set-pieces & road hazards in world space
  drawLevelLandmarks(ctx, level, camX, time);
}

function drawLevelLandmarks(
  ctx: CanvasRenderingContext2D,
  level: LevelDef,
  camX: number,
  time: number
): void {
  const pulse = 0.5 + 0.5 * Math.sin(time * 5.5);

  // 1. Render Interactive Jumpable Road Hazards & Obstacles across the street!
  if (level.roadHazards) {
    for (const hz of level.roadHazards) {
      const sx = Math.round(hz.x - camX);
      if (sx < -150 || sx > VIRTUAL_W + 150) continue;

      const x0 = sx - hz.w / 2;
      const y0 = hz.y - hz.h / 2;
      const warnBlink = Math.floor(time * 7) % 2 === 0;

      if (hz.kind === 'bridge_hole') {
        // Approach warning chevrons & blinking road flares on left side
        for (let c = 0; c < 3; c++) {
          const cx = x0 - 28 + c * 9;
          ctx.strokeStyle = warnBlink ? '#FACC15' : '#FF2A85';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(cx, y0 + 4);
          ctx.lineTo(cx + 5, hz.y);
          ctx.lineTo(cx, y0 + hz.h - 4);
          ctx.stroke();
        }
        px(ctx, x0 - 10, y0 - 4, 5, 3, '#FF2A85');
        ctx.fillStyle = `rgba(255, 42, 133, ${0.35 + pulse * 0.35})`;
        ctx.beginPath();
        ctx.arc(x0 - 8, y0 - 3, 6 + pulse * 3, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#334155';
        ctx.beginPath();
        ctx.moveTo(x0 - 4, y0 + 6);
        ctx.lineTo(x0 + 14, y0 - 4);
        ctx.lineTo(x0 + hz.w - 10, y0 - 2);
        ctx.lineTo(x0 + hz.w + 6, y0 + 10);
        ctx.lineTo(x0 + hz.w + 2, y0 + hz.h - 4);
        ctx.lineTo(x0 + hz.w - 18, y0 + hz.h + 5);
        ctx.lineTo(x0 + 12, y0 + hz.h + 3);
        ctx.lineTo(x0 - 6, y0 + hz.h - 8);
        ctx.closePath();
        ctx.fill();

        ctx.fillStyle = '#040814';
        ctx.beginPath();
        ctx.moveTo(x0 + 1, y0 + 7);
        ctx.lineTo(x0 + 15, y0 + 1);
        ctx.lineTo(x0 + hz.w - 12, y0 + 2);
        ctx.lineTo(x0 + hz.w + 1, y0 + 11);
        ctx.lineTo(x0 + hz.w - 2, y0 + hz.h - 6);
        ctx.lineTo(x0 + hz.w - 18, y0 + hz.h + 1);
        ctx.lineTo(x0 + 13, y0 + hz.h - 1);
        ctx.lineTo(x0 - 1, y0 + hz.h - 9);
        ctx.closePath();
        ctx.fill();

        const waterShift = Math.floor(time * 60) % 18;
        px(ctx, x0 + 10 + (waterShift % 10), hz.y - 4, 22, 2, 'rgba(0, 229, 255, 0.38)');
        px(ctx, x0 + 22 - (waterShift % 8), hz.y + 6, 26, 2, 'rgba(255, 42, 133, 0.34)');

        ctx.strokeStyle = '#94A3B8';
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.moveTo(x0 + 2, y0 + 12);
        ctx.lineTo(x0 + 16, y0 + 15);
        ctx.moveTo(x0 + 4, y0 + hz.h - 12);
        ctx.lineTo(x0 + 19, y0 + hz.h - 15);
        ctx.moveTo(x0 + hz.w - 2, y0 + 14);
        ctx.lineTo(x0 + hz.w - 17, y0 + 18);
        ctx.moveTo(x0 + hz.w - 4, y0 + hz.h - 10);
        ctx.lineTo(x0 + hz.w - 16, y0 + hz.h - 14);
        ctx.stroke();

        ctx.fillStyle = warnBlink ? '#FACC15' : '#FFFFFF';
        ctx.font = 'bold 6px monospace';
        ctx.fillText('ПРОВАЛ!', sx - 16, y0 - 5);
      } else if (hz.kind === 'slime_river') {
        // Bubbling radioactive green PIZED-77 river cutting across the ENTIRE street!
        const topY = FLOOR_MIN_Y + 1;
        const riverH = VIRTUAL_H - FLOOR_MIN_Y - 2;
        // Cracked dark trench banks
        px(ctx, x0 - 4, topY, hz.w + 8, riverH, '#0F1A14');
        // Glowing toxic emerald river core
        const rg = ctx.createLinearGradient(x0, topY, x0 + hz.w, topY);
        rg.addColorStop(0, '#14532D');
        rg.addColorStop(0.22, '#22C55E');
        rg.addColorStop(0.5, '#39FF14');
        rg.addColorStop(0.78, '#22C55E');
        rg.addColorStop(1, '#14532D');
        ctx.fillStyle = rg;
        ctx.fillRect(x0, topY, hz.w, riverH);

        // Animated flowing sludge streaks & popping toxic bubbles!
        const flow = (time * 32) % 24;
        for (let b = 0; b < 6; b++) {
          const by = topY + ((b * 18 + flow) % (riverH - 8));
          const bx = x0 + 7 + ((b * 13) % Math.max(8, hz.w - 16));
          px(ctx, bx, by, 6, 2, '#D9F99D');
          const br = 2 + ((Math.sin(time * 6 + b * 2) + 1) * 1.4);
          ctx.fillStyle = '#ECFCCB';
          ctx.beginPath();
          ctx.arc(bx + 3, by + 4, br, 0, Math.PI * 2);
          ctx.fill();
        }
        // Neon warning edge stripes
        px(ctx, x0 - 3, topY, 3, riverH, warnBlink ? '#39FF14' : '#FACC15');
        px(ctx, x0 + hz.w, topY, 3, riverH, warnBlink ? '#39FF14' : '#FACC15');
        ctx.fillStyle = '#D9F99D';
        ctx.font = 'bold 6px monospace';
        ctx.textAlign = 'center';
        ctx.fillText('ЖИЖА · ПРЫЖОК!', sx, topY - 4);
        ctx.textAlign = 'left';
      } else if (hz.kind === 'barrier') {
        // Heavy Concrete & Steel Cyberpunk Roadblock Jersey Barrier spanning full road (must jump!)
        const topY = FLOOR_MIN_Y + 2;
        const barH = VIRTUAL_H - FLOOR_MIN_Y - 6;
        // Shadow
        px(ctx, x0 + 5, topY + 2, hz.w, barH, 'rgba(0,0,0,0.45)');
        // Concrete blocks stacked across street depth
        for (let seg = 0; seg < 3; seg++) {
          const sy = topY + seg * (barH / 3);
          const sh = barH / 3 - 2;
          box(ctx, x0, sy, hz.w, sh, '#334155', '#94A3B8', INK);
          // Yellow-black hazard warning top strip
          for (let hy = sy + 2; hy < sy + sh - 3; hy += 8) {
            px(ctx, x0 + 3, hy, hz.w - 6, 4, '#FACC15');
            px(ctx, x0 + 3, hy + 4, hz.w - 6, 4, '#090C11');
          }
          // Glowing red roadblock strobe beacon
          px(ctx, sx - 2, sy + 2, 4, 3, warnBlink ? '#FF2A85' : '#7F1D1D');
        }
        ctx.fillStyle = warnBlink ? '#FACC15' : '#FFFFFF';
        ctx.font = 'bold 6px monospace';
        ctx.textAlign = 'center';
        ctx.fillText('БАРЬЕР · [K]', sx, topY - 4);
        ctx.textAlign = 'left';
      } else if (hz.kind === 'boom_gate') {
        // Security Striped Boom Barrier Gate spanning entire road!
        const topY = FLOOR_MIN_Y;
        const gateH = VIRTUAL_H - FLOOR_MIN_Y - 4;
        // Checkpoint mechanism pylon at top sidewalk
        box(ctx, sx - 10, topY - 24, 20, 26, '#1E293B', '#64748B', INK);
        px(ctx, sx - 5, topY - 21, 10, 5, warnBlink ? '#FF2A85' : '#39FF14');
        // Shadow on road
        px(ctx, sx - 2, topY + 4, 9, gateH, 'rgba(0,0,0,0.42)');
        // Red & white striped steel boom arm crossing the entire street
        for (let py = topY; py < topY + gateH; py += 12) {
          const isRed = Math.floor(py / 12) % 2 === 0;
          box(ctx, sx - 5, py, 10, 12, isRed ? '#DC2626' : '#F8FAFC', isRed ? '#FCA5A5' : '#FFFFFF', INK);
        }
        // Bottom support post
        box(ctx, sx - 7, topY + gateH - 8, 14, 10, '#334155', '#94A3B8', INK);
        ctx.fillStyle = '#FACC15';
        ctx.font = 'bold 6px monospace';
        ctx.textAlign = 'center';
        ctx.fillText('ШЛАГБАУМ · [K]', sx, topY - 27);
        ctx.textAlign = 'left';
      } else if (hz.kind === 'crate_row') {
        // Solid wall of industrial wooden/beer crates lined up across the entire road!
        const topY = FLOOR_MIN_Y + 2;
        const rowH = VIRTUAL_H - FLOOR_MIN_Y - 6;
        const count = 4;
        const ch = rowH / count;
        for (let i = 0; i < count; i++) {
          const cy = topY + i * ch;
          px(ctx, x0 + 5, cy + 3, hz.w, ch - 2, 'rgba(0,0,0,0.42)');
          box(ctx, x0, cy, hz.w, ch - 2, '#92400E', '#F59E0B', INK);
          // Diagonal crate timber cross-brace
          ctx.strokeStyle = '#451A03';
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.moveTo(x0 + 3, cy + 3);
          ctx.lineTo(x0 + hz.w - 3, cy + ch - 5);
          ctx.moveTo(x0 + hz.w - 3, cy + 3);
          ctx.lineTo(x0 + 3, cy + ch - 5);
          ctx.stroke();
          // Green beer bio-stencil
          px(ctx, sx - 3, cy + ch * 0.35, 6, 4, '#39FF14');
        }
        ctx.fillStyle = '#FDE047';
        ctx.font = 'bold 6px monospace';
        ctx.textAlign = 'center';
        ctx.fillText('ЯЩИКИ · [K]', sx, topY - 4);
        ctx.textAlign = 'left';
      } else if (hz.kind === 'laser_gate') {
        // Pulsing Cyberpunk Floor Laser Barrier spanning entire street!
        const topY = FLOOR_MIN_Y;
        const botY = VIRTUAL_H - 6;
        const phase = (time + (hz.pulseOffset ?? 0)) % 2.8;
        const active = phase < 2.0; // On for 2.0s, brief 0.8s recharge blink — OR always jumpable!

        // Top & bottom emitter pylons
        box(ctx, sx - 9, topY - 14, 18, 16, '#0F172A', '#00E5FF', INK);
        box(ctx, sx - 9, botY - 8, 18, 10, '#0F172A', '#00E5FF', INK);
        px(ctx, sx - 3, topY - 9, 6, 4, active ? '#FF2A85' : '#334155');
        px(ctx, sx - 3, botY - 5, 6, 3, active ? '#FF2A85' : '#334155');

        if (active) {
          // Outer lethal magenta plasma glow
          ctx.fillStyle = `rgba(255, 42, 133, ${0.32 + pulse * 0.28})`;
          ctx.fillRect(sx - 6, topY + 2, 12, botY - topY - 10);
          // Scorching twin laser cores
          px(ctx, sx - 2, topY + 2, 4, botY - topY - 10, '#FF2A85');
          px(ctx, sx - 0.8, topY + 2, 1.6, botY - topY - 10, '#FFFFFF');
        } else {
          // Faint targeting guide line during brief recharge
          px(ctx, sx - 1, topY + 2, 2, botY - topY - 10, 'rgba(0, 229, 255, 0.35)');
        }

        ctx.fillStyle = active ? '#FF2A85' : '#00E5FF';
        ctx.font = 'bold 6px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(active ? 'ЛАЗЕР! [K]' : 'ПЕРЕЗАРЯДКА', sx, topY - 17);
        ctx.textAlign = 'left';
      }
    }
  }

  // 2. Render Monumental World-Space Landmarks (15 unforgettable set-pieces!)
  for (const lm of level.landmarks) {
    if (lm.kind === 'bridge_hole') continue;
    const sx = Math.round(lm.x - camX);
    if (sx < -220 || sx > VIRTUAL_W + 220) continue;

    switch (lm.kind) {
      case 'statue_brewer': {
        // LEVEL 1: Colossal Cyberpunk Statue of the Brewer-Liberator with Glowing Foam-Mug Torch!
        // Dramatic upward floodlight cones
        ctx.fillStyle = 'rgba(57, 255, 20, 0.09)';
        ctx.beginPath();
        ctx.moveTo(sx - 44, FLOOR_MIN_Y);
        ctx.lineTo(sx - 12, 8);
        ctx.lineTo(sx + 20, 8);
        ctx.lineTo(sx + 48, FLOOR_MIN_Y);
        ctx.closePath();
        ctx.fill();

        // Cracked brutalist stone plinth & plaza steps
        box(ctx, sx - 44, FLOOR_MIN_Y - 12, 88, 14, '#1E293B', '#475569', INK);
        box(ctx, sx - 34, FLOOR_MIN_Y - 38, 68, 28, '#283546', '#64748B', INK);
        box(ctx, sx - 26, FLOOR_MIN_Y - 32, 52, 16, '#090C11', '#39FF14', INK);
        ctx.fillStyle = '#39FF14';
        ctx.font = 'bold 6px monospace';
        ctx.fillText('ALUPKA', sx - 14, FLOOR_MIN_Y - 25);
        ctx.fillStyle = '#FFB000';
        ctx.fillText('LIBERTY', sx - 16, FLOOR_MIN_Y - 18);

        // Colossal oxidized verdigris-bronze robed colossus body
        drawRoundedPoly(
          ctx,
          [
            [sx - 24, FLOOR_MIN_Y - 38],
            [sx + 24, FLOOR_MIN_Y - 38],
            [sx + 18, 52],
            [sx - 18, 52],
          ],
          '#1E564C',
          INK,
          1.4
        );
        // Sculpted robe folds & neon circuit seams
        ctx.strokeStyle = '#34D399';
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(sx - 10, FLOOR_MIN_Y - 40);
        ctx.lineTo(sx - 6, 60);
        ctx.moveTo(sx + 8, FLOOR_MIN_Y - 40);
        ctx.lineTo(sx + 4, 62);
        ctx.stroke();

        // Crowned bearded head with glowing visor
        drawInkEllipse(ctx, sx, 40, 12, 13, 0, '#2B7A6B', '#6EE7B7', '#0F3831', 1.3);
        // Spiked liberty crown rays
        ctx.strokeStyle = '#5EEAD4';
        ctx.lineWidth = 1.8;
        for (let a = -2; a <= 2; a++) {
          ctx.beginPath();
          ctx.moveTo(sx + a * 5, 29);
          ctx.lineTo(sx + a * 10, 18);
          ctx.stroke();
        }
        px(ctx, sx - 7, 37, 14, 3, '#39FF14');

        // Towering raised arm holding gigantic glowing Beer-Mug Torch!
        drawTaperedLimb(ctx, sx + 14, 62, sx + 32, 34, 6, 4.5, '#2B7A6B', '#6EE7B7', '#0F3831', 1.3);
        box(ctx, sx + 22, 14, 20, 22, '#D97706', '#FDE047', INK);
        box(ctx, sx + 20, 8, 24, 8, '#FEF9C3', '#FFFFFF', '#94A3B8');
        ctx.fillStyle = `rgba(255, 176, 0, ${0.22 + pulse * 0.2})`;
        ctx.beginPath();
        ctx.arc(sx + 32, 18, 22 + pulse * 5, 0, Math.PI * 2);
        ctx.fill();
        break;
      }

      case 'wrecked_beer_truck': {
        // LEVEL 1: Massive Overturned Armored Beer Tanker «PIZED-77» Blocking Upper Curb Lane!
        // Giant glowing toxic green beer flood pooling across road
        ctx.fillStyle = `rgba(57, 255, 20, ${0.26 + pulse * 0.1})`;
        ctx.beginPath();
        ctx.ellipse(sx - 10, FLOOR_MIN_Y + 18, 76, 16, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = 'rgba(134, 239, 172, 0.55)';
        ctx.lineWidth = 1.2;
        ctx.stroke();

        ctx.save();
        ctx.translate(sx, FLOOR_MIN_Y + 6);
        ctx.rotate(-0.14); // dramatic wrecked tilt!
        // Ruptured massive stainless/green pressurized cistern
        drawRoundedRect(ctx, -78, -52, 108, 44, 10, '#14532D', INK, 1.6);
        drawRoundedRect(ctx, -68, -44, 88, 24, 5, '#052E16', '#39FF14', 1.1);
        ctx.fillStyle = '#39FF14';
        ctx.font = 'bold 10px monospace';
        ctx.fillText('PIZED-77', -52, -29);
        // Jagged crack in tank gushing green foam
        ctx.strokeStyle = '#BBF7D0';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(-18, -42);
        ctx.lineTo(-10, -28);
        ctx.lineTo(-16, -14);
        ctx.stroke();
        // Smashed cab
        drawRoundedPoly(
          ctx,
          [
            [30, -8],
            [30, -44],
            [58, -42],
            [70, -24],
            [70, -8],
          ],
          '#1E293B',
          INK,
          1.5
        );
        drawRoundedPoly(ctx, [[40, -38], [55, -38], [64, -25], [40, -25]], '#0F172A', '#38BDF8', 1.0);
        // Heavy rubber tires
        for (const wx of [-54, -22, 50]) {
          drawInkEllipse(ctx, wx, -6, 11, 11, 0, '#090C11', '#334155', INK, 1.3);
          drawInkEllipse(ctx, wx, -6, 5, 5, 0, '#475569', '#94A3B8', INK, 0.9);
        }
        // Flashing amber hazard blinkers
        if (Math.floor(time * 5) % 2 === 0) {
          px(ctx, 64, -18, 6, 5, '#FFB000');
          px(ctx, -78, -22, 5, 5, '#FF2A85');
        }
        ctx.restore();

        // Rising black engine smoke puffs
        for (let s = 0; s < 4; s++) {
          const st = (time * 28 + s * 16) % 54;
          ctx.fillStyle = `rgba(30, 41, 59, ${0.55 * (1 - st / 54)})`;
          ctx.beginPath();
          ctx.arc(sx + 54 + Math.sin(time * 3 + s) * 6, FLOOR_MIN_Y - 34 - st, 8 + st * 0.25, 0, Math.PI * 2);
          ctx.fill();
        }
        break;
      }

      case 'quarantine_skull_arch': {
        // LEVEL 1: Towering Neon-Red & Emerald Quarantine Mega-Gate with Hologram Skull
        box(ctx, sx - 68, 14, 20, FLOOR_MIN_Y - 12, '#1E293B', '#475569', INK);
        box(ctx, sx + 48, 14, 20, FLOOR_MIN_Y - 12, '#1E293B', '#475569', INK);
        box(ctx, sx - 74, 8, 148, 28, '#090C11', '#FF2A85', INK);
        ctx.fillStyle = Math.floor(time * 4) % 2 === 0 ? '#FF2A85' : '#FFB000';
        ctx.font = 'bold 9px monospace';
        ctx.fillText('QUARANTINE SECTOR', sx - 52, 26);

        // Giant translucent emerald holographic bio-skull floating under arch
        ctx.fillStyle = `rgba(57, 255, 20, ${0.18 + pulse * 0.14})`;
        ctx.beginPath();
        ctx.arc(sx, 76, 26, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#39FF14';
        ctx.lineWidth = 1.6;
        ctx.stroke();
        // Skull eyes & grin
        px(ctx, sx - 13, 68, 9, 8, '#090C11');
        px(ctx, sx + 4, 68, 9, 8, '#090C11');
        px(ctx, sx - 10, 70, 3, 4, '#FF2A85');
        px(ctx, sx + 7, 70, 3, 4, '#FF2A85');
        for (let t = -9; t <= 6; t += 5) px(ctx, sx + t, 88, 3, 7, '#39FF14');
        break;
      }

      case 'statue_cyber_bull': {
        // LEVEL 2: Monumental Golden Cyber-Bull Statue Presiding Over the Night Market!
        box(ctx, sx - 52, FLOOR_MIN_Y - 26, 104, 28, '#291529', '#FF2A85', INK);
        ctx.fillStyle = '#FACC15';
        ctx.font = 'bold 8px monospace';
        ctx.fillText('BAZAAR KING', sx - 32, FLOOR_MIN_Y - 10);

        // Massive gilded mechanical bull shoulders & head
        drawRoundedPoly(
          ctx,
          [
            [sx - 42, FLOOR_MIN_Y - 26],
            [sx - 36, 62],
            [sx + 36, 62],
            [sx + 42, FLOOR_MIN_Y - 26],
          ],
          '#B45309',
          INK,
          1.6
        );
        drawRoundedPoly(
          ctx,
          [
            [sx - 26, 46],
            [sx + 26, 46],
            [sx + 20, 96],
            [sx - 20, 96],
          ],
          '#D97706',
          INK,
          1.5
        );
        // Colossal sweeping chrome-gold horns!
        drawRoundedPoly(ctx, [[sx - 24, 54], [sx - 66, 22], [sx - 56, 12], [sx - 18, 44]], '#FEF08A', INK, 1.4);
        drawRoundedPoly(ctx, [[sx + 24, 54], [sx + 66, 22], [sx + 56, 12], [sx + 18, 44]], '#FEF08A', INK, 1.4);
        // Blazing ruby cyber eyes + neon nose ring
        px(ctx, sx - 16, 62, 10, 5, '#FF2A85');
        px(ctx, sx + 6, 62, 10, 5, '#FF2A85');
        ctx.strokeStyle = '#00E5FF';
        ctx.lineWidth = 2.6;
        ctx.beginPath();
        ctx.arc(sx, 92, 9, 0, Math.PI * 2);
        ctx.stroke();
        // Venting white steam jets from nostrils
        const st = (time * 38) % 24;
        ctx.fillStyle = `rgba(226, 232, 240, ${0.42 * (1 - st / 24)})`;
        ctx.beginPath();
        ctx.arc(sx - 12 - st * 0.5, 84 + st * 0.2, 4 + st * 0.2, 0, Math.PI * 2);
        ctx.arc(sx + 12 + st * 0.5, 84 + st * 0.2, 4 + st * 0.2, 0, Math.PI * 2);
        ctx.fill();
        break;
      }

      case 'beached_cargo_ship': {
        // LEVEL 2: Colossal Rust-and-Neon Freighter Ship Bow «АЛУПКА-МАРУ» Jutting Into the Docks!
        // Towering ship prow hull
        drawRoundedPoly(
          ctx,
          [
            [sx - 84, FLOOR_MIN_Y + 2],
            [sx - 64, 34],
            [sx + 76, 46],
            [sx + 92, FLOOR_MIN_Y + 2],
          ],
          '#3B1D24',
          INK,
          1.7
        );
        // Upper white/slate superstructure bridge & radar mast
        box(ctx, sx - 18, 12, 68, 36, '#1E293B', '#64748B', INK);
        px(ctx, sx - 10, 20, 52, 10, 'rgba(0, 229, 255, 0.5)');
        px(ctx, sx + 14, 0, 4, 14, '#94A3B8');
        if (Math.floor(time * 4) % 2 === 0) px(ctx, sx + 12, 0, 8, 5, '#FF2A85');
        // Ship name stencil + glowing green draft line
        px(ctx, sx - 76, FLOOR_MIN_Y - 18, 160, 6, '#991B1B');
        ctx.fillStyle = '#F8FAFC';
        ctx.font = 'bold 10px monospace';
        ctx.fillText('АЛУПКА-МАРУ', sx - 46, 82);
        ctx.fillStyle = '#39FF14';
        ctx.font = 'bold 7px monospace';
        ctx.fillText('CARGO #77', sx - 32, 98);
        // Heavy hanging anchor & chain
        px(ctx, sx - 46, 56, 3, 72, '#94A3B8');
        box(ctx, sx - 54, 120, 18, 14, '#334155', '#CBD5E1', INK);
        break;
      }

      case 'market_van_wreck': {
        // LEVEL 2: Burned-Out Market Armored Van + Towering Glowing Neon Keg Pyramid!
        // Glowing pyramid of green beer kegs behind van
        for (let row = 0; row < 3; row++) {
          const count = 4 - row;
          for (let i = 0; i < count; i++) {
            const kx = sx + 22 + row * 10 + i * 20;
            const ky = FLOOR_MIN_Y - 16 - row * 22;
            box(ctx, kx, ky, 18, 22, '#14532D', '#39FF14', INK);
            px(ctx, kx + 3, ky + 7, 12, 6, '#39FF14');
          }
        }
        // Crooked wrecked dark-violet market van on road shoulder
        drawRoundedRect(ctx, sx - 78, FLOOR_MIN_Y - 40, 96, 46, 6, '#2E1065', INK, 1.5);
        drawRoundedRect(ctx, sx - 70, FLOOR_MIN_Y - 32, 34, 18, 2, '#090C11', '#FF2A85', 1.0);
        drawInkEllipse(ctx, sx - 56, FLOOR_MIN_Y + 4, 10, 10, 0, '#090C11', '#475569', INK, 1.2);
        drawInkEllipse(ctx, sx - 4, FLOOR_MIN_Y + 4, 10, 10, 0, '#090C11', '#475569', INK, 1.2);
        // Flickering fire out of smashed hood
        const fl = Math.sin(time * 18) * 5;
        ctx.fillStyle = '#F97316';
        ctx.beginPath();
        ctx.moveTo(sx - 80, FLOOR_MIN_Y - 16);
        ctx.lineTo(sx - 68, FLOOR_MIN_Y - 48 + fl);
        ctx.lineTo(sx - 56, FLOOR_MIN_Y - 16);
        ctx.fill();
        ctx.fillStyle = '#FEF08A';
        ctx.beginPath();
        ctx.moveTo(sx - 75, FLOOR_MIN_Y - 16);
        ctx.lineTo(sx - 68, FLOOR_MIN_Y - 36 + fl * 0.5);
        ctx.lineTo(sx - 61, FLOOR_MIN_Y - 16);
        ctx.fill();
        break;
      }

      case 'titan_mech_bay': {
        // LEVEL 3: Colossal Half-Assembled Contra-Style Combat Mech «ТИТАН-77» in Yellow Scaffolding!
        // Giant steel mech legs & armored pelvis
        box(ctx, sx - 44, 96, 26, FLOOR_MIN_Y - 94, '#1E293B', '#475569', INK);
        box(ctx, sx + 18, 96, 26, FLOOR_MIN_Y - 94, '#1E293B', '#475569', INK);
        // Massive armored torso & twin shoulder cannons
        drawRoundedPoly(
          ctx,
          [
            [sx - 50, 96],
            [sx - 62, 34],
            [sx + 62, 34],
            [sx + 50, 96],
          ],
          '#1F2937',
          INK,
          1.6
        );
        // Shoulder twin rail-pods
        box(ctx, sx - 76, 22, 24, 34, '#334155', '#94A3B8', INK);
        box(ctx, sx + 52, 22, 24, 34, '#334155', '#94A3B8', INK);
        // Mech head & menacing glowing crimson optic
        box(ctx, sx - 20, 12, 40, 26, '#0F172A', '#64748B', INK);
        px(ctx, sx - 14, 21, 28, 6, '#FF2A85');
        // Throbbing emerald plasma core in chest!
        ctx.fillStyle = `rgba(57, 255, 20, ${0.4 + pulse * 0.45})`;
        ctx.beginPath();
        ctx.arc(sx, 66, 16 + pulse * 3, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#ECFCCB';
        ctx.beginPath();
        ctx.arc(sx, 66, 7, 0, Math.PI * 2);
        ctx.fill();
        // Yellow industrial construction scaffolding framing the giant mech
        px(ctx, sx - 82, 8, 5, FLOOR_MIN_Y - 8, '#FACC15');
        px(ctx, sx + 77, 8, 5, FLOOR_MIN_Y - 8, '#FACC15');
        px(ctx, sx - 82, 48, 164, 4, '#FACC15');
        px(ctx, sx - 82, 102, 164, 4, '#FACC15');
        // Welding sparks!
        if (Math.floor(time * 16) % 3 !== 0) {
          for (let sp = 0; sp < 5; sp++) {
            px(ctx, sx + 48 + Math.sin(time * 30 + sp * 2) * 14, 46 + ((time * 70 + sp * 11) % 24), 2.5, 2.5, '#FEF08A');
          }
        }
        break;
      }

      case 'wrecked_apc': {
        // LEVEL 3: Massive Destroyed 8-Wheel Riot APC «ПОТОК-09» at Checkpoint Roadblock!
        // Armored angled APC hull
        drawRoundedPoly(
          ctx,
          [
            [sx - 74, FLOOR_MIN_Y + 4],
            [sx - 62, FLOOR_MIN_Y - 38],
            [sx + 44, FLOOR_MIN_Y - 38],
            [sx + 74, FLOOR_MIN_Y - 16],
            [sx + 68, FLOOR_MIN_Y + 4],
          ],
          '#1E293B',
          INK,
          1.6
        );
        // Turret & smoking barrel
        box(ctx, sx - 22, FLOOR_MIN_Y - 54, 40, 18, '#334155', '#64748B', INK);
        px(ctx, sx + 18, FLOOR_MIN_Y - 48, 42, 5, '#94A3B8');
        ctx.fillStyle = '#00E5FF';
        ctx.font = 'bold 8px monospace';
        ctx.fillText('ПОТОК-09', sx - 42, FLOOR_MIN_Y - 16);
        // 4 massive armored wheels
        for (const wx of [-48, -18, 14, 44]) {
          drawInkEllipse(ctx, sx + wx, FLOOR_MIN_Y + 4, 10, 10, 0, '#090C11', '#475569', INK, 1.3);
        }
        // Flashing police siren on roof
        const siren = Math.floor(time * 8) % 2 === 0;
        px(ctx, sx - 6, FLOOR_MIN_Y - 60, 12, 6, siren ? '#FF2A85' : '#00E5FF');
        // Smoke column
        for (let s = 0; s < 3; s++) {
          const st = (time * 24 + s * 18) % 48;
          ctx.fillStyle = `rgba(148, 163, 184, ${0.38 * (1 - st / 48)})`;
          ctx.beginPath();
          ctx.arc(sx + 4, FLOOR_MIN_Y - 56 - st, 7 + st * 0.25, 0, Math.PI * 2);
          ctx.fill();
        }
        break;
      }

      case 'cracked_reactor_dome': {
        // LEVEL 3: Colossal Cracked Geodesic Reactor Dome Spewing Emerald Plasma Sky-Beam!
        // Vertical plasma beam blasting into the sky
        ctx.fillStyle = `rgba(57, 255, 20, ${0.24 + pulse * 0.16})`;
        ctx.fillRect(sx - 20, 0, 40, FLOOR_MIN_Y - 20);
        ctx.fillStyle = 'rgba(236, 252, 203, 0.55)';
        ctx.fillRect(sx - 7, 0, 14, FLOOR_MIN_Y - 20);

        // Colossal dark-metal dome shell
        ctx.fillStyle = '#14202C';
        ctx.beginPath();
        ctx.arc(sx, FLOOR_MIN_Y, 78, Math.PI, 0);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = '#39FF14';
        ctx.lineWidth = 2;
        ctx.stroke();

        // Glowing green fracture cracks across dome
        ctx.strokeStyle = '#BBF7D0';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(sx - 34, FLOOR_MIN_Y - 40);
        ctx.lineTo(sx - 8, FLOOR_MIN_Y - 64);
        ctx.lineTo(sx + 18, FLOOR_MIN_Y - 44);
        ctx.lineTo(sx + 42, FLOOR_MIN_Y - 24);
        ctx.stroke();
        break;
      }

      case 'burning_semi_truck': {
        // LEVEL 4: Colossal Jackknifed Blazing Semi-Truck «CYBER-HAUL» on Highway Shoulder!
        drawRoundedRect(ctx, sx - 92, FLOOR_MIN_Y - 50, 126, 46, 5, '#3F1D2E', INK, 1.6);
        px(ctx, sx - 84, FLOOR_MIN_Y - 38, 110, 14, '#090C11');
        ctx.fillStyle = '#FF2A85';
        ctx.font = 'bold 10px monospace';
        ctx.fillText('CYBER-HAUL 77', sx - 76, FLOOR_MIN_Y - 27);
        // Smashed armored tractor cab
        drawRoundedPoly(
          ctx,
          [
            [sx + 36, FLOOR_MIN_Y - 4],
            [sx + 36, FLOOR_MIN_Y - 44],
            [sx + 68, FLOOR_MIN_Y - 42],
            [sx + 82, FLOOR_MIN_Y - 22],
            [sx + 82, FLOOR_MIN_Y - 4],
          ],
          '#1E293B',
          INK,
          1.5
        );
        // Roaring highway inferno flames!
        for (let f = 0; f < 5; f++) {
          const fx = sx - 68 + f * 32;
          const fh = 22 + Math.sin(time * 20 + f * 1.7) * 9;
          ctx.fillStyle = '#F97316';
          ctx.beginPath();
          ctx.moveTo(fx - 12, FLOOR_MIN_Y - 44);
          ctx.lineTo(fx, FLOOR_MIN_Y - 44 - fh);
          ctx.lineTo(fx + 12, FLOOR_MIN_Y - 44);
          ctx.fill();
          ctx.fillStyle = '#FEF08A';
          ctx.beginPath();
          ctx.moveTo(fx - 6, FLOOR_MIN_Y - 44);
          ctx.lineTo(fx, FLOOR_MIN_Y - 44 - fh * 0.6);
          ctx.lineTo(fx + 6, FLOOR_MIN_Y - 44);
          ctx.fill();
        }
        break;
      }

      case 'factory_welcome_arch': {
        // LEVEL 4: Colossal Triumphal Neon Highway Entrance Arch «ЗАВОД ЗЕЛЁНЫЙ ПОТОК»
        box(ctx, sx - 84, 6, 22, FLOOR_MIN_Y - 6, '#1E1B3A', '#39FF14', INK);
        box(ctx, sx + 62, 6, 22, FLOOR_MIN_Y - 6, '#1E1B3A', '#39FF14', INK);
        box(ctx, sx - 90, 6, 180, 32, '#090C11', '#39FF14', INK);
        ctx.fillStyle = '#39FF14';
        ctx.font = 'bold 9px monospace';
        ctx.fillText('ЗЕЛЁНЫЙ ПОТОК · ВЪЕЗД', sx - 66, 21);
        ctx.fillStyle = '#FF2A85';
        ctx.font = 'bold 7px monospace';
        ctx.fillText('WARNING: BOSS CARAVAN AHEAD', sx - 64, 33);
        // Glowing plasma tubes running down pillars
        px(ctx, sx - 76, 40, 6, FLOOR_MIN_Y - 46, '#39FF14');
        px(ctx, sx + 70, 40, 6, FLOOR_MIN_Y - 46, '#39FF14');
        break;
      }

      case 'bio_leviathan_tank': {
        // LEVEL 5: Colossal 3-Story Glass Bio-Tank Containing Pulsing Mutated PIZED-77 Mega-Brain!
        box(ctx, sx - 64, 8, 128, FLOOR_MIN_Y - 8, '#1E293B', '#475569', INK);
        box(ctx, sx - 52, 18, 104, FLOOR_MIN_Y - 26, '#052E16', '#39FF14', INK);
        // Giant pulsing floating bio-leviathan brain inside glass
        const bob = Math.sin(time * 2.5) * 4;
        const r = 28 + pulse * 3;
        ctx.fillStyle = 'rgba(57, 255, 20, 0.24)';
        ctx.beginPath();
        ctx.ellipse(sx, 78 + bob, r + 10, r * 0.9, 0, 0, Math.PI * 2);
        ctx.fill();
        drawInkEllipse(ctx, sx, 76 + bob, r, r * 0.78, 0, '#166534', '#4ADE80', '#052E16', 1.4);
        // Creepy glowing red cluster eyes on the bio-colossus
        px(ctx, sx - 12, 72 + bob, 5, 5, '#FF2A85');
        px(ctx, sx - 2, 68 + bob, 6, 6, '#FF2A85');
        px(ctx, sx + 9, 73 + bob, 5, 5, '#FF2A85');
        // Neural power cables connecting tank ceiling to brain
        ctx.strokeStyle = '#00E5FF';
        ctx.lineWidth = 1.6;
        for (const cx of [-26, 0, 26]) {
          ctx.beginPath();
          ctx.moveTo(sx + cx, 18);
          ctx.lineTo(sx + cx * 0.6, 54 + bob);
          ctx.stroke();
        }
        ctx.fillStyle = '#FACC15';
        ctx.font = 'bold 7px monospace';
        ctx.fillText('SPECIMEN-00: BIO-CORE', sx - 46, FLOOR_MIN_Y - 12);
        break;
      }

      case 'director_statue': {
        // LEVEL 5: Monumental Obsidian & Gold Bust Statue of the Factory Director Split by Lightning!
        box(ctx, sx - 48, FLOOR_MIN_Y - 28, 96, 28, '#0F172A', '#FACC15', INK);
        ctx.fillStyle = '#FACC15';
        ctx.font = 'bold 8px monospace';
        ctx.fillText('THE DIRECTOR', sx - 32, FLOOR_MIN_Y - 11);
        // Broad obsidian-and-gold shoulders
        drawRoundedPoly(
          ctx,
          [
            [sx - 44, FLOOR_MIN_Y - 28],
            [sx - 36, 72],
            [sx + 36, 72],
            [sx + 44, FLOOR_MIN_Y - 28],
          ],
          '#111827',
          '#FACC15',
          1.5
        );
        // Sculpted tyrant head with glowing neon visor
        drawRoundedPoly(
          ctx,
          [
            [sx - 20, 72],
            [sx - 24, 28],
            [sx, 16],
            [sx + 24, 28],
            [sx + 20, 72],
          ],
          '#1F2937',
          '#FACC15',
          1.5
        );
        px(ctx, sx - 16, 42, 32, 6, '#FF2A85');
        // Crackling cyan/violet lightning scar splitting the monument
        if (Math.floor(time * 10) % 3 !== 0) {
          ctx.strokeStyle = '#00E5FF';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(sx + 6, 14);
          ctx.lineTo(sx - 4, 48);
          ctx.lineTo(sx + 8, 76);
          ctx.lineTo(sx - 6, FLOOR_MIN_Y - 28);
          ctx.stroke();
        }
        break;
      }

      case 'pized_world_globe': {
        // LEVEL 5: Giant Spinning Holographic Wireframe Planet Globe «PIZED WORLD»!
        box(ctx, sx - 44, FLOOR_MIN_Y - 22, 88, 22, '#090C11', '#00E5FF', INK);
        ctx.fillStyle = '#39FF14';
        ctx.font = 'bold 7px monospace';
        ctx.fillText('PIZED WORLD', sx - 28, FLOOR_MIN_Y - 9);
        const cy = 68;
        const r = 42;
        ctx.fillStyle = 'rgba(57, 255, 20, 0.12)';
        ctx.beginPath();
        ctx.arc(sx, cy, r, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#39FF14';
        ctx.lineWidth = 1.6;
        ctx.stroke();
        // Rotating latitude & longitude wireframe arcs
        ctx.strokeStyle = 'rgba(0, 229, 255, 0.65)';
        ctx.lineWidth = 1.1;
        for (let m = 0; m < 3; m++) {
          const rx = Math.max(4, Math.abs(Math.cos(time * 1.1 + m * 1.05)) * r);
          ctx.beginPath();
          ctx.ellipse(sx, cy, rx, r, 0, 0, Math.PI * 2);
          ctx.stroke();
        }
        for (const dy of [-18, 0, 18]) {
          const rw = Math.sqrt(Math.max(0, r * r - dy * dy));
          ctx.beginPath();
          ctx.moveTo(sx - rw, cy + dy);
          ctx.lineTo(sx + rw, cy + dy);
          ctx.stroke();
        }
        // Tilted neon orbital ring
        ctx.strokeStyle = '#FF2A85';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.ellipse(sx, cy, r + 18, 12, -0.25, 0, Math.PI * 2);
        ctx.stroke();
        break;
      }
    }
  }
}

function sxCenter(cx: number, width: number): number {
  return Math.round(cx - width / 2);
}

interface CutscenePlacement {
  id: HeroId;
  x: number;
  y: number;
  defaultFacing: 1 | -1;
}

// Organic conversational huddle positions per cutscene theme (NO stiff 4x2 grid!)
const CUTSCENE_LAYOUTS: Record<CutsceneDef['sceneTheme'], CutscenePlacement[]> = {
  van_street: [
    { id: 'vadek', x: 108, y: 204, defaultFacing: 1 },
    { id: 'vano', x: 158, y: 184, defaultFacing: 1 },
    { id: 'koren', x: 202, y: 226, defaultFacing: 1 },
    { id: 'hooper', x: 244, y: 192, defaultFacing: -1 },
    { id: 'sandro', x: 288, y: 234, defaultFacing: -1 },
    { id: 'zavod_killer', x: 334, y: 198, defaultFacing: -1 },
    { id: 'bo', x: 374, y: 222, defaultFacing: -1 },
    { id: 'ded', x: 416, y: 244, defaultFacing: -1 },
  ],
  market_crates: [
    { id: 'sandro', x: 208, y: 178, defaultFacing: 1 }, // right next to wooden crate stool!
    { id: 'vadek', x: 112, y: 214, defaultFacing: 1 },
    { id: 'vano', x: 154, y: 242, defaultFacing: 1 },
    { id: 'hooper', x: 266, y: 196, defaultFacing: -1 },
    { id: 'ded', x: 318, y: 234, defaultFacing: -1 },
    { id: 'bo', x: 368, y: 186, defaultFacing: -1 },
    { id: 'zavod_killer', x: 64, y: 192, defaultFacing: 1 },
    { id: 'koren', x: 410, y: 220, defaultFacing: -1 },
  ],
  factory_gate: [
    { id: 'bo', x: 274, y: 174, defaultFacing: 1 }, // hunched right near gate terminal!
    { id: 'koren', x: 226, y: 188, defaultFacing: 1 },
    { id: 'zavod_killer', x: 162, y: 206, defaultFacing: 1 },
    { id: 'vadek', x: 102, y: 234, defaultFacing: 1 },
    { id: 'vano', x: 334, y: 196, defaultFacing: -1 },
    { id: 'hooper', x: 204, y: 244, defaultFacing: 1 },
    { id: 'sandro', x: 374, y: 232, defaultFacing: -1 },
    { id: 'ded', x: 422, y: 212, defaultFacing: -1 },
  ],
  highway_bikes: [
    { id: 'vadek', x: 378, y: 208, defaultFacing: 1 },
    { id: 'vano', x: 326, y: 178, defaultFacing: 1 },
    { id: 'sandro', x: 288, y: 236, defaultFacing: 1 },
    { id: 'hooper', x: 236, y: 194, defaultFacing: 1 },
    { id: 'koren', x: 192, y: 244, defaultFacing: 1 },
    { id: 'zavod_killer', x: 146, y: 184, defaultFacing: 1 },
    { id: 'bo', x: 112, y: 224, defaultFacing: 1 },
    { id: 'ded', x: 62, y: 248, defaultFacing: 1 },
  ],
  factory_lift: [
    { id: 'bo', x: 126, y: 182, defaultFacing: 1 },
    { id: 'koren', x: 176, y: 202, defaultFacing: 1 },
    { id: 'zavod_killer', x: 234, y: 186, defaultFacing: 1 },
    { id: 'vadek', x: 92, y: 232, defaultFacing: 1 },
    { id: 'vano', x: 294, y: 194, defaultFacing: -1 },
    { id: 'sandro', x: 344, y: 224, defaultFacing: -1 },
    { id: 'hooper', x: 208, y: 244, defaultFacing: -1 },
    { id: 'ded', x: 396, y: 240, defaultFacing: -1 },
  ],
  city_dawn: [
    { id: 'zavod_killer', x: 196, y: 194, defaultFacing: 1 },
    { id: 'vadek', x: 136, y: 214, defaultFacing: 1 },
    { id: 'bo', x: 256, y: 188, defaultFacing: -1 },
    { id: 'ded', x: 318, y: 212, defaultFacing: -1 },
    { id: 'vano', x: 84, y: 240, defaultFacing: 1 },
    { id: 'hooper', x: 224, y: 242, defaultFacing: -1 },
    { id: 'sandro', x: 368, y: 238, defaultFacing: -1 },
    { id: 'koren', x: 416, y: 206, defaultFacing: -1 },
  ],
};

export function drawCutsceneScene(
  ctx: CanvasRenderingContext2D,
  cutscene: CutsceneDef,
  activeSpeakerId: HeroId | null,
  time: number,
  isEpilogue = false,
  epilogueTime = 0
): void {
  const ep = isEpilogue ? Math.min(1, epilogueTime / 2.2) : 0;
  const grad = ctx.createLinearGradient(0, 0, 0, VIRTUAL_H);
  if (cutscene.sceneTheme === 'city_dawn') {
    grad.addColorStop(0, isEpilogue ? '#312E81' : '#1B1938');
    grad.addColorStop(0.55, isEpilogue ? '#EA580C' : '#9A3412');
    grad.addColorStop(1, '#1E293B');
  } else {
    grad.addColorStop(0, '#080C14');
    grad.addColorStop(0.6, '#141F2B');
    grad.addColorStop(1, '#0F141C');
  }
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, VIRTUAL_W, VIRTUAL_H);

  // Rising golden sun during victory epilogue!
  if (cutscene.sceneTheme === 'city_dawn') {
    const sunY = 128 - ep * 38;
    ctx.fillStyle = `rgba(251, 191, 36, ${0.35 + ep * 0.4})`;
    ctx.beginPath();
    ctx.arc(240, sunY, 34 + ep * 12, 0, Math.PI * 2);
    ctx.fill();
  }

  px(ctx, 0, 146, VIRTUAL_W, 124, '#131923');
  px(ctx, 0, 144, VIRTUAL_W, 3, '#2B3648');

  // Weathered Upper Alupka rock poster on background wall
  box(ctx, 376, 26, 76, 90, '#443931', '#78685A', '#1C1917');
  ctx.fillStyle = '#F5F5F4';
  ctx.font = 'bold 7px monospace';
  ctx.fillText('LIMP BIZKIT', 383, 42);
  ctx.font = '6px monospace';
  ctx.fillText('UPPER ALUPKA', 383, 53);
  ctx.fillStyle = '#FF2A85';
  ctx.fillText('LIVE MEMORY', 385, 65);
  px(ctx, 382, 82, 64, 28, '#1C1917');
  for (let i = 0; i < 8; i++) {
    px(ctx, 385 + i * 7, 77 + (i % 2) * 3, 4, 7, '#1C1917');
  }

  // Scene-specific props + LIVE epilogue animations!
  const vanShift = cutscene.sceneTheme === 'van_street' && isEpilogue ? Math.max(0, epilogueTime - 0.9) * 140 : 0;
  if (cutscene.sceneTheme === 'van_street') {
    const rumble = isEpilogue ? Math.sin(time * 40) * 1.1 : 0;
    const vx = 18 + vanShift;
    drawRoundedRect(ctx, vx, 56 + rumble, 174, 86, 6, '#27303F', INK, 1.5);
    drawRoundedRect(ctx, vx + 8, 66 + rumble, 56, 32, 3, '#0F172A', '#38BDF8', 1.1);
    drawRoundedRect(ctx, vx + 72, 66 + rumble, 78, 32, 3, '#0F172A', '#38BDF8', 1.1);
    ctx.fillStyle = '#39FF14';
    ctx.fillRect(vx + 2, 118 + rumble, 170, 10);
    // Circular van wheels
    drawInkEllipse(ctx, vx + 34, 141, 14, 14, 0, '#0F172A', '#475569', INK, 1.4);
    drawInkEllipse(ctx, vx + 138, 141, 14, 14, 0, '#0F172A', '#475569', INK, 1.4);
    if (isEpilogue) {
      // Headlight beam & DED smoking out the van window!
      ctx.fillStyle = 'rgba(254, 240, 138, 0.28)';
      ctx.beginPath();
      ctx.moveTo(vx + 174, 106);
      ctx.lineTo(vx + 260, 88);
      ctx.lineTo(vx + 260, 142);
      ctx.lineTo(vx + 174, 124);
      ctx.closePath();
      ctx.fill();
      for (let sm = 0; sm < 4; sm++) {
        ctx.fillStyle = 'rgba(57, 255, 20, 0.42)';
        ctx.beginPath();
        ctx.arc(vx + 100 - sm * 14 - ((time * 36) % 24), 76 - sm * 6, 7 + sm * 3, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    box(ctx, 220, 34, 122, 24, '#090C11', '#39FF14', INK);
    ctx.fillStyle = '#39FF14';
    ctx.font = 'bold 8px monospace';
    ctx.fillText('ПЕЙ ЗЕЛЁНОЕ', 238, 49);
  } else if (cutscene.sceneTheme === 'market_crates') {
    for (let i = 0; i < 4; i++) {
      box(ctx, 28 + i * 34, 114, 28, 30, '#166534', '#4ADE80', '#052E16');
      px(ctx, 32 + i * 34, 122, 20, 8, '#39FF14');
    }
    // Sandro's wooden crate stool (visibly fixed & sparkling during epilogue!)
    const stoolShake = isEpilogue && epilogueTime < 1.2 ? Math.sin(time * 35) * 1.5 : 0;
    box(ctx, 214 + stoolShake, 128, 28, 6, '#A84A28', '#F97316', '#431407');
    px(ctx, 217 + stoolShake, 134, 4, 18, '#78350F');
    px(ctx, 235 + stoolShake, 134, 4, 18, '#78350F');
    if (isEpilogue) {
      // Sparks flying as Sandro repairs stool!
      if (epilogueTime < 1.3) {
        for (let sp = 0; sp < 4; sp++) {
          ctx.fillStyle = '#FACC15';
          ctx.fillRect(225 + Math.sin(time * 24 + sp * 2) * 12, 122 - ((time * 40 + sp * 7) % 14), 2.5, 2.5);
        }
      }
      // Dense glowing green hookah smoke cloud rolling across the garage!
      for (let sm = 0; sm < 6; sm++) {
        ctx.fillStyle = `rgba(57, 255, 20, ${0.18 + ep * 0.14})`;
        ctx.beginPath();
        ctx.arc(310 - sm * 34 + Math.sin(time * 2 + sm) * 10, 178 - sm * 10, 16 + ep * 18, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  } else if (cutscene.sceneTheme === 'factory_gate') {
    const gateOpen = isEpilogue ? Math.min(48, epilogueTime * 36) : 0;
    for (let x = 20; x < 360; x += 28) {
      const shift = x > 140 && x < 240 ? -gateOpen : 0;
      px(ctx, x + shift, 38, 3, 108, '#475569');
    }
    px(ctx, 20, 76, 340, 4, isEpilogue ? '#00E5FF' : '#39FF14');
    box(ctx, 270, 94, 32, 50, '#1E293B', '#64748B', INK);
    px(ctx, 275, 100, 22, 16, isEpilogue && Math.floor(time * 12) % 2 === 0 ? '#39FF14' : '#00E5FF');
    if (isEpilogue) {
      // Bo hacking spark beam + Koren's scout drone lifting off over the fence!
      ctx.strokeStyle = '#00E5FF';
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(274, 152);
      ctx.lineTo(286, 112);
      ctx.stroke();
      const droneY = Math.max(46, 150 - epilogueTime * 65);
      const droneX = 226 + Math.sin(time * 4) * 28 + epilogueTime * 22;
      drawRoundedRect(ctx, droneX - 8, droneY - 4, 16, 7, 2, '#1E293B', '#00E5FF', 1.0);
      ctx.fillStyle = '#39FF14';
      ctx.fillRect(droneX - 3, droneY - 2, 6, 3);
    }
  } else if (cutscene.sceneTheme === 'highway_bikes') {
    const spd = isEpilogue ? 560 : 260;
    const sLine = Math.floor(time * spd) % 64;
    for (let x = -sLine; x < VIRTUAL_W; x += 64) px(ctx, x, 198, 30, 3, '#FACC15');
  } else if (cutscene.sceneTheme === 'factory_lift') {
    const liftScroll = isEpilogue ? Math.floor(time * 140) % 28 : 0;
    for (let x = 16; x < VIRTUAL_W; x += 56) {
      px(ctx, x, 10, 5, 138, '#334155');
      for (let y = liftScroll; y < 140; y += 28) {
        px(ctx, x - 2, y, 9, 2, '#64748B');
      }
    }
    box(ctx, 176, 24, 128, 22, '#090C11', '#39FF14', INK);
    ctx.fillStyle = '#39FF14';
    ctx.font = 'bold 9px monospace';
    ctx.fillText(isEpilogue ? 'ASCENDING >>>' : 'FLOOR: BOSS OFFICE', 184, 38);
  }

  // Organic conversational group placement (depth-sorted by Y!)
  const layout = CUTSCENE_LAYOUTS[cutscene.sceneTheme];
  const speakerPos = activeSpeakerId ? layout.find((p) => p.id === activeSpeakerId) : null;
  const onBikes = cutscene.sceneTheme === 'highway_bikes';

  const renderOrder = [...layout].sort((a, b) => a.y - b.y);
  for (let i = 0; i < renderOrder.length; i++) {
    const slot = renderOrder[i];
    const h = HERO_MAP[slot.id];
    const isSpeaker = activeSpeakerId === slot.id;

    let hx = slot.x;
    let hy = slot.y;
    let facing: 1 | -1 = slot.defaultFacing;
    let moving = onBikes;
    let meleeTimer = 0;

    // During conversation, buddies naturally face the active speaker like a real group chatting!
    if (!isEpilogue && speakerPos && !isSpeaker && !onBikes) {
      facing = speakerPos.x >= hx ? 1 : -1;
    }

    // Live epilogue actions!
    let hiddenInsideVan = false;
    if (isEpilogue) {
      if (cutscene.sceneTheme === 'van_street') {
        // Heroes rush toward Vadek's open van and climb aboard as it drives off!
        const targetX = 110 + vanShift;
        const dx = targetX - hx;
        const runProgress = Math.min(1, epilogueTime * 1.15);
        hx = hx + dx * runProgress;
        hy = hy + (162 - hy) * runProgress * 0.6;
        facing = dx >= 0 ? 1 : -1;
        moving = true;
        if (epilogueTime > 0.85) hiddenInsideVan = true;
      } else if (cutscene.sceneTheme === 'market_crates') {
        if (slot.id === 'sandro') {
          hx = 205;
          hy = 166;
          facing = 1;
          meleeTimer = (Math.sin(time * 16) > 0 && epilogueTime < 1.3) ? 0.14 : 0;
        }
      } else if (cutscene.sceneTheme === 'factory_gate') {
        moving = epilogueTime > 0.5;
        hx += Math.max(0, epilogueTime - 0.5) * 32;
        facing = 1;
      } else if (cutscene.sceneTheme === 'highway_bikes') {
        hx += (slot.id === 'vadek' ? 95 : 55) * ep;
        facing = 1;
        moving = true;
      } else if (cutscene.sceneTheme === 'city_dawn') {
        // Victorious celebration hops!
        moving = false;
      }
    }

    if (hiddenInsideVan) continue;

    // Subtle glowing speaker spotlight ring
    if (isSpeaker) {
      ctx.fillStyle = 'rgba(57, 255, 20, 0.22)';
      ctx.beginPath();
      ctx.ellipse(hx, hy + 2, 24, 7, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    const zBounce =
      isEpilogue && cutscene.sceneTheme === 'city_dawn'
        ? Math.abs(Math.sin(time * 6 + i * 0.9)) * 7
        : isSpeaker
          ? Math.abs(Math.sin(time * 5.5)) * 2.2
          : 0;

    drawHeroSprite(ctx, {
      heroId: h.id,
      x: hx,
      y: hy,
      z: zBounce,
      facing,
      aimX: facing,
      aimY: 0,
      animTime: time + i * 0.45,
      moving,
      meleeTimer,
      shootTimer: 0,
      hurtTimer: 0,
      invulnTimer: 0,
      weaponId: h.nativeWeaponId,
      onBike: onBikes,
      scale: isSpeaker ? 1.04 : 0.94,
    });

    // Character idle/epilogue ambient props
    if (h.id === 'ded') {
      const puff = (time * 28) % 24;
      ctx.fillStyle = isEpilogue ? 'rgba(57, 255, 20, 0.52)' : 'rgba(57, 255, 20, 0.36)';
      ctx.beginPath();
      ctx.arc(hx + facing * 12, hy - 42 - puff, (isEpilogue ? 7 : 4.5) + puff * 0.25, 0, Math.PI * 2);
      ctx.fill();
    } else if (h.id === 'vano' && !onBikes && !isEpilogue) {
      const ballY = Math.abs(Math.sin(time * 6)) * 16;
      drawInkEllipse(ctx, hx + facing * 15, hy - 6 - ballY, 3.6, 3.6, 0, '#F8FAFC', '#FFFFFF', '#94A3B8', 0.9);
    } else if (h.id === 'koren' && !onBikes && !isEpilogue) {
      const rcX = hx + Math.sin(time * 3) * 16;
      drawRoundedRect(ctx, rcX - 6, hy + 1, 12, 5.5, 1.4, '#00E5FF', INK, 0.9);
      drawInkEllipse(ctx, rcX - 4, hy + 6.5, 2, 2, 0, '#0F172A', undefined, undefined, 0);
      drawInkEllipse(ctx, rcX + 4, hy + 6.5, 2, 2, 0, '#0F172A', undefined, undefined, 0);
    }
  }
}
