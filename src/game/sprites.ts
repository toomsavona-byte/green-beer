import { HERO_MAP, HEROES, WEAPON_MAP } from './data';
import { getGroundElevation, isDaylightLevel, tileHash } from './terrain';
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
  bikePitch?: number;
  throttling?: boolean;
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

  // Shin + realistic trouser cuff hem & fabric crease behind knee
  drawTaperedLimb(ctx, kneeX, kneeY, ankleX, ankleY, shinR, shinR * 0.78, pantsCol, pantsHi, pantsSh, 1.15);
  ctx.strokeStyle = pantsSh;
  ctx.lineWidth = 0.85;
  ctx.beginPath();
  ctx.moveTo(kneeX - 1.8, kneeY + 0.4);
  ctx.lineTo(kneeX + 1.2, kneeY + 1.2);
  ctx.stroke();

  // Pant hem cuff above boot
  if (heroId !== 'ded') {
    ctx.strokeStyle = pantsHi;
    ctx.lineWidth = 1.0;
    ctx.beginPath();
    ctx.moveTo(ankleX - 2.2, ankleY - 2.8);
    ctx.lineTo(ankleX + 2.2, ankleY - 2.6);
    ctx.stroke();
  }

  // Knee detail: ripped jeans skin peek on Vadek, armored knee pad on Koren/Zavod, subtle knee highlight on others
  if (heroId === 'vadek') {
    drawInkEllipse(ctx, kneeX + 0.8, kneeY, 1.7, 1.1, 0, skinCol, undefined, undefined, 0.7);
  } else if (heroId === 'koren' || heroId === 'zavod_killer') {
    drawInkEllipse(ctx, kneeX + 0.8, kneeY, 2.4, 2.1, -hipAngle * 0.4, '#2F3847', '#64748B', '#0F172A', 1.0);
  } else if (!isBack) {
    ctx.fillStyle = pantsHi;
    ctx.beginPath();
    ctx.ellipse(kneeX + 1.1, kneeY - 0.5, 1.1, 1.7, 0.15, 0, Math.PI * 2);
    ctx.fill();
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
    // Classic red-and-white arcade sneakers with laces
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
    drawRoundedRect(ctx, -3.2, 1.7, 9.4, 1.5, 0.5, '#F8FAFC', INK, 0.8);
    ctx.fillStyle = '#F8FAFC';
    ctx.fillRect(3.6, 0.4, 2.2, 1.3);
    ctx.fillRect(1.2, -1.2, 1.6, 0.7);
    ctx.fillRect(2.1, -0.2, 1.6, 0.7);
  } else {
    // Heavy laced combat boot with treaded welt sole & metallic eyelets
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
    // Specular leather toe shine & boot laces
    ctx.fillStyle = bootHi;
    ctx.beginPath();
    ctx.ellipse(3.6, 0.8, 1.9, 0.8, 0.25, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#94A3B8';
    ctx.fillRect(1.6, -2.5, 1.4, 0.6);
    ctx.fillRect(2.2, -1.3, 1.4, 0.6);
    // Treaded sole ridge
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
  const runPhase = safeTime * 9.8;
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
    // Forward running kinematics:
    // +cPhase bends knee UP during forward swing (d(hip)/dt > 0)
    // and straightens leg during backward ground stance push-off (d(hip)/dt < 0)!
    const s = Math.sin(runPhase);
    const cPhase = Math.cos(runPhase);
    frontHip = s * 0.72;
    frontKnee = Math.max(0.06, cPhase * 0.88 + 0.34);
    frontFoot = Math.max(-0.24, Math.min(0.32, -s * 0.22 + Math.max(0, cPhase) * 0.14));

    backHip = -s * 0.72;
    backKnee = Math.max(0.06, -cPhase * 0.88 + 0.34);
    backFoot = Math.max(-0.24, Math.min(0.32, s * 0.22 + Math.max(0, -cPhase) * 0.14));

    bodyBob = -Math.abs(cPhase) * 2.2;
    torsoLean = 0.14 + Math.abs(s) * 0.04 + hurtTilt;
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

    // Directional left highlight + right garment shadow & realistic waist hem seam
    ctx.strokeStyle = `${prof.rimColor}66`;
    ctx.lineWidth = 1.0;
    ctx.beginPath();
    ctx.moveTo(-sHalf + 1.2, -torsoH + 2.6);
    ctx.lineTo(-wHalf + 1.2, -2.5);
    ctx.stroke();

    // Subtle fabric fold shading across chest/ribs + belt strap
    ctx.strokeStyle = sh(prof.jacketColor);
    ctx.lineWidth = 0.9;
    ctx.beginPath();
    ctx.moveTo(wHalf - 1.4, -torsoH + 4);
    ctx.lineTo(wHalf - 2.2, -3.2);
    ctx.moveTo(-wHalf + 1.6, -5.2);
    ctx.lineTo(wHalf - 1.6, -5.0);
    ctx.stroke();
    // Leather belt & metallic buckle at waist
    drawRoundedRect(ctx, -wHalf + 0.5, -3.2, wHalf * 2 - 1, 2.2, 0.5, '#18181B', INK, 0.7);
    ctx.fillStyle = '#D4D4D8';
    ctx.fillRect(0.2, -3.0, 2.6, 1.8);

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
  const wheelAngle = safeTime * (o.throttling ? 28 : 18);
  const rumble = Math.sin(safeTime * (o.throttling ? 54 : 34)) * (o.throttling ? 1.15 : 0.65);

  ctx.save();
  // Tilt cruiser naturally with highway hills & dips!
  if (o.bikePitch) {
    ctx.rotate(Math.max(-0.28, Math.min(0.28, o.bikePitch)));
  }

  // Warm exhaust haze / chrome throttle burst behind twin slash-cut pipes
  if (o.throttling) {
    const puff = (safeTime * 22) % 10;
    ctx.fillStyle = `rgba(226, 232, 240, ${0.38 * (1 - puff / 10)})`;
    ctx.beginPath();
    ctx.arc(-30 - puff * 1.4, -7 + rumble, 3.2 + puff * 0.35, 0, Math.PI * 2);
    ctx.arc(-33 - puff * 1.1, -11 + rumble, 2.5 + puff * 0.3, 0, Math.PI * 2);
    ctx.fill();
    // Subtle orange-amber exhaust backfire flash
    if (Math.floor(safeTime * 22) % 3 === 0) {
      drawRoundedPoly(
        ctx,
        [
          [-28, -8.5 + rumble],
          [-34, -7.2 + rumble],
          [-28, -5.8 + rumble],
        ],
        '#FB923C',
        'transparent',
        0
      );
    }
  }

  // ── 1. WIDE CRUISER SPOKED WHEELS (Whitewall + Gleaming Chrome Rims) ──
  const wheels = [
    { wx: -20, wy: -8.5, r: 8.6 }, // Fat rear Harley tire
    { wx: 23, wy: -8.5, r: 8.2 },  // Raked-out front chopper wheel
  ];
  for (const w of wheels) {
    // Deep rubber tire
    drawInkEllipse(ctx, w.wx, w.wy, w.r, w.r, 0, '#111318', '#334155', INK, 1.35);
    // Classic whitewall ring
    ctx.strokeStyle = '#E2E8F0';
    ctx.lineWidth = 1.15;
    ctx.beginPath();
    ctx.arc(w.wx, w.wy, w.r - 2.3, 0, Math.PI * 2);
    ctx.stroke();
    // Polished chrome wheel rim
    drawInkEllipse(ctx, w.wx, w.wy, w.r - 3.3, w.r - 3.3, 0, '#94A3B8', '#FFFFFF', '#475569', 0.9);
    // Spinning chrome wire spokes
    ctx.strokeStyle = '#F8FAFC';
    ctx.lineWidth = 0.85;
    for (let s = 0; s < 4; s++) {
      const a = wheelAngle + (s * Math.PI) / 4;
      ctx.beginPath();
      ctx.moveTo(w.wx - Math.cos(a) * (w.r - 3.6), w.wy - Math.sin(a) * (w.r - 3.6));
      ctx.lineTo(w.wx + Math.cos(a) * (w.r - 3.6), w.wy + Math.sin(a) * (w.r - 3.6));
      ctx.stroke();
    }
    // Chrome axle hub
    drawInkEllipse(ctx, w.wx, w.wy, 2.0, 2.0, 0, '#E2E8F0', '#FFFFFF', '#475569', 0.8);
  }

  // ── 2. CHROME REAR & FRONT FENDERS + LOW CRUISER FRAME ──
  // Rear curved metallic fender over back wheel + ruby taillight
  ctx.strokeStyle = INK;
  ctx.lineWidth = 4.2;
  ctx.beginPath();
  ctx.arc(-20, -8.5 + rumble * 0.4, 9.6, Math.PI * 1.05, Math.PI * 1.88);
  ctx.stroke();
  ctx.strokeStyle = c(p.bikeMain);
  ctx.lineWidth = 2.6;
  ctx.beginPath();
  ctx.arc(-20, -8.5 + rumble * 0.4, 9.6, Math.PI * 1.08, Math.PI * 1.86);
  ctx.stroke();
  drawRoundedRect(ctx, -30, -14.5 + rumble * 0.5, 3.2, 3.2, 0.8, '#EF4444', INK, 0.8);

  // Chrome front fender over front tire
  ctx.strokeStyle = INK;
  ctx.lineWidth = 3.5;
  ctx.beginPath();
  ctx.arc(23, -8.5 + rumble * 0.4, 9.2, Math.PI * 1.15, Math.PI * 1.8);
  ctx.stroke();
  ctx.strokeStyle = '#E2E8F0';
  ctx.lineWidth = 1.9;
  ctx.beginPath();
  ctx.arc(23, -8.5 + rumble * 0.4, 9.2, Math.PI * 1.18, Math.PI * 1.78);
  ctx.stroke();

  // Heavy black tubular steel cruiser frame & chrome swingarm
  drawTaperedLimb(ctx, -20, -8.5 + rumble * 0.3, -6, -12 + rumble, 2.2, 2.0, '#1E293B', '#64748B', INK, 1.0);
  drawTaperedLimb(ctx, -6, -12 + rumble, 12, -24 + rumble, 2.0, 1.8, '#1E293B', '#64748B', INK, 1.0);
  drawTaperedLimb(ctx, -4, -7 + rumble, 11, -8 + rumble, 2.1, 1.9, '#334155', '#CBD5E1', INK, 1.0);

  // ── 3. ICONIC HARLEY-DAVIDSON CHROME V-TWIN ENGINE ──
  // Crankcase / chrome primary cover
  drawRoundedRect(ctx, -8, -12.5 + rumble, 14, 6.2, 2.8, '#CBD5E1', INK, 1.1);
  px(ctx, -5, -11.2 + rumble, 8, 2.0, '#FFFFFF');
  // Rear V-cylinder (tilted left)
  ctx.save();
  ctx.translate(-3.5, -13 + rumble);
  ctx.rotate(-0.36);
  drawRoundedRect(ctx, -3.5, -8.5, 7, 8.5, 1.2, '#475569', INK, 1.0);
  for (let fy = -7.2; fy <= -1.5; fy += 1.9) px(ctx, -3.2, fy, 6.4, 0.9, '#F8FAFC');
  drawRoundedRect(ctx, -4.0, -9.8, 8, 2.2, 0.8, '#E2E8F0', INK, 0.8);
  ctx.restore();
  // Front V-cylinder (tilted right)
  ctx.save();
  ctx.translate(3.2, -13 + rumble);
  ctx.rotate(0.36);
  drawRoundedRect(ctx, -3.5, -8.5, 7, 8.5, 1.2, '#475569', INK, 1.0);
  for (let fy = -7.2; fy <= -1.5; fy += 1.9) px(ctx, -3.2, fy, 6.4, 0.9, '#F8FAFC');
  drawRoundedRect(ctx, -4.0, -9.8, 8, 2.2, 0.8, '#E2E8F0', INK, 0.8);
  ctx.restore();
  // Round chrome air-cleaner cover between V cylinders
  drawInkEllipse(ctx, 0, -15.5 + rumble, 3.6, 3.2, 0, '#E2E8F0', '#FFFFFF', '#475569', 1.0);
  drawInkEllipse(ctx, 0, -15.5 + rumble, 1.3, 1.3, 0, '#1E293B', undefined, undefined, 0.6);

  // ── 4. DUAL GLEAMING CHROME SLASH-CUT EXHAUST PIPES ──
  drawTaperedLimb(ctx, 4, -14 + rumble, -2, -10.5 + rumble, 1.5, 1.5, '#CBD5E1', '#FFFFFF', '#475569', 0.95);
  drawTaperedLimb(ctx, -2, -10.5 + rumble, -28, -10.5 + rumble, 1.7, 1.9, '#E2E8F0', '#FFFFFF', '#475569', 1.05);
  drawTaperedLimb(ctx, 1, -9 + rumble, -27, -7.0 + rumble, 1.7, 1.9, '#CBD5E1', '#FFFFFF', '#334155', 1.05);

  // ── 5. CLASSIC TEARDROP FUEL TANK + CHROME BADGE ──
  drawRoundedPoly(
    ctx,
    [
      [-6, -18.5 + rumble],
      [-1, -24.5 + rumble],
      [10, -25.8 + rumble],
      [15, -22.2 + rumble],
      [11, -18.0 + rumble],
      [-3, -17.5 + rumble],
    ],
    c(p.bikeMain),
    INK,
    1.25
  );
  // Glossy metallic highlight & chrome tank badge
  drawRoundedPoly(
    ctx,
    [
      [0, -23.5 + rumble],
      [9.5, -24.4 + rumble],
      [12.5, -22.2 + rumble],
      [2, -21.8 + rumble],
    ],
    hi(p.bikeMain),
    'transparent',
    0
  );
  drawRoundedRect(ctx, 2, -22.4 + rumble, 6.5, 2.4, 0.7, '#F8FAFC', INK, 0.7);
  px(ctx, 3.2, -21.6 + rumble, 4, 0.9, c(p.bikeAccent));

  // ── 6. LONG RAKED-OUT CHROME FORKS, HIGH APE-HANGER HANDLEBARS & CHROME HEADLIGHT ──
  // Twin long telescopic chrome fork tubes (raked chopper angle!)
  drawTaperedLimb(ctx, 11.5, -27.5 + rumble, 23, -8.5, 2.0, 1.6, '#E2E8F0', '#FFFFFF', '#64748B', 1.1);
  drawTaperedLimb(ctx, 13.5, -26.5 + rumble, 24.5, -9.0, 1.6, 1.3, '#CBD5E1', '#FFFFFF', '#475569', 0.9);
  // Chrome triple-tree clamp & tall cruiser handlebars reaching back toward rider!
  drawTaperedLimb(ctx, 12, -27.5 + rumble, 8.5, -34.5 + rumble, 1.4, 1.2, '#F8FAFC', '#FFFFFF', '#475569', 1.0);
  drawTaperedLimb(ctx, 8.5, -34.5 + rumble, 4.5, -33.2 + rumble, 1.4, 1.4, '#18181B', '#52525B', INK, 0.95);
  // Chrome mirror stalk
  drawTaperedLimb(ctx, 9, -34.5 + rumble, 11, -38 + rumble, 0.7, 0.7, '#E2E8F0', '#FFFFFF', '#475569', 0.7);
  drawInkEllipse(ctx, 11.8, -38.5 + rumble, 2.1, 1.3, -0.2, '#E2E8F0', '#FFFFFF', INK, 0.8);

  // Classic round chrome Harley headlight bullet + warm daylight/highway beam
  drawInkEllipse(ctx, 17.5, -23.5 + rumble, 3.8, 3.4, 0.1, '#E2E8F0', '#FFFFFF', '#475569', 1.1);
  drawInkEllipse(ctx, 20.0, -23.5 + rumble, 2.0, 2.9, 0, '#FEF08A', '#FFFFFF', '#D97706', 0.85);
  ctx.fillStyle = 'rgba(254, 240, 138, 0.16)';
  ctx.beginPath();
  ctx.moveTo(21.5, -25.5 + rumble);
  ctx.lineTo(74, -33 + rumble);
  ctx.lineTo(74, -8 + rumble);
  ctx.lineTo(21.5, -21.5 + rumble);
  ctx.closePath();
  ctx.fill();

  // ── 7. LOW LEATHER SADDLE + CHROME SISSY BAR + HERO MODS ──
  // Low sculpted black leather saddle
  drawRoundedPoly(
    ctx,
    [
      [-18, -17.5 + rumble],
      [-11, -15.8 + rumble],
      [-3, -17.2 + rumble],
      [-5, -20.2 + rumble],
      [-17, -21.2 + rumble],
    ],
    '#18181B',
    INK,
    1.15
  );
  // Iconic tall chrome chopper sissy bar backrest
  drawTaperedLimb(ctx, -18.5, -18 + rumble, -23.5, -34 + rumble, 1.3, 1.1, '#E2E8F0', '#FFFFFF', '#475569', 1.0);
  drawRoundedRect(ctx, -23.8, -31 + rumble, 4.2, 6.5, 1.2, '#1F242D', INK, 0.9);

  // Signature hero chopper mods
  if (o.heroId === 'sandro') {
    // Bass amp saddlebag + chrome speaker
    drawRoundedRect(ctx, -28, -24 + rumble, 9, 11, 1.5, '#18181B', INK, 1.0);
    drawInkEllipse(ctx, -23.5, -18.5 + rumble, 2.8, 2.8, 0, '#C084FC', '#F5D0FE', '#581C87', 0.85);
  } else if (o.heroId === 'ded') {
    // Classic cruiser saddlebag hookah smoking into the breeze
    drawRoundedRect(ctx, -28, -21 + rumble, 8, 9, 1.6, '#9D174D', INK, 1.0);
    ctx.fillStyle = 'rgba(226, 232, 240, 0.35)';
    ctx.beginPath();
    ctx.arc(-32 - ((safeTime * 24) % 12), -24 + Math.sin(safeTime * 8) * 2, 4.5, 0, Math.PI * 2);
    ctx.fill();
  }

  // ── 8. AUTHENTIC LAID-BACK HARLEY BIKER POSTURE! ──
  // Legs stretched FORWARD onto highway pegs (classic cruiser stance!)
  drawTaperedLimb(ctx, -9, -18 + rumble, 3.5, -14.5 + rumble, 3.2, 2.7, c(prof.pantsColor), hi(prof.pantsColor), sh(prof.pantsColor), 1.15);
  drawTaperedLimb(ctx, 3.5, -14.5 + rumble, 11.5, -9.5 + rumble, 2.6, 2.2, c(prof.pantsColor), hi(prof.pantsColor), sh(prof.pantsColor), 1.15);
  // Boot resting forward on chrome highway footpeg
  drawRoundedRect(ctx, 10.2, -11.5 + rumble, 6.2, 3.8, 1.0, c(prof.bootColor), INK, 1.0);
  drawInkEllipse(ctx, 11.8, -8.5 + rumble, 1.5, 1.2, 0, '#E2E8F0', '#FFFFFF', INK, 0.7);

  // Rider leaning slightly BACK against low saddle (laid-back Harley cruiser silhouette!)
  drawRoundedPoly(
    ctx,
    [
      [-14, -18 + rumble],
      [-15.5, -33 + rumble],
      [-4.5, -33.5 + rumble],
      [-4, -18 + rumble],
    ],
    c(prof.jacketColor),
    INK,
    1.25
  );
  // Jacket lapel / collar highlight
  ctx.strokeStyle = hi(prof.jacketColor);
  ctx.lineWidth = 1.0;
  ctx.beginPath();
  ctx.moveTo(-6, -32.5 + rumble);
  ctx.lineTo(-5, -21 + rumble);
  ctx.stroke();

  // Left arm reaching FORWARD & UP to grip the high chrome Harley handlebars!
  drawTaperedLimb(ctx, -7, -30.5 + rumble, 0.5, -31.5 + rumble, 2.4, 2.0, c(prof.jacketColor), hi(prof.jacketColor), sh(prof.jacketColor), 1.05);
  drawTaperedLimb(ctx, 0.5, -31.5 + rumble, 5.8, -33.2 + rumble, 2.0, 1.7, prof.bareArms ? c(prof.skinColor) : c(prof.jacketColor), hi(prof.jacketColor), sh(prof.jacketColor), 1.0);
  drawInkEllipse(ctx, 6.0, -33.2 + rumble, 2.0, 1.8, 0, '#18181B', '#52525B', INK, 0.8);

  // Rider head (proud upright/reclined cruiser stance)
  drawInkEllipse(ctx, -9.5, -39.5 + rumble, 5.2, 5.6, -0.08, c(prof.skinColor), hi(prof.skinColor), sh(prof.skinColor), 1.2);
  // Biker sunglasses glint on highway!
  if (o.heroId !== 'koren' && o.heroId !== 'bo') {
    drawRoundedRect(ctx, -8.2, -41.2 + rumble, 5.2, 2.2, 0.6, '#0F172A', '#94A3B8', 0.6);
  }
  if (o.heroId === 'zavod_killer') {
    drawRoundedPoly(ctx, [[-15.5, -41.5 + rumble], [-13.5, -46.5 + rumble], [-5.5, -45.5 + rumble], [-3.5, -40.5 + rumble]], '#FACC15', INK, 1.15);
  } else if (o.heroId === 'koren') {
    drawRoundedRect(ctx, -11.5, -42 + rumble, 7, 3.2, 0.9, '#00E5FF', INK, 0.95);
  } else if (o.heroId === 'hooper') {
    drawRoundedPoly(ctx, [[-18.5, -41.5 + rumble], [-13.5, -45.5 + rumble], [-5.5, -44.5 + rumble], [-4.5, -41.5 + rumble]], '#DC2626', INK, 1.0);
  } else if (o.heroId === 'bo') {
    drawRoundedRect(ctx, -10.5, -41.5 + rumble, 6.2, 2.6, 0.6, '#0F172A', INK, 0.9);
    ctx.fillStyle = '#00E5FF';
    ctx.fillRect(-9.3, -40.9 + rumble, 4.2, 1.4);
  } else {
    drawRoundedPoly(ctx, [[-15.5, -41.5 + rumble], [-14.5, -45.5 + rumble], [-5.5, -45.0 + rumble], [-4.5, -41.5 + rumble]], p.hair, INK, 1.05);
  }

  // Right arm aiming mounted/handheld weapon forward!
  const localAimX = o.aimX * o.facing;
  const angle = Math.atan2(o.aimY, Math.max(0.25, localAimX));
  ctx.save();
  ctx.translate(-5, -28.5 + rumble);
  ctx.rotate(angle);
  drawWeaponInHand(ctx, o.weaponId, 4, -3, o.shootTimer > 0, safeTime);
  ctx.restore();

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
  kind: 'beer' | 'beer_bottle' | 'weapon',
  x: number,
  y: number,
  t: number,
  weaponId?: WeaponId
): void {
  const bob = Math.sin(t * 5.5) * 2.5;
  ctx.save();
  ctx.translate(Math.round(x), Math.round(y));

  ctx.fillStyle = 'rgba(0,0,0,0.48)';
  ctx.beginPath();
  ctx.ellipse(0, 2, kind === 'beer_bottle' ? 8.5 : 11, 3.4, 0, 0, Math.PI * 2);
  ctx.fill();

  if (kind === 'beer') {
    // Full Frothy Glass Beer Mug = FULL HP Restore!
    ctx.strokeStyle = 'rgba(255, 176, 0, 0.85)';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.arc(0, -9 + bob, 12.5 + Math.sin(t * 8) * 1.6, 0, Math.PI * 2);
    ctx.stroke();

    // Heavy faceted glass mug body
    box(ctx, -6.5, -16 + bob, 12, 15, '#D97706', '#FCD34D', '#78350F');
    px(ctx, -4.5, -14 + bob, 2.2, 11, '#FEF08A'); // bright glass vertical highlight
    px(ctx, 1, -14 + bob, 1.4, 11, '#B45309');    // glass facet rib
    // Thick overflowing creamy foam crown
    box(ctx, -7.5, -20 + bob, 14, 5.5, '#FEF9C3', '#FFFFFF', '#CBD5E1');
    px(ctx, -5, -15 + bob, 2.5, 3, '#FEF9C3'); // foam drip
    // Curved glass handle
    box(ctx, 5.5, -14 + bob, 4.5, 10, '#F59E0B', '#FEF08A', '#92400E');
    px(ctx, 6.5, -12 + bob, 2.2, 6, '#090C11');
    // Tiny FULL label above mug
    ctx.fillStyle = '#090C11';
    ctx.fillRect(-10, -28 + bob, 20, 7);
    ctx.fillStyle = '#FACC15';
    ctx.font = 'bold 5px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('FULL', 0, -22.5 + bob);
    ctx.textAlign = 'left';
  } else if (kind === 'beer_bottle') {
    // Classic 0.33L Amber Glass Beer Bottle = +1 HP!
    ctx.strokeStyle = 'rgba(250, 204, 21, 0.65)';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.arc(0, -10 + bob, 9.5 + Math.sin(t * 7) * 1.2, 0, Math.PI * 2);
    ctx.stroke();

    // Bottle body (warm amber-brown glass)
    box(ctx, -4, -12 + bob, 8, 12, '#92400E', '#F59E0B', '#451A03');
    // Tapered bottle neck
    box(ctx, -2.2, -19 + bob, 4.4, 7.5, '#B45309', '#FBBF24', '#451A03');
    // Metallic gold crown cap
    box(ctx, -2.6, -21 + bob, 5.2, 2.4, '#FACC15', '#FEF9C3', '#854D0E');
    // Crisp white/amber label band + specular shine
    px(ctx, -3.4, -9 + bob, 6.8, 5, '#FEF3C7');
    px(ctx, -2.5, -7.5 + bob, 5, 1.8, '#D97706');
    px(ctx, -2.8, -11.5 + bob, 1.2, 9.5, 'rgba(255,255,255,0.65)');
    // Tiny 0.33 tag
    ctx.fillStyle = '#090C11';
    ctx.fillRect(-9, -29 + bob, 18, 7);
    ctx.fillStyle = '#FEF08A';
    ctx.font = 'bold 5px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('0.33', 0, -23.5 + bob);
    ctx.textAlign = 'left';
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
      // Combat Mini-Helicopter Attack Drone with spinning twin rotors & red laser targeting sight!
      const hover = Math.sin(t * 9) * 3.2;
      const tint = e.hacked ? '#00E5FF' : '#FF2A85';
      const by = -24 + hover; // aligned directly with combat plane & z=30 laser fire

      // Laser targeting beam telegraph right before firing!
      if (e.telegraphTimer > 0 && !e.hacked) {
        ctx.strokeStyle = Math.floor(t * 24) % 2 === 0 ? 'rgba(255, 42, 133, 0.85)' : 'rgba(254, 240, 138, 0.9)';
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.moveTo(14, by + 5);
        ctx.lineTo(135, by + 18);
        ctx.stroke();
      }

      // Tail boom & miniature tail rotor
      drawTaperedLimb(ctx, -10, by, -22, by - 3, 2.2, 1.2, c('#334155'), '#94A3B8', INK, 1.0);
      ctx.fillStyle = 'rgba(226, 232, 240, 0.7)';
      ctx.beginPath();
      ctx.ellipse(-22, by - 3, 1.6, 5 + pulse * 1.2, 0, 0, Math.PI * 2);
      ctx.fill();

      // Main coaxial spinning helicopter rotor blades + hub mast
      px(ctx, -1.2, by - 13, 2.4, 7, '#64748B');
      ctx.fillStyle = 'rgba(203, 213, 225, 0.55)';
      ctx.beginPath();
      ctx.ellipse(0, by - 13, 18 + pulse * 3, 2.1, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#F8FAFC';
      ctx.lineWidth = 1.1;
      const bladeSpan = 16 * Math.cos(t * 36);
      ctx.beginPath();
      ctx.moveTo(-bladeSpan, by - 13);
      ctx.lineTo(bladeSpan, by - 13);
      ctx.stroke();

      // Armored attack helicopter fuselage & canopy
      drawRoundedPoly(
        ctx,
        [
          [-12, by - 2],
          [-6, by - 7],
          [8, by - 6],
          [15, by + 1],
          [8, by + 6],
          [-9, by + 5],
        ],
        c('#1E293B'),
        INK,
        1.25
      );
      // Glowing predatory cockpit sensor visor
      drawInkEllipse(ctx, 7, by - 1, 4.8, 2.9, 0.15, tint, '#FFFFFF', sh(tint), 0.9);
      // Flashing strobe LED on fuselage
      if (Math.floor(t * 8) % 2 === 0) {
        px(ctx, -9, by - 5, 2.5, 2.5, e.hacked ? '#00E5FF' : '#FACC15');
      }
      // Landing skids + underslung twin rotary blaster pod
      ctx.strokeStyle = '#64748B';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(-7, by + 8);
      ctx.lineTo(9, by + 8);
      ctx.stroke();
      drawRoundedRect(ctx, 2, by + 3.5, 13, 3.6, 0.8, '#475569', INK, 0.95);
      if (e.telegraphTimer > 0) {
        drawInkEllipse(ctx, 15.5, by + 5.2, 2.8, 2.8, 0, '#FEF08A', '#FFFFFF', '#FF2A85', 0.6);
      }
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

function drawSlopedGroundSurface(
  ctx: CanvasRenderingContext2D,
  levelId: LevelDef['id'],
  camX: number,
  roadFill: string,
  curbTop: string,
  curbShadow: string,
  shoulderColor?: string
): void {
  const step = 12;
  // Main sloped road/floor polygon
  ctx.fillStyle = roadFill;
  ctx.beginPath();
  ctx.moveTo(0, VIRTUAL_H);
  for (let x = 0; x <= VIRTUAL_W + step; x += step) {
    const sx = Math.min(VIRTUAL_W, x);
    const y = FLOOR_MIN_Y + getGroundElevation(levelId, camX + sx);
    ctx.lineTo(sx, y);
  }
  ctx.lineTo(VIRTUAL_W, VIRTUAL_H);
  ctx.closePath();
  ctx.fill();

  // Sloped sidewalk / curb ribbon along top edge of road
  ctx.fillStyle = curbTop;
  ctx.beginPath();
  for (let x = 0; x <= VIRTUAL_W + step; x += step) {
    const sx = Math.min(VIRTUAL_W, x);
    const y = FLOOR_MIN_Y + getGroundElevation(levelId, camX + sx);
    if (x === 0) ctx.moveTo(sx, y);
    else ctx.lineTo(sx, y);
  }
  for (let x = VIRTUAL_W; x >= 0; x -= step) {
    const y = FLOOR_MIN_Y + 6 + getGroundElevation(levelId, camX + x);
    ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.fill();

  // Crisp curb drop shadow line
  ctx.strokeStyle = curbShadow;
  ctx.lineWidth = 2;
  ctx.beginPath();
  for (let x = 0; x <= VIRTUAL_W + step; x += step) {
    const sx = Math.min(VIRTUAL_W, x);
    const y = FLOOR_MIN_Y + 6.5 + getGroundElevation(levelId, camX + sx);
    if (x === 0) ctx.moveTo(sx, y);
    else ctx.lineTo(sx, y);
  }
  ctx.stroke();

  if (shoulderColor) {
    ctx.fillStyle = shoulderColor;
    ctx.fillRect(0, VIRTUAL_H - 7, VIRTUAL_W, 7);
  }
}

function drawCyberSkyline(
  ctx: CanvasRenderingContext2D,
  level: LevelDef,
  camX: number,
  time: number,
  speedOverride?: number
): void {
  const daylight = isDaylightLevel(level.id);

  // Layer 1: Sky gradient (Bright sunlit daylight for Levels 2, 4, 6; Atmospheric night for Levels 1, 3, 5)
  const grad = ctx.createLinearGradient(0, 0, 0, FLOOR_MIN_Y + 14);
  grad.addColorStop(0, level.skyTop);
  grad.addColorStop(0.66, level.skyBottom);
  grad.addColorStop(
    1,
    daylight
      ? level.id === 2
        ? '#FEF3C7'
        : level.id === 4
          ? '#E0F2FE'
          : '#F1F5F9'
      : level.id === 3
        ? '#0E2430'
        : '#102028'
  );
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, VIRTUAL_W, FLOOR_MIN_Y + 20);

  if (daylight) {
    // Radiant daytime sun + warm atmospheric glow
    const sunX = level.id === 4 ? VIRTUAL_W - 102 : VIRTUAL_W - 76 - ((camX * 0.015) % 30);
    const sunY = level.id === 6 ? 26 : 30;
    const sunGrad = ctx.createRadialGradient(sunX, sunY, 4, sunX, sunY, 58);
    sunGrad.addColorStop(0, 'rgba(255, 251, 235, 0.95)');
    sunGrad.addColorStop(0.32, 'rgba(254, 240, 138, 0.45)');
    sunGrad.addColorStop(1, 'rgba(254, 240, 138, 0)');
    ctx.fillStyle = sunGrad;
    ctx.beginPath();
    ctx.arc(sunX, sunY, 58, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#FFFBEB';
    ctx.beginPath();
    ctx.arc(sunX, sunY, 12, 0, Math.PI * 2);
    ctx.fill();

    // Fluffy sunlit cumulus clouds drifting smoothly
    const cloudScroll = Math.floor((speedOverride ?? camX * 0.07) + time * 5);
    for (let i = -1; i < 7; i++) {
      const cx = i * 108 - (cloudScroll % 108);
      const cy = 18 + (tileHash(i, level.id * 7) % 3) * 11;
      ctx.fillStyle = 'rgba(255, 255, 255, 0.82)';
      ctx.beginPath();
      ctx.ellipse(cx + 28, cy + 5, 26, 7, 0, 0, Math.PI * 2);
      ctx.ellipse(cx + 18, cy + 1, 15, 7, 0, 0, Math.PI * 2);
      ctx.ellipse(cx + 38, cy + 2, 17, 6.5, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(203, 213, 225, 0.35)';
      ctx.fillRect(cx + 6, cy + 8, 44, 2.5);
    }

    // Soaring coastal birds on outdoor sunny levels (2 & 4)
    if (level.id === 2 || level.id === 4) {
      ctx.strokeStyle = '#334155';
      ctx.lineWidth = 1;
      for (let b = 0; b < 4; b++) {
        const bx = ((b * 127 + time * (16 + b * 4)) % (VIRTUAL_W + 40)) - 20;
        const by = 24 + b * 9 + Math.sin(time * 5 + b) * 2;
        const flap = Math.sin(time * 9 + b * 2) * 2.5;
        ctx.beginPath();
        ctx.moveTo(bx - 4, by + flap);
        ctx.quadraticCurveTo(bx - 1, by - 2, bx, by);
        ctx.quadraticCurveTo(bx + 1, by - 2, bx + 4, by + flap);
        ctx.stroke();
      }
    }

    // Distant sunlit mountain / coastal ridge in atmospheric blue haze
    const mtnScroll = Math.floor((speedOverride !== undefined ? speedOverride * 0.14 : camX * 0.1));
    ctx.fillStyle = level.id === 2 ? '#93C5FD' : level.id === 4 ? '#7DD3FC' : '#BAE6FD';
    ctx.beginPath();
    ctx.moveTo(0, FLOOR_MIN_Y + 14);
    for (let x = -40; x <= VIRTUAL_W + 60; x += 48) {
      const idx = Math.floor((x + mtnScroll) / 48);
      const sx = idx * 48 - mtnScroll;
      const peak = 32 + (tileHash(idx, level.id * 13) % 34);
      ctx.lineTo(sx, FLOOR_MIN_Y - peak);
    }
    ctx.lineTo(VIRTUAL_W + 60, FLOOR_MIN_Y + 14);
    ctx.closePath();
    ctx.fill();

    // Distant sunlit city silhouette (non-repeating hashed blocks)
    const farScroll = Math.floor(speedOverride !== undefined ? speedOverride * 0.28 : camX * 0.2);
    const farW = 50;
    const startFar = Math.floor(farScroll / farW) - 1;
    for (let k = 0; k < 12; k++) {
      const wIdx = startFar + k;
      const bx = wIdx * farW - farScroll;
      const h = tileHash(wIdx, level.id * 31);
      const bh = 38 + (h % 6) * 10;
      const bw = 34 + (h % 4) * 5;
      const topY = FLOOR_MIN_Y - bh - 4;
      const wallCol = h % 3 === 0 ? '#94A3B8' : h % 3 === 1 ? '#CBD5E1' : '#A8B9CC';
      const sunCol = '#F1F5F9';

      px(ctx, bx, topY, bw, bh + 16, wallCol);
      px(ctx, bx, topY, 3, bh + 16, sunCol); // Sunlit left edge
      px(ctx, bx, topY, bw, 2, '#E2E8F0');
      // Subtle daytime sky-reflecting glass windows
      for (let wy = topY + 6; wy < FLOOR_MIN_Y - 12; wy += 8) {
        for (let wxOff = 6; wxOff < bw - 7; wxOff += 9) {
          if ((h + wy + wxOff) % 4 !== 0) {
            px(ctx, bx + wxOff, wy, 4.5, 3, '#64748B');
            px(ctx, bx + wxOff, wy, 4.5, 1, '#BAE6FD');
          }
        }
      }
      if (h % 5 === 0) {
        px(ctx, bx + bw / 2 - 1, topY - 14, 2, 14, '#64748B');
      }
    }
    return;
  }

  // ── DARK NIGHT SKYLINE (Levels 1 & 3) ──
  const moonX = VIRTUAL_W - 88 - ((camX * 0.025) % 40);
  const moonGrad = ctx.createRadialGradient(moonX, 34, 4, moonX, 34, 48);
  moonGrad.addColorStop(0, 'rgba(226, 232, 240, 0.34)');
  moonGrad.addColorStop(0.5, 'rgba(57, 255, 20, 0.10)');
  moonGrad.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = moonGrad;
  ctx.beginPath();
  ctx.arc(moonX, 34, 48, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#E2E8F0';
  ctx.beginPath();
  ctx.arc(moonX, 34, 10.5, 0, Math.PI * 2);
  ctx.fill();

  // Drifting night clouds
  const cloudScroll = Math.floor((speedOverride ?? camX * 0.09) + time * 5);
  for (let i = -1; i < 7; i++) {
    const cx = i * 96 - (cloudScroll % 96);
    px(ctx, cx, 14 + (i % 2) * 10, 74, 8, 'rgba(255,255,255,0.04)');
    px(ctx, cx + 18, 10 + (i % 2) * 10, 44, 5, 'rgba(57,255,20,0.05)');
  }

  // Distant varied night skyline (hashed, non-repeating silhouettes)
  const farScroll = Math.floor(speedOverride !== undefined ? speedOverride * 0.32 : camX * 0.22);
  const farW = 54;
  const startFar = Math.floor(farScroll / farW) - 1;
  for (let k = 0; k < 12; k++) {
    const wIdx = startFar + k;
    const bx = wIdx * farW - farScroll;
    const h = tileHash(wIdx, level.id * 43);
    const bh = 46 + (h % 7) * 10;
    const bw = 40 + (h % 3) * 6;
    const topY = FLOOR_MIN_Y - bh - 6;
    const archType = h % 5;

    ctx.fillStyle = archType === 2 ? '#101626' : '#0B101B';
    if (archType === 1) {
      ctx.beginPath();
      ctx.moveTo(bx - 4, FLOOR_MIN_Y + 14);
      ctx.lineTo(bx + 10, topY + 6);
      ctx.lineTo(bx + bw - 10, topY + 6);
      ctx.lineTo(bx + bw + 4, FLOOR_MIN_Y + 14);
      ctx.closePath();
      ctx.fill();
      px(ctx, bx + 11, topY + 6, bw - 22, 2, '#39FF14');
    } else {
      px(ctx, bx, topY, bw, bh + 20, archType === 3 ? '#0E1624' : '#0B101B');
      px(ctx, bx + 1, topY, bw - 2, 2, archType === 0 ? '#334155' : '#1E293B');
    }

    if (archType === 0) {
      px(ctx, bx + bw / 2 - 1, topY - 20, 2, 20, '#334155');
      if (Math.floor(time * 2.5 + wIdx) % 2 === 0) {
        px(ctx, bx + bw / 2 - 2, topY - 22, 4, 3, '#FF2A85');
      }
    } else if (archType === 2) {
      px(ctx, bx + 4, topY + 8, 2, bh - 16, h % 2 === 0 ? '#00E5FF' : '#FF2A85');
    }

    for (let wy = topY + 8; wy < FLOOR_MIN_Y - 12; wy += 8) {
      for (let wxOff = 6; wxOff < bw - 10; wxOff += 11) {
        if ((h + wy + wxOff) % 5 !== 0) {
          const wCol =
            (h + wy) % 7 === 0
              ? '#FDE047'
              : (h + wxOff) % 4 === 0
                ? '#00E5FF'
                : '#1F3A3D';
          px(ctx, bx + wxOff, wy, 5, 2.5, wCol);
        }
      }
    }
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
  // LEVEL 1 (DARK): NIGHT CITY STREETS, REALISTIC NON-REPEATING BLOCKS & BARS
  // =========================================================================
  if (level.id === 1) {
    drawCyberSkyline(ctx, level, camX, time);

    const tileW = 128;
    const startIdx = Math.floor(midScroll / tileW) - 1;
    for (let k = 0; k < 6; k++) {
      const wIdx = startIdx + k;
      const wx = wIdx * tileW - midScroll;
      const h = tileHash(wIdx, 11);
      const variant = h % 9;
      const neonBlink = Math.sin(time * 7 + wIdx * 2.3) > -0.78;
      // Anchor each city block smoothly to local street hill elevation
      const blockWorldX = camX + wx + tileW * 0.5;
      const el = Math.round(getGroundElevation(1, blockWorldX));
      const base = FLOOR_MIN_Y + el;

      ctx.save();
      ctx.translate(0, el);

      if (variant === 0) {
        // Neighborhood Pub «GREEN BEER» with brick facade, drainpipe & warm doorway
        px(ctx, wx, 38, 124, FLOOR_MIN_Y - 22, '#171E2C');
        px(ctx, wx + 3, 42, 118, FLOOR_MIN_Y - 28, '#20293B');
        for (let by = 50; by < FLOOR_MIN_Y; by += 10) px(ctx, wx + 4, by, 116, 1, '#141B27');
        px(ctx, wx - 1, 35, 126, 4, '#334155');
        px(ctx, wx + 118, 38, 3, FLOOR_MIN_Y - 28, '#475569'); // rain gutter pipe
        box(ctx, wx + 90, 44, 22, 14, '#334155', '#64748B', '#0F172A');
        box(ctx, wx + 10, 46, 74, 20, '#090C11', neonBlink ? '#39FF14' : '#1E293B', '#090C11');
        if (neonBlink) {
          ctx.fillStyle = '#39FF14';
          ctx.font = 'bold 8px monospace';
          ctx.fillText('GREEN BEER', wx + 16, 59);
        }
        box(ctx, wx + 16, 94, 42, 58, '#0B1018', '#334155', INK);
        px(ctx, wx + 20, 98, 34, 24, 'rgba(251,191,36,0.22)');
        box(ctx, wx + 68, 128, 16, 22, '#334155', '#64748B', INK); // metal trash bin
      } else if (variant === 1) {
        // 24/7 Corner Shop «ПРОДУКТЫ 24» + Awning + Vending Machine
        px(ctx, wx, 46, 124, FLOOR_MIN_Y - 30, '#1D1A2B');
        px(ctx, wx + 4, 50, 116, FLOOR_MIN_Y - 36, '#272239');
        box(ctx, wx + 6, 82, 78, 13, '#9D174D', '#F472B6', INK);
        for (let st = 0; st < 72; st += 14) px(ctx, wx + 8 + st, 83, 6, 11, '#111827');
        box(ctx, wx + 10, 56, 72, 18, '#090C11', '#00E5FF', INK);
        ctx.fillStyle = '#00E5FF';
        ctx.font = 'bold 7px monospace';
        ctx.fillText('ПРОДУКТЫ 24', wx + 14, 68);
        box(ctx, wx + 10, 98, 68, 42, '#0B111C', '#475569', INK);
        px(ctx, wx + 14, 102, 60, 26, 'rgba(254,240,138,0.16)');
        box(ctx, wx + 88, 112, 26, 38, '#1E293B', '#38BDF8', INK);
        for (let r = 0; r < 3; r++) px(ctx, wx + 93, 118 + r * 5, 16, 2.5, r === 1 ? '#39FF14' : '#FFB000');
      } else if (variant === 2) {
        // Urban Bus Stop Shelter + Street Bench + Parked 90s Sedan + Glowing Streetlamp
        // Low brick courtyard wall behind bus stop
        px(ctx, wx, 84, 124, FLOOR_MIN_Y - 68, '#161C26');
        px(ctx, wx, 82, 124, 3, '#334155');
        // Glass bus shelter
        box(ctx, wx + 8, 94, 54, 4, '#334155', '#94A3B8', INK);
        px(ctx, wx + 12, 98, 2, 52, '#64748B');
        px(ctx, wx + 56, 98, 2, 52, '#64748B');
        px(ctx, wx + 14, 100, 42, 34, 'rgba(148,163,184,0.12)');
        box(ctx, wx + 18, 104, 16, 22, '#090C11', '#FACC15', INK); // transit map poster
        box(ctx, wx + 22, 136, 30, 5, '#78350F', '#D97706', INK); // wooden bench
        // Parked dark 90s hatchback silhouette at curb
        drawRoundedPoly(ctx, [[wx + 68, 148], [wx + 72, 134], [wx + 86, 124], [wx + 108, 124], [wx + 118, 134], [wx + 120, 148]], '#1E293B', INK, 1.1);
        px(ctx, wx + 86, 127, 18, 7, '#0F172A');
        drawInkEllipse(ctx, wx + 80, 148, 5, 5, 0, '#090C11', '#475569', INK, 0.9);
        drawInkEllipse(ctx, wx + 110, 148, 5, 5, 0, '#090C11', '#475569', INK, 0.9);
        px(ctx, wx + 118, 137, 3, 4, '#EF4444'); // taillight
        // Tall warm sodium streetlight
        px(ctx, wx + 62, 42, 3, 108, '#475569');
        px(ctx, wx + 56, 42, 12, 4, '#94A3B8');
        px(ctx, wx + 57, 46, 8, 2, '#FEF08A');
        ctx.fillStyle = 'rgba(254, 240, 138, 0.08)';
        ctx.beginPath();
        ctx.moveTo(wx + 56, 48);
        ctx.lineTo(wx + 32, FLOOR_MIN_Y + 8);
        ctx.lineTo(wx + 92, FLOOR_MIN_Y + 8);
        ctx.lineTo(wx + 66, 48);
        ctx.closePath();
        ctx.fill();
      } else if (variant === 3) {
        // Multi-Story Apartment Block with Balconies, AC Units & Iron Fire Escape
        px(ctx, wx, 22, 124, FLOOR_MIN_Y - 6, '#1B2230');
        px(ctx, wx + 4, 26, 116, FLOOR_MIN_Y - 12, '#242D40');
        for (let wy = 36; wy < 124; wy += 24) {
          for (let wx2 = 12; wx2 < 102; wx2 += 34) {
            const lit = (h + wy + wx2) % 3 !== 0;
            box(ctx, wx + wx2, wy, 20, 15, lit ? '#2A3A40' : '#0D121B', '#475569', INK);
            if (lit) px(ctx, wx + wx2 + 3, wy + 3, 14, 9, (wy + wx2) % 2 === 0 ? 'rgba(251,191,36,0.34)' : 'rgba(56,189,248,0.28)');
          }
        }
        // Concrete balcony railings + AC box
        box(ctx, wx + 10, 74, 48, 8, '#334155', '#64748B', INK);
        box(ctx, wx + 66, 62, 14, 10, '#475569', '#94A3B8', INK);
        px(ctx, wx + 69, 65, 5, 5, '#0F172A');
        // Steel stairwell diagonal
        ctx.strokeStyle = '#64748B';
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.moveTo(wx + 16, 82);
        ctx.lineTo(wx + 50, 116);
        ctx.lineTo(wx + 24, 148);
        ctx.stroke();
      } else if (variant === 4) {
        // Concrete Metro Overpass Bridge + Alupka Rock Poster + Chain-Link Fence
        px(ctx, wx, 26, 128, 18, '#1E293B');
        px(ctx, wx, 44, 128, 3, '#00E5FF');
        box(ctx, wx + 8, 46, 24, FLOOR_MIN_Y - 30, '#263040', '#475569', '#0F172A');
        box(ctx, wx + 94, 46, 24, FLOOR_MIN_Y - 30, '#263040', '#475569', '#0F172A');
        px(ctx, wx + 32, 78, 62, FLOOR_MIN_Y - 62, '#0D131D');
        for (let fx = 36; fx < 92; fx += 8) px(ctx, wx + fx, 80, 1, FLOOR_MIN_Y - 64, 'rgba(148,163,184,0.22)');
        box(ctx, wx + 10, 82, 20, 30, '#443931', '#A8A29E', '#1C1917');
        ctx.fillStyle = '#FEF08A';
        ctx.font = 'bold 5px monospace';
        ctx.fillText('ALUPKA', wx + 11, 93);
        ctx.fillStyle = '#FF2A85';
        ctx.fillText('ROCK', wx + 13, 101);
      } else if (variant === 5) {
        // Late-Night Shawarma & Coffee Kiosk + Tree Planter
        px(ctx, wx, 72, 124, FLOOR_MIN_Y - 56, '#131924');
        box(ctx, wx + 8, 76, 76, 74, '#27222D', '#475569', INK);
        box(ctx, wx + 12, 82, 68, 16, '#090C11', '#FFB000', INK);
        ctx.fillStyle = '#FFB000';
        ctx.font = 'bold 7px monospace';
        ctx.fillText('ШАУРМА · КОФЕ', wx + 16, 93);
        box(ctx, wx + 16, 102, 58, 26, '#0F172A', '#64748B', INK);
        px(ctx, wx + 20, 106, 50, 18, 'rgba(251,146,60,0.3)');
        // Urban deciduous tree in concrete planter
        box(ctx, wx + 94, 134, 24, 16, '#334155', '#64748B', INK);
        px(ctx, wx + 104, 102, 4, 34, '#451A03');
        drawInkEllipse(ctx, wx + 106, 92, 16, 14, 0, '#14532D', '#22C55E', '#052E16', 1.0);
      } else if (variant === 6) {
        // Quarantine Warning Billboard + Burning Oil Drum + Police Barricade
        px(ctx, wx, 58, 124, FLOOR_MIN_Y - 42, '#141923');
        box(ctx, wx + 8, 24, 108, 40, '#090C11', '#FF2A85', INK);
        ctx.fillStyle = '#FF2A85';
        ctx.font = 'bold 8px monospace';
        ctx.fillText('VIRUS PIZED-77', wx + 22, 40);
        ctx.fillStyle = '#39FF14';
        ctx.font = 'bold 7px monospace';
        ctx.fillText('QUARANTINE ZONE', wx + 22, 54);
        for (let bx = 12; bx < 76; bx += 12) {
          px(ctx, wx + bx, 134, 6, 14, '#FACC15');
          px(ctx, wx + bx + 6, 134, 6, 14, '#090C11');
        }
        box(ctx, wx + 90, 126, 20, 24, '#334155', '#64748B', INK);
        const fl = Math.sin(time * 16 + wIdx) * 3;
        ctx.fillStyle = '#F97316';
        ctx.beginPath();
        ctx.moveTo(wx + 93, 126);
        ctx.lineTo(wx + 100, 108 + fl);
        ctx.lineTo(wx + 107, 126);
        ctx.fill();
      } else if (variant === 7) {
        // Brick Pharmacy «АПТЕКА» with Glowing Green Cross & Arched Windows
        px(ctx, wx, 34, 124, FLOOR_MIN_Y - 18, '#281E24');
        px(ctx, wx + 3, 38, 118, FLOOR_MIN_Y - 24, '#36272E');
        box(ctx, wx + 14, 52, 62, 18, '#090C11', '#22C55E', INK);
        ctx.fillStyle = '#4ADE80';
        ctx.font = 'bold 8px monospace';
        ctx.fillText('АПТЕКА 24', wx + 22, 64);
        // Glowing pharmacy green cross sign
        px(ctx, wx + 90, 56, 16, 5, '#22C55E');
        px(ctx, wx + 95.5, 50.5, 5, 16, '#22C55E');
        box(ctx, wx + 16, 86, 40, 46, '#0F172A', '#64748B', INK);
        px(ctx, wx + 20, 90, 32, 34, 'rgba(134,239,172,0.16)');
        box(ctx, wx + 68, 92, 38, 58, '#1E293B', '#475569', INK);
      } else {
        // Night Club «CLUB PIZED-77» with Equalizer Window & Neon Doorway
        px(ctx, wx, 36, 124, FLOOR_MIN_Y - 20, '#161124');
        box(ctx, wx + 12, 44, 100, 22, '#090C11', '#FF2A85', INK);
        ctx.fillStyle = neonBlink ? '#FF2A85' : '#831843';
        ctx.font = 'bold 9px monospace';
        ctx.fillText('CLUB PIZED-77', wx + 20, 58);
        box(ctx, wx + 14, 76, 46, 36, '#090C11', '#334155', INK);
        for (let b = 0; b < 6; b++) {
          const bh = 6 + Math.abs(Math.sin(time * 9 + b * 1.1)) * 22;
          px(ctx, wx + 18 + b * 7, 108 - bh, 5, bh, b % 2 === 0 ? '#39FF14' : '#00E5FF');
        }
        box(ctx, wx + 72, 86, 40, 64, '#0B0F17', '#FF2A85', INK);
        px(ctx, wx + 76, 92, 32, 26, 'rgba(255,42,133,0.22)');
      }

      ctx.restore();
      void base;
    }

    // Smooth Sloped Wet Dark Asphalt + Sloped Curb!
    drawSlopedGroundSurface(ctx, 1, camX, '#111622', '#2D3A4F', '#070A0F');

    const roadTile = 92;
    const roadStart = Math.floor(camX / roadTile) - 1;
    for (let k = 0; k < 8; k++) {
      const rIdx = roadStart + k;
      const rx = rIdx * roadTile - camX;
      const rEl = getGroundElevation(1, rIdx * roadTile + 24);
      px(ctx, rx + 8, 206 + rEl, 34, 3, '#334155');
      px(ctx, rx + 12, FLOOR_MIN_Y + 8 + rEl, 18, 5, '#070A0F');
      if (tileHash(rIdx, 91) % 3 === 0) {
        const st = (time * 24 + rIdx * 11) % 24;
        ctx.fillStyle = `rgba(203, 213, 225, ${0.22 * (1 - st / 24)})`;
        ctx.beginPath();
        ctx.arc(rx + 21 + Math.sin(time * 3 + rIdx) * 3, FLOOR_MIN_Y + 8 + rEl - st, 4 + st * 0.25, 0, Math.PI * 2);
        ctx.fill();
      }
      if (tileHash(rIdx, 93) % 5 === 0) {
        for (let cy = FLOOR_MIN_Y + 14; cy < VIRTUAL_H - 12; cy += 14) {
          px(ctx, rx + 42, cy + rEl, 24, 6, 'rgba(226, 232, 240, 0.14)');
        }
      }
      px(ctx, rx + 24, 174 + rEl, 26, 4, rIdx % 2 === 0 ? 'rgba(57, 255, 20, 0.16)' : 'rgba(0, 229, 255, 0.16)');
    }

    // Diagonal night rain streaks
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
  // LEVEL 2 (LIGHT): SUNNY DAYTIME SOUTHERN MARKET, PROMENADE & WATERFRONT!
  // =========================================================================
  } else if (level.id === 2) {
    drawCyberSkyline(ctx, level, camX, time);

    // Sparkling sunlit southern sea bay behind the market promenade!
    const seaGrad = ctx.createLinearGradient(0, FLOOR_MIN_Y - 38, 0, FLOOR_MIN_Y + 12);
    seaGrad.addColorStop(0, '#0284C7');
    seaGrad.addColorStop(0.55, '#38BDF8');
    seaGrad.addColorStop(1, '#7DD3FC');
    ctx.fillStyle = seaGrad;
    ctx.fillRect(0, FLOOR_MIN_Y - 36, VIRTUAL_W, 48);
    // Animated sunlight glints on waves
    for (let w = 0; w < 18; w++) {
      const wx = ((w * 37 - Math.floor(camX * 0.25 + time * 14)) % VIRTUAL_W + VIRTUAL_W) % VIRTUAL_W;
      px(ctx, wx, FLOOR_MIN_Y - 30 + (w % 4) * 6, 14, 1.5, 'rgba(255, 255, 255, 0.65)');
    }

    const tileW = 128;
    const startIdx = Math.floor(midScroll / tileW) - 1;
    for (let k = 0; k < 6; k++) {
      const wIdx = startIdx + k;
      const sx = wIdx * tileW - midScroll;
      const h = tileHash(wIdx, 22);
      const variant = h % 9;
      const el = Math.round(getGroundElevation(2, camX + sx + tileW * 0.5));

      ctx.save();
      ctx.translate(0, el);

      if (variant === 0) {
        // Sunlit Striped Market Stall with Wooden Fruit/Beer Crates & Awning Shadow
        box(ctx, sx + 6, 62, 112, 15, '#DC2626', '#FCA5A5', '#7F1D1D');
        for (let st = 0; st < 106; st += 16) px(ctx, sx + 8 + st, 63, 8, 13, '#FFFBEB');
        px(ctx, sx + 10, 77, 4, 75, '#78350F');
        px(ctx, sx + 110, 77, 4, 75, '#78350F');
        px(ctx, sx + 14, 78, 96, 8, 'rgba(15,23,42,0.18)'); // crisp daytime awning shadow
        box(ctx, sx + 14, 116, 96, 36, '#D6C7B2', '#F5EFE6', '#78716C');
        box(ctx, sx + 20, 100, 22, 16, '#15803D', '#4ADE80', '#052E16');
        box(ctx, sx + 46, 100, 22, 16, '#EA580C', '#FDBA74', '#7C2D12');
        box(ctx, sx + 74, 102, 26, 14, '#B45309', '#FDE047', '#451A03');
      } else if (variant === 1) {
        // Sunlit Whitewashed Southern Market Archway with Terracotta Roof & Cypress Tree
        box(ctx, sx + 8, 36, 16, FLOOR_MIN_Y - 22, '#F5F0E6', '#FFFFFF', '#A8A29E');
        box(ctx, sx + 100, 36, 16, FLOOR_MIN_Y - 22, '#F5F0E6', '#FFFFFF', '#A8A29E');
        box(ctx, sx + 4, 28, 116, 22, '#F5F0E6', '#FFFFFF', '#A8A29E');
        // Terracotta tiled roof eaves
        box(ctx, sx + 2, 22, 120, 8, '#C2410C', '#FB923C', '#7C2D12');
        ctx.fillStyle = '#0F172A';
        ctx.font = 'bold 8px monospace';
        ctx.fillText('ЮЖНЫЙ РЫНОК', sx + 24, 42);
        // Sunlit green cypress tree peeking behind arch
        drawRoundedPoly(ctx, [[sx + 58, 126], [sx + 65, 62], [sx + 72, 126]], '#15803D', INK, 1.0);
        px(ctx, sx + 64, 126, 3, 24, '#78350F');
      } else if (variant === 2) {
        // Open Waterfront Stone Balustrade Overlooking Sunny Sea + Palm Tree & Wooden Bench!
        // Stone parapet railing
        box(ctx, sx, 118, 128, 34, '#E7E5E4', '#FFFFFF', '#A8A29E');
        for (let b = 8; b < 120; b += 14) {
          px(ctx, sx + b, 124, 6, 18, '#7DD3FC'); // sea visible through stone balusters!
        }
        // Wooden promenade bench
        box(ctx, sx + 16, 134, 42, 6, '#B45309', '#FBBF24', '#451A03');
        px(ctx, sx + 20, 140, 3, 12, '#334155');
        px(ctx, sx + 51, 140, 3, 12, '#334155');
        // Tall sunlit southern palm tree!
        ctx.strokeStyle = '#92400E';
        ctx.lineWidth = 5;
        ctx.beginPath();
        ctx.moveTo(sx + 96, 150);
        ctx.quadraticCurveTo(sx + 92, 108, sx + 100, 68);
        ctx.stroke();
        for (const ang of [-2.4, -1.7, -0.9, -0.2, 0.5]) {
          ctx.strokeStyle = '#15803D';
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.moveTo(sx + 100, 68);
          ctx.quadraticCurveTo(
            sx + 100 + Math.cos(ang) * 18,
            68 + Math.sin(ang) * 14 - 4,
            sx + 100 + Math.cos(ang) * 30,
            68 + Math.sin(ang) * 20 + 8
          );
          ctx.stroke();
        }
      } else if (variant === 3) {
        // Sunlit Harbor Shipping Containers (Teal & Golden Ochre)
        box(ctx, sx + 4, 86, 118, 66, '#0E7490', '#67E8F9', '#164E63');
        for (let rib = 12; rib < 114; rib += 10) px(ctx, sx + rib, 90, 2, 58, '#155E75');
        box(ctx, sx + 16, 38, 96, 48, '#D97706', '#FDE047', '#92400E');
        for (let rib = 24; rib < 106; rib += 10) px(ctx, sx + rib, 42, 2, 40, '#B45309');
        ctx.fillStyle = '#FFFFFF';
        ctx.font = 'bold 7px monospace';
        ctx.fillText('ALUPKA CARGO', sx + 28, 64);
        ctx.fillStyle = '#ECFCCB';
        ctx.fillText('PORT-77', sx + 38, 122);
      } else if (variant === 4) {
        // Sunny Outdoor Street Cafe with Striped Umbrellas & Bistro Tables
        px(ctx, sx + 4, 52, 118, FLOOR_MIN_Y - 36, '#FEF3C7');
        px(ctx, sx + 4, 48, 118, 5, '#D97706');
        box(ctx, sx + 14, 58, 96, 16, '#1E293B', '#FACC15', INK);
        ctx.fillStyle = '#FEF08A';
        ctx.font = 'bold 8px monospace';
        ctx.fillText('БУЙВОЛ-ГРИЛЬ', sx + 24, 69);
        // Sunlit windows
        box(ctx, sx + 14, 82, 42, 34, '#BAE6FD', '#FFFFFF', '#64748B');
        box(ctx, sx + 66, 82, 42, 34, '#BAE6FD', '#FFFFFF', '#64748B');
        // Cafe sun umbrella & table
        drawRoundedPoly(ctx, [[sx + 20, 122], [sx + 44, 108], [sx + 68, 122]], '#0284C7', INK, 1.0);
        px(ctx, sx + 43, 122, 2, 28, '#475569');
        box(ctx, sx + 32, 134, 24, 4, '#FFFFFF', '#F8FAFC', '#94A3B8');
      } else if (variant === 5) {
        // Sunlit Terracotta Coastal Apartment House with Balconies & Hanging Laundry
        px(ctx, sx + 2, 28, 122, FLOOR_MIN_Y - 12, '#FDE68A');
        px(ctx, sx + 0, 22, 126, 7, '#B45309'); // terracotta cornice
        for (let wy = 40; wy < 118; wy += 34) {
          for (let wx2 = 14; wx2 < 96; wx2 += 48) {
            box(ctx, sx + wx2, wy, 28, 22, '#38BDF8', '#E0F2FE', '#0369A1');
            // Wooden green shutters
            box(ctx, sx + wx2 - 6, wy, 6, 22, '#15803D', '#4ADE80', '#052E16');
            box(ctx, sx + wx2 + 28, wy, 6, 22, '#15803D', '#4ADE80', '#052E16');
          }
        }
        // Flower boxes & clothesline
        box(ctx, sx + 12, 62, 32, 5, '#9A3412', '#FB923C', INK);
        px(ctx, sx + 16, 59, 6, 3, '#EF4444');
        px(ctx, sx + 28, 59, 6, 3, '#FACC15');
      } else if (variant === 6) {
        // Sunny Harbor Crane & Suspended Green Beer Keg
        px(ctx, sx + 12, 26, 6, FLOOR_MIN_Y - 10, '#64748B');
        px(ctx, sx + 12, 26, 94, 6, '#F59E0B');
        for (let s = 16; s < 100; s += 12) px(ctx, sx + s, 26, 6, 6, '#1E293B');
        const kegBob = Math.sin(time * 2.5 + wIdx) * 4;
        px(ctx, sx + 68, 32, 2, 34 + kegBob, '#475569');
        box(ctx, sx + 54, 66 + kegBob, 30, 36, '#15803D', '#4ADE80', INK);
        px(ctx, sx + 58, 78 + kegBob, 22, 8, '#39FF14');
        box(ctx, sx + 28, 134, 80, 18, '#A16207', '#FDE047', '#451A03');
      } else if (variant === 7) {
        // Coastal Fish & Craft Beer Kiosk with Blue-White Striped Awning
        px(ctx, sx + 6, 64, 112, FLOOR_MIN_Y - 48, '#F1F5F9');
        box(ctx, sx + 6, 64, 112, 14, '#0284C7', '#7DD3FC', '#0C4A6E');
        for (let st = 0; st < 106; st += 16) px(ctx, sx + 8 + st, 65, 8, 12, '#FFFFFF');
        box(ctx, sx + 16, 86, 92, 32, '#0F172A', '#38BDF8', INK);
        px(ctx, sx + 22, 92, 80, 20, '#E0F2FE');
        box(ctx, sx + 12, 122, 100, 30, '#CBD5E1', '#FFFFFF', '#64748B');
      } else {
        // Open Sunlit Market Warehouse Bay with Corrugated Shutter
        px(ctx, sx + 2, 38, 122, FLOOR_MIN_Y - 22, '#E2E8F0');
        box(ctx, sx + 14, 54, 98, 98, '#334155', '#94A3B8', INK);
        for (let ry = 56; ry < 92; ry += 6) px(ctx, sx + 16, ry, 94, 4, '#64748B');
        px(ctx, sx + 18, 94, 90, 56, '#1E293B');
        box(ctx, sx + 26, 122, 26, 26, '#16A34A', '#86EFAC', INK);
        box(ctx, sx + 58, 126, 22, 22, '#EA580C', '#FDBA74', INK);
      }

      ctx.restore();
    }

    // Smooth Sloped Sunlit Sandstone/Concrete Market Street!
    drawSlopedGroundSurface(ctx, 2, camX, '#CFC7B8', '#E7E2D8', '#9C9486');
    const tScroll = Math.floor(camX / 56) - 1;
    for (let k = 0; k < 11; k++) {
      const idx = tScroll + k;
      const rx = idx * 56 - camX;
      const rEl = getGroundElevation(2, idx * 56 + 24);
      // Warm sunlit paving joints & realistic daytime shadows
      px(ctx, rx, FLOOR_MIN_Y + 7 + rEl, 1, VIRTUAL_H - FLOOR_MIN_Y, 'rgba(120, 113, 108, 0.35)');
      px(ctx, rx + 8, 198 + rEl, 38, 1.5, 'rgba(120, 113, 108, 0.25)');
      if (tileHash(idx, 27) % 4 === 0) {
        px(ctx, rx + 14, 184 + rEl, 20, 4, 'rgba(34, 197, 94, 0.24)'); // green beer spill
      }
      if (tileHash(idx, 29) % 5 === 1) {
        // Sunlit crosswalk stripes
        for (let cy = FLOOR_MIN_Y + 14; cy < VIRTUAL_H - 12; cy += 14) {
          px(ctx, rx + 12, cy + rEl, 26, 6, 'rgba(255, 255, 255, 0.45)');
        }
      }
    }

  // =========================================================================
  // LEVEL 3 (DARK): NIGHT FACTORY PERIMETER — SEARCHLIGHTS & INDUSTRIAL WALLS
  // =========================================================================
  } else if (level.id === 3) {
    drawCyberSkyline(ctx, level, camX, time);

    // Distant colossal brewery cooling towers
    const siloScroll = Math.floor(camX * 0.35);
    for (let s = -1; s < 5; s++) {
      const sx = s * 164 - (siloScroll % 164);
      ctx.fillStyle = '#0D1924';
      ctx.beginPath();
      ctx.moveTo(sx + 20, FLOOR_MIN_Y + 8);
      ctx.lineTo(sx + 32, 38);
      ctx.lineTo(sx + 74, 38);
      ctx.lineTo(sx + 86, FLOOR_MIN_Y + 8);
      ctx.closePath();
      ctx.fill();
      px(ctx, sx + 32, 42, 42, 3, '#39FF14');
    }

    // Sweeping security searchlights
    for (let i = 0; i < 3; i++) {
      const originX = 76 + i * 168;
      const tipX = originX + Math.sin(time * 1.45 + i * 2.1) * 74;
      ctx.fillStyle = 'rgba(0, 229, 255, 0.11)';
      ctx.beginPath();
      ctx.moveTo(originX, FLOOR_MIN_Y);
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
      const h = tileHash(wIdx, 33);
      const variant = h % 8;
      const el = Math.round(getGroundElevation(3, camX + fx + tileW * 0.5));

      ctx.save();
      ctx.translate(0, el);

      if (variant === 0) {
        px(ctx, fx, 68, 120, 98, '#131D2A');
        box(ctx, fx + 72, 26, 42, 134, '#1E293B', '#475569', INK);
        box(ctx, fx + 68, 22, 50, 24, '#0F172A', '#00E5FF', INK);
        px(ctx, fx + 74, 28, 38, 10, 'rgba(0,229,255,0.4)');
        const dishW = 6 + Math.abs(Math.sin(time * 3 + wIdx)) * 10;
        px(ctx, fx + 93 - dishW / 2, 14, dishW, 5, '#94A3B8');
        for (let ly = 78; ly < 136; ly += 14) {
          px(ctx, fx, ly, 72, 1.5, Math.floor(time * 6 + ly) % 3 === 0 ? '#FF2A85' : 'rgba(255,42,133,0.45)');
        }
      } else if (variant === 1) {
        px(ctx, fx, 64, 124, 102, '#141F2D');
        box(ctx, fx, 82, 124, 12, '#334155', '#94A3B8', '#0F172A');
        box(ctx, fx, 104, 124, 10, '#14532D', '#39FF14', '#052E16');
        ctx.fillStyle = '#0F172A';
        ctx.beginPath();
        ctx.arc(fx + 62, 88, 9, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#FF2A85';
        ctx.lineWidth = 1.6;
        ctx.stroke();
        const puff = (time * 32 + wIdx * 17) % 28;
        ctx.fillStyle = `rgba(203, 213, 225, ${0.28 * (1 - puff / 28)})`;
        ctx.beginPath();
        ctx.arc(fx + 32, 80 - puff, 4 + puff * 0.24, 0, Math.PI * 2);
        ctx.fill();
      } else if (variant === 2) {
        px(ctx, fx, 62, 124, 104, '#111926');
        box(ctx, fx + 12, 74, 34, 72, '#1E293B', '#00E5FF', INK);
        box(ctx, fx + 74, 74, 34, 72, '#1E293B', '#00E5FF', INK);
        for (let cy = 82; cy < 130; cy += 10) {
          px(ctx, fx + 16, cy, 26, 4, '#38BDF8');
          px(ctx, fx + 78, cy, 26, 4, '#38BDF8');
        }
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
        px(ctx, fx, 66, 124, 100, '#151E2B');
        box(ctx, fx + 12, 72, 46, 82, '#1F2937', '#64748B', INK);
        px(ctx, fx + 18, 82, 34, 18, 'rgba(0,229,255,0.28)');
        px(ctx, fx + 64, 118, 52, 6, '#FF2A85');
        for (let bx = 68; bx < 112; bx += 12) px(ctx, fx + bx, 118, 6, 6, '#F8FAFC');
        box(ctx, fx + 58, 114, 10, 40, '#334155', '#94A3B8', INK);
        px(ctx, fx + 92, 68, 14, 6, '#475569');
        if (Math.floor(time * 3 + wIdx) % 2 === 0) px(ctx, fx + 90, 70, 3, 3, '#FF2A85');
      } else if (variant === 4) {
        px(ctx, fx, 58, 124, 108, '#131C26');
        ctx.fillStyle = '#070B10';
        ctx.beginPath();
        ctx.arc(fx + 62, 108, 28, Math.PI, 0);
        ctx.lineTo(fx + 90, 152);
        ctx.lineTo(fx + 34, 152);
        ctx.closePath();
        ctx.fill();
        const flowOffset = Math.floor(time * 48) % 12;
        px(ctx, fx + 48, 104, 28, 48, 'rgba(57,255,20,0.45)');
        for (let wy = 104 + flowOffset; wy < 148; wy += 12) px(ctx, fx + 52, wy, 20, 4, '#BBF7D0');
        box(ctx, fx + 34, 62, 56, 16, '#090C11', '#FACC15', INK);
        ctx.fillStyle = '#FACC15';
        ctx.font = 'bold 7px monospace';
        ctx.fillText('BIO-FLOW 77', fx + 39, 73);
      } else if (variant === 5) {
        px(ctx, fx, 48, 124, 118, '#182230');
        box(ctx, fx + 14, 58, 96, 96, '#243040', '#64748B', INK);
        px(ctx, fx + 61, 60, 2, 92, '#090C11');
        ctx.fillStyle = '#39FF14';
        ctx.font = 'bold 8px monospace';
        ctx.fillText('СЕКТОР-77', sxCenter(fx + 62, 46), 92);
        const beacon = Math.floor(time * 6 + wIdx) % 2 === 0;
        px(ctx, fx + 22, 50, 10, 6, beacon ? '#FFB000' : '#451A03');
        px(ctx, fx + 92, 50, 10, 6, !beacon ? '#FFB000' : '#451A03');
      } else if (variant === 6) {
        // Brick Industrial Boiler Hall with Lit Yellow Clerestory Windows & Smokestack
        px(ctx, fx, 42, 124, 124, '#1F1B22');
        for (let wx2 = 12; wx2 < 104; wx2 += 34) {
          box(ctx, fx + wx2, 56, 24, 34, '#0F172A', '#64748B', INK);
          px(ctx, fx + wx2 + 3, 60, 18, 26, 'rgba(251,191,36,0.22)');
        }
        box(ctx, fx + 18, 114, 22, 34, '#14532D', '#4ADE80', INK);
        box(ctx, fx + 44, 120, 20, 28, '#9A3412', '#FB923C', INK);
      } else {
        // Tall Floodlight Mast + Concrete Wall + Stacked Drums
        px(ctx, fx, 78, 124, 88, '#151E2A');
        px(ctx, fx + 58, 20, 4, 132, '#475569');
        box(ctx, fx + 46, 16, 28, 8, '#334155', '#E2E8F0', INK);
        px(ctx, fx + 49, 20, 22, 3, '#FEF08A');
        ctx.fillStyle = 'rgba(254,240,138,0.08)';
        ctx.beginPath();
        ctx.moveTo(fx + 46, 24);
        ctx.lineTo(fx + 14, 152);
        ctx.lineTo(fx + 106, 152);
        ctx.lineTo(fx + 74, 24);
        ctx.closePath();
        ctx.fill();
        box(ctx, fx + 16, 126, 18, 22, '#0E7490', '#38BDF8', INK);
        box(ctx, fx + 88, 126, 18, 22, '#15803D', '#39FF14', INK);
      }

      for (let s = 0; s < 120; s += 12) {
        px(ctx, fx + s, 144, 6, 8, '#FACC15');
        px(ctx, fx + s + 6, 144, 6, 8, '#090C11');
      }
      ctx.restore();
    }

    drawSlopedGroundSurface(ctx, 3, camX, '#121922', '#2B3A4D', '#070A0F');
    const cStart = Math.floor(camX / 72) - 1;
    for (let k = 0; k < 9; k++) {
      const idx = cStart + k;
      const rx = idx * 72 - camX;
      const rEl = getGroundElevation(3, idx * 72 + 24);
      px(ctx, rx, 198 + rEl, 38, 3, '#243244');
      px(ctx, rx + 12, 168 + rEl, 22, 3, 'rgba(0,229,255,0.22)');
      px(ctx, rx + 40, 232 + rEl, 24, 4, 'rgba(57,255,20,0.16)');
    }

  // =========================================================================
  // LEVEL 4 (LIGHT): SUNNY DAYTIME COASTAL HIGHWAY ON HARLEY CRUISERS!
  // =========================================================================
  } else if (level.id === 4) {
    const speedScroll = Math.floor(time * 380);
    const biome = camX < 2500 ? 0 : camX < 4600 ? 1 : camX < 7300 ? 2 : 3;

    if (biome === 1) {
      // BIOME 1: Brightly Lit Daytime Concrete Highway Tunnel with Warm Overhead Lamps
      px(ctx, 0, 0, VIRTUAL_W, FLOOR_MIN_Y + 18, '#334155');
      px(ctx, 0, 0, VIRTUAL_W, 20, '#475569');
      // Bright ceramic white lower tunnel wall tiles
      px(ctx, 0, 82, VIRTUAL_W, FLOOR_MIN_Y - 64, '#CBD5E1');
      for (let x = -(speedScroll % 96); x < VIRTUAL_W; x += 96) {
        px(ctx, x, 16, 18, FLOOR_MIN_Y + 2, '#64748B');
        px(ctx, x + 30, 14, 34, 6, '#FEF08A');
        px(ctx, x + 32, 20, 30, 3, '#FFFFFF');
        // Warm overhead light wash
        ctx.fillStyle = 'rgba(254, 249, 195, 0.14)';
        ctx.fillRect(x + 24, 22, 46, FLOOR_MIN_Y - 12);
        // Reflective amber safety stripe along tunnel wall
        px(ctx, x + 22, 118, 64, 4, '#F59E0B');
      }
    } else {
      drawCyberSkyline(ctx, level, camX, time, speedScroll * 0.12);

      if (biome === 0) {
        // BIOME 0: Sunlit Coastal Highway with Pine/Cypress Hillsides & Realistic Blue Highway Signs
        const hillStep = 148;
        const hStart = Math.floor((speedScroll * 0.45) / hillStep) - 1;
        for (let k = 0; k < 6; k++) {
          const idx = hStart + k;
          const hx = idx * hillStep - Math.floor(speedScroll * 0.45);
          const hh = tileHash(idx, 41);
          // Sunlit grassy coastal embankment
          ctx.fillStyle = hh % 2 === 0 ? '#4D7C0F' : '#65A30D';
          ctx.beginPath();
          ctx.ellipse(hx + 74, FLOOR_MIN_Y + 6, 96, 36 + (hh % 18), 0, Math.PI, 0);
          ctx.fill();
          // Roadside pine & cypress trees
          for (let tr = 0; tr < 3; tr++) {
            const tx = hx + 22 + tr * 44;
            const ty = FLOOR_MIN_Y - 12 - ((hh + tr * 7) % 16);
            px(ctx, tx - 1.5, ty, 3, 22, '#78350F');
            drawRoundedPoly(ctx, [[tx - 9, ty + 4], [tx, ty - 22], [tx + 9, ty + 4]], '#15803D', INK, 0.8);
          }
        }
        // Overhead highway sign gantry (realistic Russian blue/white highway road sign!)
        for (let x = -(speedScroll % 260); x < VIRTUAL_W; x += 260) {
          px(ctx, x + 10, 16, 7, FLOOR_MIN_Y, '#94A3B8');
          px(ctx, x + 150, 16, 7, FLOOR_MIN_Y, '#94A3B8');
          px(ctx, x + 10, 18, 147, 5, '#CBD5E1');
          box(ctx, x + 36, 22, 96, 28, '#1D4ED8', '#FFFFFF', '#1E3A8A');
          ctx.fillStyle = '#FFFFFF';
          ctx.font = 'bold 7px monospace';
          ctx.fillText('АЛУПКА -> 12КМ', x + 46, 34);
          ctx.fillStyle = '#FEF08A';
          ctx.font = 'bold 6px monospace';
          ctx.fillText('ПИВЗАВОД · ПРЯМО', x + 44, 44);
        }
      } else if (biome === 2) {
        // BIOME 2: Sunlit Suspension Bridge Over Sparkling Turquoise Sea!
        const bayG = ctx.createLinearGradient(0, FLOOR_MIN_Y - 34, 0, FLOOR_MIN_Y + 14);
        bayG.addColorStop(0, '#0284C7');
        bayG.addColorStop(1, '#38BDF8');
        ctx.fillStyle = bayG;
        ctx.fillRect(0, FLOOR_MIN_Y - 32, VIRTUAL_W, 46);
        for (let w = 0; w < 16; w++) {
          const wx = ((w * 43 - Math.floor(time * 90)) % VIRTUAL_W + VIRTUAL_W) % VIRTUAL_W;
          px(ctx, wx, FLOOR_MIN_Y - 24 + (w % 4) * 5, 22, 1.5, 'rgba(255,255,255,0.65)');
        }
        // Crisp white/silver sunlit suspension bridge pylons & steel cables
        for (let x = -(Math.floor(speedScroll * 0.78) % 240); x < VIRTUAL_W + 240; x += 240) {
          box(ctx, x, 6, 16, FLOOR_MIN_Y + 8, '#E2E8F0', '#FFFFFF', '#64748B');
          px(ctx, x + 5, 10, 6, FLOOR_MIN_Y - 14, '#CBD5E1');
          ctx.strokeStyle = 'rgba(241, 245, 249, 0.85)';
          ctx.lineWidth = 1.2;
          ctx.beginPath();
          for (let c = 1; c <= 4; c++) {
            ctx.moveTo(x + 8, 12 + c * 10);
            ctx.lineTo(x + 8 - c * 28, FLOOR_MIN_Y);
            ctx.moveTo(x + 8, 12 + c * 10);
            ctx.lineTo(x + 8 + c * 28, FLOOR_MIN_Y);
          }
          ctx.stroke();
        }
      } else {
        // BIOME 3: Sunlit Industrial Viaduct Approaching Brewery!
        for (let x = -(Math.floor(speedScroll * 0.72) % 168); x < VIRTUAL_W + 168; x += 168) {
          px(ctx, x + 16, 14, 10, FLOOR_MIN_Y, '#64748B');
          px(ctx, x, 14, 168, 6, '#94A3B8');
          box(ctx, x, 48, 168, 9, '#15803D', '#4ADE80', '#052E16');
          // Daytime industrial exhaust vent plume
          const puff = (time * 32 + x) % 24;
          ctx.fillStyle = `rgba(255, 255, 255, ${0.55 * (1 - puff / 24)})`;
          ctx.beginPath();
          ctx.arc(x + 21, 10 - puff * 0.4, 5 + puff * 0.25, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }

    // Smooth Sloped Sun-Baked Gray Highway Asphalt + Silver Guardrail!
    drawSlopedGroundSurface(ctx, 4, camX, '#46505D', '#CBD5E1', '#1E293B', '#64748B');

    // Sloped metal W-beam guardrail + orange reflectors along road edge
    ctx.strokeStyle = '#94A3B8';
    ctx.lineWidth = 4;
    ctx.beginPath();
    for (let x = 0; x <= VIRTUAL_W + 12; x += 12) {
      const sx = Math.min(VIRTUAL_W, x);
      const gy = FLOOR_MIN_Y - 5 + getGroundElevation(4, camX + sx);
      if (x === 0) ctx.moveTo(sx, gy);
      else ctx.lineTo(sx, gy);
    }
    ctx.stroke();
    for (let x = -(speedScroll % 44); x < VIRTUAL_W; x += 44) {
      const gy = FLOOR_MIN_Y - 6 + getGroundElevation(4, camX + Math.max(0, x));
      px(ctx, x, gy, 8, 3, '#F97316');
    }

    // Sloped crisp white dashed highway lane markings
    for (const laneY of [184, 220]) {
      for (let x = -(speedScroll % 72); x < VIRTUAL_W; x += 72) {
        const ly = laneY + getGroundElevation(4, camX + Math.max(0, x + 18));
        px(ctx, x, ly, 36, 3, '#F8FAFC');
      }
    }
    // Subtle sunlit asphalt wind-rush streaks
    for (let s = 0; s < 8; s++) {
      const lx = VIRTUAL_W - ((Math.floor(time * 540) + s * 91) % (VIRTUAL_W + 60));
      const ly = 160 + (s * 11) % 88 + getGroundElevation(4, camX + Math.max(0, lx));
      px(ctx, lx, ly, 22, 1, 'rgba(255,255,255,0.22)');
    }

  // =========================================================================
  // LEVEL 6 (LIGHT): BRIGHT DAYLIGHT FACTORY ATRIUM & SUNLIT GLASS PENTHOUSE!
  // =========================================================================
  } else {
    if (camX > 6400) {
      // ACT 3: DIRECTOR'S PANORAMIC SUNLIT GLASS PENTHOUSE (Daylight Boss Arena!)
      drawCyberSkyline(ctx, level, camX * 0.4, time);
      // Warm diagonal golden sunbeams streaming through giant floor-to-ceiling windows!
      for (let r = 0; r < 4; r++) {
        const rx = 38 + r * 124;
        ctx.fillStyle = 'rgba(255, 251, 235, 0.22)';
        ctx.beginPath();
        ctx.moveTo(rx, 0);
        ctx.lineTo(rx + 46, 0);
        ctx.lineTo(rx - 14, FLOOR_MIN_Y + 40);
        ctx.lineTo(rx - 62, FLOOR_MIN_Y + 40);
        ctx.closePath();
        ctx.fill();
      }
      // Sleek architectural brushed-aluminum window mullions
      for (let x = -(midScroll % 96); x < VIRTUAL_W; x += 96) {
        box(ctx, x, 0, 8, FLOOR_MIN_Y + 12, '#E2E8F0', '#FFFFFF', '#94A3B8');
      }
      // Crisp executive PIZED-77 corporate glass emblem
      const cx = VIRTUAL_W / 2;
      const cy = 72;
      ctx.strokeStyle = 'rgba(16, 185, 129, 0.55)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(cx, cy, 34, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = '#065F46';
      ctx.font = 'bold 10px monospace';
      ctx.fillText('PIZED-77', cx - 25, cy + 3);
      ctx.fillStyle = '#0F172A';
      ctx.font = 'bold 6px monospace';
      ctx.fillText('DIRECTOR PENTHOUSE', cx - 34, cy + 15);

      // Polished bright cream-marble penthouse floor with emerald geometric inlays!
      drawSlopedGroundSurface(ctx, 6, camX, '#E5E7EB', '#F8FAFC', '#94A3B8');
      const mStart = Math.floor(camX / 64) - 1;
      for (let k = 0; k < 10; k++) {
        const idx = mStart + k;
        const rx = idx * 64 - camX;
        const rEl = getGroundElevation(6, idx * 64 + 24);
        px(ctx, rx, FLOOR_MIN_Y + 6 + rEl, 1.5, VIRTUAL_H - FLOOR_MIN_Y, '#CBD5E1');
        px(ctx, rx + 14, 198 + rEl, 30, 2, 'rgba(16, 185, 129, 0.28)');
      }
    } else if (camX > 3100) {
      // ACT 2: BRIGHT DAYLIGHT GLASS R&D LAB & STERILE MAINFRAME CORRIDOR
      drawCyberSkyline(ctx, level, camX * 0.35, time);
      px(ctx, 0, 0, VIRTUAL_W, 18, '#E2E8F0');
      px(ctx, 0, 18, VIRTUAL_W, 3, '#94A3B8');
      // Bright interior wall backdrop with large upper clerestory daylight windows
      px(ctx, 0, 62, VIRTUAL_W, FLOOR_MIN_Y - 46, '#E2E8F0');

      const tileW = 118;
      const startIdx = Math.floor(midScroll / tileW) - 1;
      for (let k = 0; k < 6; k++) {
        const wIdx = startIdx + k;
        const sx = wIdx * tileW - midScroll;
        const h = tileHash(wIdx, 62);
        const variant = h % 5;
        const el = Math.round(getGroundElevation(6, camX + sx + tileW * 0.5));

        ctx.save();
        ctx.translate(0, el);
        // Sunlit glass skylight frame
        box(ctx, sx + 6, 22, 106, 36, 'rgba(224,242,254,0.35)', '#FFFFFF', '#94A3B8');

        if (variant === 0) {
          // Clean White & Sky-Blue Quantum Server Racks
          box(ctx, sx + 10, 48, 44, 108, '#F8FAFC', '#FFFFFF', '#94A3B8');
          box(ctx, sx + 62, 48, 44, 108, '#F8FAFC', '#FFFFFF', '#94A3B8');
          for (let ry = 56; ry < 142; ry += 10) {
            const blink = Math.floor(time * 7 + ry + wIdx) % 3 === 0;
            px(ctx, sx + 16, ry, 22, 3, blink ? '#0284C7' : '#CBD5E1');
            px(ctx, sx + 42, ry, 6, 3, '#10B981');
            px(ctx, sx + 68, ry, 24, 3, !blink ? '#10B981' : '#CBD5E1');
          }
        } else if (variant === 1) {
          // Daylight Glass Bio-Specimen Tank
          box(ctx, sx + 22, 42, 72, 114, '#CBD5E1', '#FFFFFF', '#64748B');
          box(ctx, sx + 32, 52, 52, 92, '#DCFCE7', '#FFFFFF', '#16A34A');
          const bob = Math.sin(time * 2.4 + wIdx) * 4;
          ctx.fillStyle = 'rgba(21, 128, 61, 0.65)';
          ctx.beginPath();
          ctx.ellipse(sx + 58, 92 + bob, 13, 20, 0, 0, Math.PI * 2);
          ctx.fill();
          const by = 136 - (Math.floor(time * 36 + wIdx * 19) % 72);
          px(ctx, sx + 42, by, 4, 4, '#FFFFFF');
        } else if (variant === 2) {
          // Daylight DNA Analysis Screen + Lab Desk
          box(ctx, sx + 12, 54, 92, 62, '#0F172A', '#38BDF8', INK);
          for (let d = 0; d < 11; d++) {
            const dx = sx + 20 + d * 7;
            const y1 = 84 + Math.sin(time * 4 + d * 0.7) * 14;
            const y2 = 84 - Math.sin(time * 4 + d * 0.7) * 14;
            px(ctx, dx, Math.min(y1, y2), 1, Math.abs(y2 - y1), 'rgba(56,189,248,0.5)');
            px(ctx, dx - 1, y1 - 1, 3, 3, '#39FF14');
            px(ctx, dx - 1, y2 - 1, 3, 3, '#38BDF8');
          }
          box(ctx, sx + 20, 122, 76, 32, '#F1F5F9', '#FFFFFF', '#94A3B8');
        } else if (variant === 3) {
          // Sunlit Glass Atrium Walkway + Indoor Ficus Trees in White Planters!
          box(ctx, sx + 18, 126, 26, 26, '#FFFFFF', '#F8FAFC', '#94A3B8');
          px(ctx, sx + 29, 98, 4, 30, '#78350F');
          drawInkEllipse(ctx, sx + 31, 88, 15, 13, 0, '#16A34A', '#4ADE80', '#14532D', 0.9);
          box(ctx, sx + 74, 126, 26, 26, '#FFFFFF', '#F8FAFC', '#94A3B8');
          px(ctx, sx + 85, 102, 4, 26, '#78350F');
          drawInkEllipse(ctx, sx + 87, 92, 13, 12, 0, '#15803D', '#86EFAC', '#052E16', 0.9);
        } else {
          // Clean White Sterile Cleanroom Airlock Doors
          box(ctx, sx + 16, 56, 86, 98, '#F1F5F9', '#FFFFFF', '#94A3B8');
          px(ctx, sx + 58, 58, 2, 94, '#64748B');
          px(ctx, sx + 26, 74, 24, 32, '#BAE6FD');
          px(ctx, sx + 68, 74, 24, 32, '#BAE6FD');
          ctx.fillStyle = '#0F172A';
          ctx.font = 'bold 6px monospace';
          ctx.fillText('LAB SECTOR B', sx + 34, 68);
        }
        ctx.restore();
      }

      drawSlopedGroundSurface(ctx, 6, camX, '#DCE4EE', '#F8FAFC', '#94A3B8');
      const fStart = Math.floor(camX / 56) - 1;
      for (let k = 0; k < 10; k++) {
        const idx = fStart + k;
        const rx = idx * 56 - camX;
        const rEl = getGroundElevation(6, idx * 56 + 24);
        px(ctx, rx, FLOOR_MIN_Y + 6 + rEl, 1, VIRTUAL_H - FLOOR_MIN_Y, '#CBD5E1');
        px(ctx, rx + 10, 206 + rEl, 24, 2, 'rgba(2,132,199,0.22)');
      }
    } else {
      // ACT 1: BRIGHT DAYLIGHT MODERN BREWERY HALL WITH SKYLIGHT SUNBEAMS!
      drawCyberSkyline(ctx, level, camX * 0.3, time);
      // Bright light-steel architectural hall wall & overhead skylight beam
      px(ctx, 0, 56, VIRTUAL_W, FLOOR_MIN_Y - 40, '#DCE4EC');
      px(ctx, 0, 16, VIRTUAL_W, 6, '#CBD5E1');
      px(ctx, 0, 22, VIRTUAL_W, 2, '#10B981');

      const tileW = 116;
      const startIdx = Math.floor(midScroll / tileW) - 1;
      for (let k = 0; k < 6; k++) {
        const wIdx = startIdx + k;
        const vx = wIdx * tileW - midScroll;
        const h = tileHash(wIdx, 61);
        const variant = h % 5;
        const el = Math.round(getGroundElevation(6, camX + vx + tileW * 0.5));

        ctx.save();
        ctx.translate(0, el);

        // Diagonal golden daylight beam pouring through upper atrium window
        if (wIdx % 2 === 0) {
          ctx.fillStyle = 'rgba(255, 251, 235, 0.24)';
          ctx.beginPath();
          ctx.moveTo(vx + 20, 22);
          ctx.lineTo(vx + 68, 22);
          ctx.lineTo(vx + 22, FLOOR_MIN_Y + 20);
          ctx.lineTo(vx - 22, FLOOR_MIN_Y + 20);
          ctx.closePath();
          ctx.fill();
        }

        if (variant === 0) {
          // Gleaming Stainless-Steel Beer Fermentation Vat with Green Sight Glass
          box(ctx, vx + 12, 34, 62, 122, '#CBD5E1', '#FFFFFF', '#64748B');
          box(ctx, vx + 20, 44, 46, 86, '#14532D', '#4ADE80', '#052E16');
          const by = 122 - (Math.floor(time * 38 + wIdx * 25) % 70);
          px(ctx, vx + 30, by, 6, 6, '#39FF14');
          px(ctx, vx + 46, ((by + 28) % 70) + 50, 5, 5, '#BBF7D0');
          box(ctx, vx + 82, 28, 14, 128, '#94A3B8', '#F8FAFC', '#475569');
          px(ctx, vx + 86, 34, 4, 114, '#22C55E');
        } else if (variant === 1) {
          // Bright Industrial Yellow Robot Bottling Arm + Control Console
          const armSwing = Math.sin(time * 3.5 + wIdx) * 12;
          ctx.strokeStyle = '#EAB308';
          ctx.lineWidth = 4;
          ctx.beginPath();
          ctx.moveTo(vx + 56, 24);
          ctx.lineTo(vx + 56 + armSwing, 68);
          ctx.lineTo(vx + 56 + armSwing * 0.5, 102);
          ctx.stroke();
          px(ctx, vx + 50 + armSwing * 0.5, 100, 12, 8, '#334155');
          box(ctx, vx + 16, 102, 30, 48, '#F1F5F9', '#FFFFFF', '#64748B');
          px(ctx, vx + 20, 108, 22, 12, '#0F172A');
          px(ctx, vx + 22, 111, 12, 3, Math.floor(time * 5 + wIdx) % 2 === 0 ? '#22C55E' : '#F59E0B');
        } else if (variant === 2) {
          // Stainless Mixing Boiler «PIZED-77» with Hazard Base
          box(ctx, vx + 8, 42, 96, 110, '#E2E8F0', '#FFFFFF', '#64748B');
          box(ctx, vx + 18, 56, 76, 40, '#0F172A', '#10B981', INK);
          ctx.fillStyle = '#39FF14';
          ctx.font = 'bold 9px monospace';
          ctx.fillText('PIZED-77', vx + 28, 74);
          ctx.fillStyle = '#FACC15';
          ctx.font = 'bold 6px monospace';
          ctx.fillText('BATCH #999', vx + 32, 88);
          for (let s = 12; s < 96; s += 12) {
            px(ctx, vx + s, 138, 6, 10, '#FACC15');
            px(ctx, vx + s + 6, 138, 6, 10, '#0F172A');
          }
        } else if (variant === 3) {
          // Daylight Glass Observation Office Overlooking Brewery Floor
          box(ctx, vx + 8, 48, 100, 62, '#F8FAFC', '#FFFFFF', '#64748B');
          box(ctx, vx + 14, 54, 88, 38, '#BAE6FD', '#FFFFFF', '#0284C7');
          // Desk & monitor silhouettes inside glass office
          px(ctx, vx + 24, 78, 24, 14, '#334155');
          px(ctx, vx + 64, 72, 18, 12, '#1E293B');
          box(ctx, vx + 12, 114, 92, 40, '#CBD5E1', '#F8FAFC', '#64748B');
        } else {
          // Tall Atrium Window Bay + Indoor Potted Greenery + Safety Signage
          box(ctx, vx + 10, 26, 96, 98, 'rgba(224,242,254,0.45)', '#FFFFFF', '#94A3B8');
          px(ctx, vx + 56, 26, 4, 98, '#CBD5E1');
          box(ctx, vx + 16, 128, 24, 24, '#FFFFFF', '#F8FAFC', '#94A3B8');
          drawInkEllipse(ctx, vx + 28, 114, 13, 14, 0, '#16A34A', '#4ADE80', '#14532D', 0.9);
          box(ctx, vx + 62, 126, 38, 24, '#FACC15', '#FEF08A', '#A16207');
          ctx.fillStyle = '#0F172A';
          ctx.font = 'bold 6px monospace';
          ctx.fillText('ZONE A', vx + 68, 140);
        }
        ctx.restore();
      }

      // Bright Polished Light-Epoxy Factory Floor + Green-Beer Conveyor Belt!
      drawSlopedGroundSurface(ctx, 6, camX, '#CBD5E1', '#F1F5F9', '#64748B');
      const bScroll = Math.floor(time * 75) % 24;
      for (let x = 0; x < VIRTUAL_W; x += 24) {
        const bEl = getGroundElevation(6, camX + x);
        px(ctx, x, FLOOR_MIN_Y + 7 + bEl, 24, 11, '#334155');
        px(ctx, x - (bScroll % 24) + 12, FLOOR_MIN_Y + 9 + bEl, 8, 7, '#22C55E');
        px(ctx, x - (bScroll % 24) + 14, FLOOR_MIN_Y + 8 + bEl, 4, 2, '#ECFCCB');
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

  // 1. Render Interactive Jumpable Road Hazards & Obstacles anchored to sloped terrain!
  if (level.roadHazards) {
    for (const hz of level.roadHazards) {
      const sx = Math.round(hz.x - camX);
      if (sx < -150 || sx > VIRTUAL_W + 150) continue;

      const hzElev = Math.round(getGroundElevation(level.id, hz.x));
      ctx.save();
      ctx.translate(0, hzElev);

      const x0 = sx - hz.w / 2;
      const y0 = hz.y - hz.h / 2;
      const warnBlink = Math.floor(time * 7) % 2 === 0;

      if (hz.kind === 'bridge_hole') {
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
        px(ctx, x0 + 10 + (waterShift % 10), hz.y - 4, 22, 2, 'rgba(56, 189, 248, 0.55)');
        px(ctx, x0 + 22 - (waterShift % 8), hz.y + 6, 26, 2, 'rgba(186, 230, 253, 0.45)');

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
        const topY = FLOOR_MIN_Y + 1;
        const riverH = VIRTUAL_H - FLOOR_MIN_Y - 2;
        px(ctx, x0 - 4, topY, hz.w + 8, riverH, '#0F1A14');
        const rg = ctx.createLinearGradient(x0, topY, x0 + hz.w, topY);
        rg.addColorStop(0, '#14532D');
        rg.addColorStop(0.22, '#22C55E');
        rg.addColorStop(0.5, '#39FF14');
        rg.addColorStop(0.78, '#22C55E');
        rg.addColorStop(1, '#14532D');
        ctx.fillStyle = rg;
        ctx.fillRect(x0, topY, hz.w, riverH);

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
        px(ctx, x0 - 3, topY, 3, riverH, warnBlink ? '#39FF14' : '#FACC15');
        px(ctx, x0 + hz.w, topY, 3, riverH, warnBlink ? '#39FF14' : '#FACC15');
        ctx.fillStyle = '#090C11';
        ctx.fillRect(sx - 28, topY - 10, 56, 8);
        ctx.fillStyle = '#D9F99D';
        ctx.font = 'bold 6px monospace';
        ctx.textAlign = 'center';
        ctx.fillText('ЖИЖА · ПРЫЖОК', sx, topY - 4);
        ctx.textAlign = 'left';
      } else if (hz.kind === 'barrier') {
        const topY = FLOOR_MIN_Y + 2;
        const barH = VIRTUAL_H - FLOOR_MIN_Y - 6;
        px(ctx, x0 + 5, topY + 2, hz.w, barH, 'rgba(0,0,0,0.42)');
        for (let seg = 0; seg < 3; seg++) {
          const sy = topY + seg * (barH / 3);
          const sh = barH / 3 - 2;
          box(ctx, x0, sy, hz.w, sh, '#334155', '#94A3B8', INK);
          for (let hy = sy + 2; hy < sy + sh - 3; hy += 8) {
            px(ctx, x0 + 3, hy, hz.w - 6, 4, '#FACC15');
            px(ctx, x0 + 3, hy + 4, hz.w - 6, 4, '#090C11');
          }
          px(ctx, sx - 2, sy + 2, 4, 3, warnBlink ? '#FF2A85' : '#7F1D1D');
        }
        ctx.fillStyle = '#090C11';
        ctx.fillRect(sx - 30, topY - 10, 60, 8);
        ctx.fillStyle = warnBlink ? '#FACC15' : '#FFFFFF';
        ctx.font = 'bold 6px monospace';
        ctx.textAlign = 'center';
        ctx.fillText('БАРЬЕР · ПРЫЖОК', sx, topY - 4);
        ctx.textAlign = 'left';
      } else if (hz.kind === 'boom_gate') {
        const topY = FLOOR_MIN_Y;
        const gateH = VIRTUAL_H - FLOOR_MIN_Y - 4;
        box(ctx, sx - 10, topY - 24, 20, 26, '#1E293B', '#64748B', INK);
        px(ctx, sx - 5, topY - 21, 10, 5, warnBlink ? '#FF2A85' : '#39FF14');
        px(ctx, sx - 2, topY + 4, 9, gateH, 'rgba(0,0,0,0.4)');
        for (let py = topY; py < topY + gateH; py += 12) {
          const isRed = Math.floor(py / 12) % 2 === 0;
          box(ctx, sx - 5, py, 10, 12, isRed ? '#DC2626' : '#F8FAFC', isRed ? '#FCA5A5' : '#FFFFFF', INK);
        }
        box(ctx, sx - 7, topY + gateH - 8, 14, 10, '#334155', '#94A3B8', INK);
        ctx.fillStyle = '#090C11';
        ctx.fillRect(sx - 34, topY - 34, 68, 8);
        ctx.fillStyle = '#FACC15';
        ctx.font = 'bold 6px monospace';
        ctx.textAlign = 'center';
        ctx.fillText('ШЛАГБАУМ · ПРЫЖОК', sx, topY - 28);
        ctx.textAlign = 'left';
      } else if (hz.kind === 'crate_row') {
        const topY = FLOOR_MIN_Y + 2;
        const rowH = VIRTUAL_H - FLOOR_MIN_Y - 6;
        const count = 4;
        const ch = rowH / count;
        for (let i = 0; i < count; i++) {
          const cy = topY + i * ch;
          px(ctx, x0 + 5, cy + 3, hz.w, ch - 2, 'rgba(0,0,0,0.4)');
          box(ctx, x0, cy, hz.w, ch - 2, '#92400E', '#F59E0B', INK);
          ctx.strokeStyle = '#451A03';
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.moveTo(x0 + 3, cy + 3);
          ctx.lineTo(x0 + hz.w - 3, cy + ch - 5);
          ctx.moveTo(x0 + hz.w - 3, cy + 3);
          ctx.lineTo(x0 + 3, cy + ch - 5);
          ctx.stroke();
          px(ctx, sx - 3, cy + ch * 0.35, 6, 4, '#39FF14');
        }
        ctx.fillStyle = '#090C11';
        ctx.fillRect(sx - 30, topY - 10, 60, 8);
        ctx.fillStyle = '#FDE047';
        ctx.font = 'bold 6px monospace';
        ctx.textAlign = 'center';
        ctx.fillText('ЯЩИКИ · ПРЫЖОК', sx, topY - 4);
        ctx.textAlign = 'left';
      } else if (hz.kind === 'laser_gate') {
        const topY = FLOOR_MIN_Y;
        const botY = VIRTUAL_H - 6;
        const phase = (time + (hz.pulseOffset ?? 0)) % 2.8;
        const active = phase < 2.0;

        box(ctx, sx - 9, topY - 14, 18, 16, '#0F172A', '#00E5FF', INK);
        box(ctx, sx - 9, botY - 8, 18, 10, '#0F172A', '#00E5FF', INK);
        px(ctx, sx - 3, topY - 9, 6, 4, active ? '#FF2A85' : '#334155');
        px(ctx, sx - 3, botY - 5, 6, 3, active ? '#FF2A85' : '#334155');

        if (active) {
          ctx.fillStyle = `rgba(255, 42, 133, ${0.32 + pulse * 0.28})`;
          ctx.fillRect(sx - 6, topY + 2, 12, botY - topY - 10);
          px(ctx, sx - 2, topY + 2, 4, botY - topY - 10, '#FF2A85');
          px(ctx, sx - 0.8, topY + 2, 1.6, botY - topY - 10, '#FFFFFF');
        } else {
          px(ctx, sx - 1, topY + 2, 2, botY - topY - 10, 'rgba(0, 229, 255, 0.35)');
        }

        ctx.fillStyle = '#090C11';
        ctx.fillRect(sx - 28, topY - 23, 56, 8);
        ctx.fillStyle = active ? '#FF2A85' : '#00E5FF';
        ctx.font = 'bold 6px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(active ? 'ЛАЗЕР · ПРЫЖОК' : 'ПЕРЕЗАРЯДКА', sx, topY - 17);
        ctx.textAlign = 'left';
      }

      ctx.restore();
    }
  }

  // 2. Render Monumental World-Space Landmarks anchored smoothly to sloped terrain!
  for (const lm of level.landmarks) {
    if (lm.kind === 'bridge_hole') continue;
    const sx = Math.round(lm.x - camX);
    if (sx < -220 || sx > VIRTUAL_W + 220) continue;

    const lmElev = Math.round(getGroundElevation(level.id, lm.x));
    ctx.save();
    ctx.translate(0, lmElev);

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
    ctx.restore();
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
