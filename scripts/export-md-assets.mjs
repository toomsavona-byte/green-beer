/**
 * Generates genuine 4bpp (16-color indexed) Sega Mega Drive PNG spritesheets and
 * dual-plane scrolling backgrounds for the SGDK vertical slice ROM in megadrive/res/gfx/.
 *
 * Zero external dependencies — uses Node's built-in zlib to produce spec-compliant
 * PNGs with exact Mega Drive 9-bit RGB (3 bits per channel) palettes.
 */

import fs from 'fs';
import path from 'path';
import zlib from 'zlib';

const OUT_DIR = path.join(process.cwd(), 'megadrive/res/gfx');
fs.mkdirSync(OUT_DIR, { recursive: true });

// Snap any RGB color to authentic Sega Mega Drive 9-bit CRAM levels (0..7 -> 0..252)
function mdChannel(v) {
  return Math.round(Math.max(0, Math.min(255, v)) / 36) * 36;
}
function mdRgb(r, g, b) {
  return [mdChannel(r), mdChannel(g), mdChannel(b)];
}

// --- CRC32 & 4bpp Indexed PNG Encoder ---
const CRC_TABLE = new Uint32Array(256);
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) {
    c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
  }
  CRC_TABLE[n] = c >>> 0;
}

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

function pngChunk(type, data) {
  const typeBuf = Buffer.from(type, 'ascii');
  const lenBuf = Buffer.alloc(4);
  lenBuf.writeUInt32BE(data.length, 0);
  const crcInput = Buffer.concat([typeBuf, data]);
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(crcInput), 0);
  return Buffer.concat([lenBuf, typeBuf, data, crcBuf]);
}

function writePng4bpp(filePath, width, height, palette, pixels) {
  if (width % 2 !== 0) throw new Error(`4bpp PNG width must be even: ${width}`);
  const pal = palette.slice(0, 16);
  while (pal.length < 16) pal.push([0, 0, 0]);

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 4; // bit depth = 4 (16 colors)
  ihdr[9] = 3; // color type = indexed
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  const plte = Buffer.alloc(16 * 3);
  for (let i = 0; i < 16; i++) {
    const [r, g, b] = mdRgb(pal[i][0], pal[i][1], pal[i][2]);
    plte[i * 3] = r;
    plte[i * 3 + 1] = g;
    plte[i * 3 + 2] = b;
  }

  const rowBytes = width / 2;
  const raw = Buffer.alloc(height * (1 + rowBytes));
  for (let y = 0; y < height; y++) {
    const rowOff = y * (1 + rowBytes);
    raw[rowOff] = 0; // filter None
    for (let x = 0; x < width; x += 2) {
      const p0 = pixels[y * width + x] & 0x0f;
      const p1 = pixels[y * width + x + 1] & 0x0f;
      raw[rowOff + 1 + (x >> 1)] = (p0 << 4) | p1;
    }
  }

  const idat = zlib.deflateSync(raw, { level: 9 });
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const png = Buffer.concat([
    sig,
    pngChunk('IHDR', ihdr),
    pngChunk('PLTE', plte),
    pngChunk('IDAT', idat),
    pngChunk('IEND', Buffer.alloc(0)),
  ]);
  fs.writeFileSync(filePath, png);
}

// --- Indexed Pixel Canvas Helper ---
class PixelSurface {
  constructor(w, h) {
    this.w = w;
    this.h = h;
    this.data = new Uint8Array(w * h);
  }
  px(x, y, c) {
    const ix = Math.floor(x);
    const iy = Math.floor(y);
    if (ix < 0 || iy < 0 || ix >= this.w || iy >= this.h) return;
    this.data[iy * this.w + ix] = c & 0x0f;
  }
  rect(x, y, w, h, c) {
    for (let yy = 0; yy < h; yy++) {
      for (let xx = 0; xx < w; xx++) {
        this.px(x + xx, y + yy, c);
      }
    }
  }
  box(x, y, w, h, fill, border) {
    this.rect(x, y, w, h, fill);
    if (border !== undefined) {
      for (let xx = 0; xx < w; xx++) {
        this.px(x + xx, y, border);
        this.px(x + xx, y + h - 1, border);
      }
      for (let yy = 0; yy < h; yy++) {
        this.px(x, y + yy, border);
        this.px(x + w - 1, y + yy, border);
      }
    }
  }
  circle(cx, cy, r, c) {
    const r2 = r * r;
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        if (dx * dx + dy * dy <= r2) this.px(cx + dx, cy + dy, c);
      }
    }
  }
  line(x0, y0, x1, y1, c, thick = 1) {
    const steps = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1);
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const x = Math.round(x0 + (x1 - x0) * t);
      const y = Math.round(y0 + (y1 - y0) * t);
      if (thick <= 1) {
        this.px(x, y, c);
      } else {
        this.rect(x - Math.floor(thick / 2), y - Math.floor(thick / 2), thick, thick, c);
      }
    }
  }
  save(name, palette) {
    const outPath = path.join(OUT_DIR, name);
    writePng4bpp(outPath, this.w, this.h, palette, this.data);
    return outPath;
  }
}

// ============================================================================
// 4 COORDINATED SEGA MEGA DRIVE PALETTES (16 colors each, index 0 = transparent)
// ============================================================================

// PAL0: HUD, Pickups, Projectiles, Explosions, Title Screen
const PAL_UI = [
  [252, 0, 252],   // 0: transparent key (magenta)
  [0, 0, 36],      // 1: deep midnight ink
  [36, 36, 72],    // 2: dark slate
  [36, 252, 36],   // 3: neon green beer
  [252, 180, 0],   // 4: amber gold
  [252, 36, 144],  // 5: hot arcade pink
  [0, 216, 252],   // 6: electric cyan
  [252, 252, 252], // 7: pure white
  [252, 108, 0],   // 8: fiery orange
  [216, 36, 36],   // 9: crimson red
  [144, 72, 0],    // 10: dark brown / meat / wood
  [252, 216, 144], // 11: light pita / foam cream
  [144, 144, 180], // 12: steel grey
  [0, 108, 36],    // 13: deep emerald
  [108, 0, 36],    // 14: deep magenta shadow
  [252, 252, 36],  // 15: bright yellow
];

// PAL1: Heroes (VADEK & ZAVOD KILLER share PAL1 cleanly for 2P Co-Op!)
const PAL_HEROES = [
  [252, 0, 252],   // 0: transparent
  [0, 0, 0],       // 1: crisp black outline
  [216, 144, 108], // 2: warm skin
  [180, 108, 72],  // 3: skin shade
  [144, 144, 180], // 4: silver hair / metal
  [36, 36, 36],    // 5: dark leather / rubber tire
  [72, 72, 108],   // 6: denim / vest grey
  [72, 108, 36],   // 7: factory olive coveralls (Zavod)
  [252, 108, 0],   // 8: orange vest / flame accent
  [36, 72, 108],   // 9: jeans blue (Vadek)
  [252, 180, 0],   // 10: gold belt / amber trim
  [252, 252, 36],  // 11: hard hat yellow / sparks
  [36, 252, 36],   // 12: neon green detail
  [216, 36, 36],   // 13: red accent / mask visor
  [216, 216, 216], // 14: steel rim / pipe gleam
  [252, 252, 252], // 15: bright highlight
];

// PAL2: Enemies & Boss (Drunk Punk, Quadcopter Drone, Boss Pivnoy Barmen)
const PAL_ENEMIES = [
  [252, 0, 252],   // 0: transparent
  [0, 0, 0],       // 1: crisp black outline
  [216, 144, 108], // 2: skin
  [180, 108, 72],  // 3: skin shadow
  [108, 252, 36],  // 4: toxic green beer glow
  [36, 108, 36],   // 5: dark beer bottle green
  [144, 36, 180],  // 6: punk purple mohawk / vest
  [216, 36, 72],   // 7: red enemy bandana / LED eye
  [216, 216, 216], // 8: barmen apron / white shirt
  [252, 180, 0],   // 9: keg gold / brass
  [0, 216, 252],   // 10: cyan drone rotors
  [36, 36, 72],    // 11: dark armor / pants
  [108, 108, 144], // 12: metallic chassis
  [252, 252, 36],  // 13: hazard yellow
  [252, 108, 0],   // 14: orange vest / barrel
  [252, 252, 252], // 15: flash white
];

// PAL3: Level 1 Dual-Plane Backgrounds (Skyline Plane B + Street Plane A)
const PAL_BG = [
  [0, 0, 36],      // 0: deep night sky (BG color)
  [0, 0, 0],       // 1: pure dark outline
  [36, 36, 72],    // 2: distant skyline silhouette
  [72, 36, 108],   // 3: purple twilight horizon
  [36, 72, 108],   // 4: industrial steel blue
  [36, 36, 36],    // 5: road asphalt dark
  [72, 72, 72],    // 6: road asphalt mid / curb
  [108, 108, 108], // 7: sidewalk concrete
  [144, 36, 36],   // 8: pub red brick wall
  [108, 36, 36],   // 9: pub brick shadow
  [36, 252, 36],   // 10: neon green PIVO sign
  [252, 180, 0],   // 11: warm bar window / streetlamp
  [252, 252, 36],  // 12: road yellow stripe / lamp core
  [0, 216, 252],   // 13: cyan neon trim
  [252, 36, 144],  // 14: pink neon bar sign
  [216, 216, 216], // 15: bright moon / highlight
];

// ============================================================================
// 1. HERO SPRITESHEETS (32x48 per frame = 4x6 tiles, 4 cols x 5 rows = 128x240)
//    Row 0: Idle (2 frames)
//    Row 1: Walk (4 frames)
//    Row 2: Jump (2 frames)
//    Row 3: Melee Swing (3 frames: shoulder windup, arc, smash)
//    Row 4: Shoot (2 frames) + Hurt (2 frames) -> actually Row 4 = Shoot (2), Row 5 = Hurt (2)
// ============================================================================
function drawHeroBase(s, ox, oy, hero, opts = {}) {
  const { bob = 0, stride = 0, jumping = false, hurt = false, shooting = false, meleePhase = -1 } = opts;
  const isZavod = hero === 'zavod';
  const y0 = oy + bob + (jumping ? -3 : 0);
  const cx = ox + 15;

  const outline = hurt ? 15 : 1;
  const jacket = hurt ? 15 : isZavod ? 7 : 5;
  const shirt = hurt ? 15 : isZavod ? 8 : 6;
  const pants = hurt ? 15 : isZavod ? 5 : 9;
  const skin = hurt ? 15 : 2;
  const hair = isZavod ? 11 : 4;

  // Boots & Legs
  const leftLegX = cx - 5 + stride;
  const rightLegX = cx + 1 - stride;
  const legH = jumping ? 8 : 12;
  s.box(leftLegX, y0 + 32, 5, legH, pants, outline);
  s.box(rightLegX, y0 + 32, 5, legH, pants, outline);
  s.box(leftLegX - 1, y0 + 32 + legH - 3, 6, 4, 5, outline);
  s.box(rightLegX, y0 + 32 + legH - 3, 6, 4, 5, outline);

  // Torso
  const torsoW = isZavod ? 16 : 14;
  s.box(cx - Math.floor(torsoW / 2), y0 + 17, torsoW, 16, jacket, outline);
  // Inner shirt stripe & belt
  s.rect(cx - 2, y0 + 19, 5, 11, shirt);
  s.rect(cx - Math.floor(torsoW / 2) + 1, y0 + 30, torsoW - 2, 2, 10);
  if (isZavod) {
    // High-vis factory straps
    s.rect(cx - 6, y0 + 18, 2, 12, 11);
    s.rect(cx + 4, y0 + 18, 2, 12, 11);
  } else {
    // Vadek leather collar & gold chain
    s.rect(cx - 4, y0 + 18, 8, 2, 10);
  }

  // Head
  s.box(cx - 5, y0 + 6, 10, 11, skin, outline);
  if (isZavod) {
    // Yellow factory hard hat + airsoft skull/red visor mask
    s.box(cx - 6, y0 + 3, 12, 5, hair, outline);
    s.rect(cx - 7, y0 + 7, 14, 2, 10);
    s.rect(cx - 3, y0 + 10, 7, 3, 13); // visor
    s.rect(cx - 4, y0 + 13, 8, 3, 5);  // tactical mask
  } else {
    // Vadek salt-and-pepper hair + shades + beard
    s.box(cx - 5, y0 + 4, 10, 4, hair, outline);
    s.rect(cx - 2, y0 + 10, 7, 2, 1);  // sunglasses
    s.px(cx + 3, y0 + 10, 15);
    s.rect(cx - 3, y0 + 14, 7, 2, 3);  // stubble
  }

  // Arms & Weapons
  if (meleePhase >= 0) {
    if (isZavod) {
      // Heavy Steel Pipe over-the-shoulder smash!
      if (meleePhase === 0) {
        // Windup behind shoulder
        s.box(cx - 8, y0 + 13, 5, 7, jacket, outline);
        s.line(cx - 7, y0 + 15, cx - 13, y0 + 2, 14, 3);
        s.line(cx - 7, y0 + 14, cx - 13, y0 + 1, 15, 1);
      } else if (meleePhase === 1) {
        // Overhead smash arc
        s.box(cx + 2, y0 + 14, 6, 5, jacket, outline);
        s.line(cx + 4, y0 + 14, cx + 15, y0 + 3, 14, 3);
        s.line(cx + 5, y0 + 13, cx + 15, y0 + 2, 11, 2);
      } else {
        // Brutal forward impact + sparks
        s.box(cx + 4, y0 + 19, 6, 5, jacket, outline);
        s.box(cx + 7, y0 + 19, 10, 4, 14, 1);
        s.rect(cx + 8, y0 + 20, 8, 1, 15);
        s.px(cx + 15, y0 + 15, 11);
        s.px(cx + 16, y0 + 24, 11);
        s.px(cx + 13, y0 + 14, 15);
      }
    } else {
      // Vadek Car Wheel with alloy rim over-the-shoulder slam!
      if (meleePhase === 0) {
        s.box(cx - 8, y0 + 14, 5, 6, jacket, outline);
        s.circle(cx - 9, y0 + 8, 5, 1);
        s.circle(cx - 9, y0 + 8, 4, 5);
        s.circle(cx - 9, y0 + 8, 2, 14);
      } else if (meleePhase === 1) {
        s.box(cx + 2, y0 + 13, 6, 5, jacket, outline);
        s.circle(cx + 9, y0 + 10, 6, 1);
        s.circle(cx + 9, y0 + 10, 5, 5);
        s.circle(cx + 9, y0 + 10, 2, 14);
        s.px(cx + 9, y0 + 10, 15);
      } else {
        s.box(cx + 4, y0 + 19, 6, 5, jacket, outline);
        s.circle(cx + 11, y0 + 22, 6, 1);
        s.circle(cx + 11, y0 + 22, 5, 5);
        s.circle(cx + 11, y0 + 22, 2, 14);
        s.px(cx + 11, y0 + 22, 10);
        s.px(cx + 16, y0 + 17, 11);
        s.px(cx + 16, y0 + 27, 11);
      }
    }
  } else {
    // Ranged Weapon (Shotgun for Vadek / Domna Flamethrower for Zavod)
    const armY = y0 + 20;
    s.box(cx + 2, armY, 6, 5, jacket, outline);
    if (isZavod) {
      s.box(cx + 4, armY + 1, 11, 5, 8, 1);
      s.rect(cx + 6, armY + 2, 6, 2, 14);
      s.rect(cx + 14, armY + 2, 2, 3, 11);
    } else {
      s.box(cx + 4, armY + 1, 11, 4, 5, 1);
      s.rect(cx + 6, armY + 2, 8, 1, 14);
      s.rect(cx + 4, armY + 3, 4, 2, 10);
    }
    if (shooting) {
      s.circle(cx + 15, armY + 2, 2, 11);
      s.px(cx + 15, armY + 2, 15);
    }
  }
}

function buildHeroSheet(hero, filename) {
  // 4 cols x 6 rows of 32x48 = 128x288
  const s = new PixelSurface(128, 288);
  // Row 0: Idle (2 frames)
  drawHeroBase(s, 0, 0, hero, { bob: 0 });
  drawHeroBase(s, 32, 0, hero, { bob: 1 });
  // Row 1: Walk (4 frames)
  drawHeroBase(s, 0, 48, hero, { stride: 3, bob: 0 });
  drawHeroBase(s, 32, 48, hero, { stride: 0, bob: -1 });
  drawHeroBase(s, 64, 48, hero, { stride: -3, bob: 0 });
  drawHeroBase(s, 96, 48, hero, { stride: 0, bob: -1 });
  // Row 2: Jump (2 frames)
  drawHeroBase(s, 0, 96, hero, { jumping: true, stride: 2 });
  drawHeroBase(s, 32, 96, hero, { jumping: true, stride: -2 });
  // Row 3: Melee Over-the-Shoulder Swing (3 frames)
  drawHeroBase(s, 0, 144, hero, { meleePhase: 0 });
  drawHeroBase(s, 32, 144, hero, { meleePhase: 1 });
  drawHeroBase(s, 64, 144, hero, { meleePhase: 2 });
  // Row 4: Shoot (2 frames)
  drawHeroBase(s, 0, 192, hero, { shooting: true });
  drawHeroBase(s, 32, 192, hero, { shooting: false, bob: 1 });
  // Row 5: Hurt (2 frames)
  drawHeroBase(s, 0, 240, hero, { hurt: true, bob: -1 });
  drawHeroBase(s, 32, 240, hero, { hurt: false, stride: -2 });

  s.save(filename, PAL_HEROES);
}

buildHeroSheet('vadek', 'vadek.png');
buildHeroSheet('zavod', 'zavod.png');

// ============================================================================
// 2. ENEMY: DRUNK PUNK (32x48 = 4x6 tiles, 4 cols x 3 rows = 128x144)
// ============================================================================
function drawDrunkFrame(s, ox, oy, stride, attack, hurt) {
  const cx = ox + 15;
  const o = hurt ? 15 : 1;
  // Legs
  s.box(cx - 5 + stride, oy + 32, 5, 12, hurt ? 15 : 11, o);
  s.box(cx + 1 - stride, oy + 32, 5, 12, hurt ? 15 : 11, o);
  s.box(cx - 5 + stride, oy + 41, 6, 3, 1, o);
  s.box(cx + 1 - stride, oy + 41, 6, 3, 1, o);
  // Ripped punk jacket + toxic green stained tee
  s.box(cx - 7, oy + 17, 14, 16, hurt ? 15 : 6, o);
  s.rect(cx - 3, oy + 19, 6, 12, hurt ? 15 : 4);
  // Head + purple mohawk
  s.box(cx - 5, oy + 7, 10, 10, hurt ? 15 : 2, o);
  s.rect(cx - 2, oy + 2, 4, 6, hurt ? 15 : 6);
  s.rect(cx - 4, oy + 10, 8, 2, 7); // angry red brow/bandana
  // Green beer bottle arm
  if (attack) {
    s.box(cx + 4, oy + 15, 7, 4, hurt ? 15 : 2, o);
    s.box(cx + 9, oy + 10, 4, 9, 4, 1);
    s.rect(cx + 10, oy + 8, 2, 3, 5);
  } else {
    s.box(cx + 3, oy + 20, 6, 4, hurt ? 15 : 6, o);
    s.box(cx + 7, oy + 16, 4, 8, 4, 1);
  }
}

{
  const s = new PixelSurface(128, 144);
  drawDrunkFrame(s, 0, 0, 3, false, false);
  drawDrunkFrame(s, 32, 0, 0, false, false);
  drawDrunkFrame(s, 64, 0, -3, false, false);
  drawDrunkFrame(s, 96, 0, 0, false, false);
  drawDrunkFrame(s, 0, 48, 2, true, false);
  drawDrunkFrame(s, 32, 48, -1, true, false);
  drawDrunkFrame(s, 0, 96, -2, false, true);
  drawDrunkFrame(s, 32, 96, 0, false, false);
  s.save('drunk.png', PAL_ENEMIES);
}

// ============================================================================
// 3. ENEMY: FLYING QUADCOPTER DRONE (32x24 = 4x3 tiles, 2 cols x 2 rows = 64x48)
// ============================================================================
function drawQuadDroneFrame(s, ox, oy, spin, hurt) {
  const o = hurt ? 15 : 1;
  // Twin rotor arms
  s.rect(ox + 3, oy + 10, 26, 3, hurt ? 15 : 12);
  s.rect(ox + 3, oy + 10, 26, 1, o);
  // Central armored pod
  s.box(ox + 9, oy + 8, 14, 9, hurt ? 15 : 11, o);
  s.rect(ox + 11, oy + 10, 10, 2, 13); // yellow hazard stripe
  // Glowing crimson targeting eye + gun turret underneath
  s.box(ox + 13, oy + 12, 6, 4, 7, 1);
  s.px(ox + 15, oy + 13, 15);
  s.box(ox + 14, oy + 17, 4, 4, 12, 1);
  // Spinning cyan rotors (left & right)
  const rW = spin ? 10 : 6;
  const rOff = spin ? 0 : 2;
  s.rect(ox + 1 + rOff, oy + 5, rW, 2, 10);
  s.rect(ox + 21 + rOff, oy + 5, rW, 2, 10);
  s.rect(ox + 5, oy + 7, 2, 4, 12);
  s.rect(ox + 25, oy + 7, 2, 4, 12);
  // Green exhaust LEDs
  s.px(ox + 4, oy + 12, 4);
  s.px(ox + 27, oy + 12, 4);
}

{
  const s = new PixelSurface(64, 48);
  drawQuadDroneFrame(s, 0, 0, true, false);
  drawQuadDroneFrame(s, 32, 0, false, false);
  drawQuadDroneFrame(s, 0, 24, true, true);
  drawQuadDroneFrame(s, 32, 24, false, false);
  s.save('quad_drone.png', PAL_ENEMIES);
}

// ============================================================================
// 4. BOSS: PIVNOY BARMEN (48x64 = 6x8 tiles, 4 cols x 3 rows = 192x192)
// ============================================================================
function drawBossBarmen(s, ox, oy, stride, attack, hurt) {
  const cx = ox + 24;
  const o = hurt ? 15 : 1;
  // Huge boots & legs
  s.box(cx - 10 + stride, oy + 44, 8, 16, hurt ? 15 : 11, o);
  s.box(cx + 2 - stride, oy + 44, 8, 16, hurt ? 15 : 11, o);
  s.box(cx - 11 + stride, oy + 56, 10, 5, 1, o);
  s.box(cx + 1 - stride, oy + 56, 10, 5, 1, o);
  // Massive barrel chest + stained white bartender apron
  s.box(cx - 14, oy + 20, 28, 26, hurt ? 15 : 14, o);
  s.box(cx - 10, oy + 24, 20, 22, hurt ? 15 : 8, o);
  // Toxic green beer splash on apron
  s.rect(cx - 6, oy + 30, 12, 6, 4);
  s.rect(cx - 3, oy + 36, 6, 4, 5);
  // Huge head + thick handlebar mustache + red headband
  s.box(cx - 8, oy + 6, 16, 15, hurt ? 15 : 2, o);
  s.rect(cx - 9, oy + 8, 18, 3, 7);
  s.rect(cx - 6, oy + 15, 12, 3, 1); // big dark mustache
  s.rect(cx - 5, oy + 12, 3, 2, 1);
  s.rect(cx + 2, oy + 12, 3, 2, 1);
  // Giant Green Beer Keg Weapon
  if (attack) {
    // Hoisting radioactive green keg overhead!
    s.box(cx - 16, oy + 12, 7, 12, hurt ? 15 : 2, o);
    s.box(cx + 9, oy + 12, 7, 12, hurt ? 15 : 2, o);
    s.box(cx - 12, oy + 1, 24, 13, 5, 1);
    s.rect(cx - 10, oy + 3, 20, 3, 9);
    s.rect(cx - 8, oy + 7, 16, 4, 4);
  } else {
    // Holding giant beer keg club at side
    s.box(cx + 10, oy + 24, 8, 12, hurt ? 15 : 2, o);
    s.box(cx + 13, oy + 26, 9, 16, 5, 1);
    s.rect(cx + 14, oy + 29, 7, 3, 9);
    s.rect(cx + 15, oy + 33, 5, 6, 4);
  }
}

{
  const s = new PixelSurface(192, 192);
  drawBossBarmen(s, 0, 0, 3, false, false);
  drawBossBarmen(s, 48, 0, 0, false, false);
  drawBossBarmen(s, 96, 0, -3, false, false);
  drawBossBarmen(s, 144, 0, 0, false, false);
  drawBossBarmen(s, 0, 64, 2, true, false);
  drawBossBarmen(s, 48, 64, -2, true, false);
  drawBossBarmen(s, 0, 128, -2, false, true);
  drawBossBarmen(s, 48, 128, 0, false, false);
  s.save('boss_barmen.png', PAL_ENEMIES);
}

// ============================================================================
// 5. PROJECTILES, EXPLOSIONS & HEAL PICKUPS (16x16 = 2x2 tiles, 4x4 = 64x64)
//    Row 0: Player Shots (Frame 0 = Shotgun Pellet, Frame 1 = Domna Flame)
//    Row 1: Enemy Shots (Frame 0 = Green Bottle, Frame 1 = Cyan Drone Laser)
//    Row 2: Explosion Burst (3 frames)
//    Row 3: Pickups (0 = Beer Mug, 1 = Shawarma, 2 = Fries, 3 = Pork Knuckle)
// ============================================================================
{
  const s = new PixelSurface(64, 64);

  // Row 0, Col 0: Shotgun pellet
  s.box(3, 5, 10, 6, 4, 1);
  s.rect(5, 6, 6, 4, 15);
  s.rect(7, 7, 3, 2, 7);

  // Row 0, Col 1: Domna flame burst
  s.circle(16 + 8, 8, 6, 9);
  s.circle(16 + 8, 8, 4, 8);
  s.circle(16 + 9, 8, 2, 15);

  // Row 1, Col 0: Enemy green beer bottle
  s.box(4, 16 + 4, 8, 9, 3, 1);
  s.box(6, 16 + 2, 4, 3, 13, 1);
  s.rect(6, 16 + 6, 2, 4, 7);

  // Row 1, Col 1: Quadcopter laser bolt
  s.box(16 + 2, 16 + 6, 12, 4, 6, 1);
  s.rect(16 + 4, 16 + 7, 8, 2, 7);

  // Row 2: Explosion 3 frames
  s.circle(8, 32 + 8, 4, 15);
  s.circle(8, 32 + 8, 2, 7);

  s.circle(16 + 8, 32 + 8, 7, 9);
  s.circle(16 + 8, 32 + 8, 5, 8);
  s.circle(16 + 8, 32 + 8, 3, 15);

  s.circle(32 + 8, 32 + 8, 6, 14);
  s.circle(32 + 5, 32 + 5, 2, 8);
  s.circle(32 + 11, 32 + 10, 2, 4);

  // Row 3, Col 0: Beer Mug
  s.box(3, 48 + 4, 9, 10, 4, 1);
  s.box(12, 48 + 6, 3, 6, 11, 1);
  s.box(3, 48 + 2, 9, 3, 7, 1);
  s.rect(5, 48 + 6, 2, 6, 15);

  // Row 3, Col 1: Shawarma wrap
  s.box(16 + 3, 48 + 3, 10, 11, 11, 1);
  s.rect(16 + 5, 48 + 4, 6, 3, 3);  // lettuce
  s.rect(16 + 5, 48 + 7, 6, 3, 10); // meat
  s.rect(16 + 4, 48 + 10, 8, 3, 9); // foil/wrap

  // Row 3, Col 2: Fries
  s.box(32 + 3, 48 + 7, 10, 7, 9, 1);
  s.rect(32 + 4, 48 + 2, 2, 6, 15);
  s.rect(32 + 7, 48 + 1, 2, 7, 4);
  s.rect(32 + 10, 48 + 3, 2, 5, 15);

  // Row 3, Col 3: Pork Knuckle
  s.box(48 + 4, 48 + 4, 9, 8, 10, 1);
  s.rect(48 + 5, 48 + 5, 6, 3, 8);
  s.box(48 + 2, 48 + 11, 4, 3, 7, 1);
  s.box(48 + 11, 48 + 2, 3, 4, 7, 1);

  s.save('fx.png', PAL_UI);
}

// ============================================================================
// 6. BACKGROUND PLANE B: NIGHT INDUSTRIAL SKYLINE (512x224 = 64x28 tiles)
//    Seamless 256px repeating pattern tiled twice so Hardware HScroll wraps forever!
// ============================================================================
{
  const s = new PixelSurface(512, 224);
  // Night sky gradient bands
  s.rect(0, 0, 512, 64, 0);
  s.rect(0, 64, 512, 36, 2);
  s.rect(0, 100, 512, 30, 3);
  s.rect(0, 130, 512, 94, 0);

  for (let rep = 0; rep < 2; rep++) {
    const bx = rep * 256;
    // Stars
    const stars = [
      [14, 18], [48, 32], [82, 14], [120, 26], [164, 16], [202, 36], [238, 20],
      [30, 48], [96, 44], [148, 52], [220, 48],
    ];
    for (const [sx, sy] of stars) s.px(bx + sx, sy, 15);

    // Toxic full moon
    s.circle(bx + 196, 38, 14, 10);
    s.circle(bx + 194, 36, 11, 15);

    // Distant factory silhouettes & smokestacks
    const buildings = [
      [0, 62, 38, 80, 2],
      [38, 48, 34, 94, 4],
      [72, 74, 44, 68, 2],
      [116, 40, 32, 102, 4],
      [148, 66, 46, 76, 2],
      [194, 54, 34, 88, 4],
      [228, 72, 28, 70, 2],
    ];
    for (const [x, y, w, h, c] of buildings) {
      s.box(bx + x, y, w, h, c, 1);
      // Lit windows
      for (let wy = y + 8; wy < y + h - 18; wy += 10) {
        for (let wx = x + 6; wx < x + w - 8; wx += 8) {
          if ((wx + wy) % 16 !== 0) {
            s.rect(bx + wx, wy, 4, 5, (wx + wy) % 24 === 0 ? 13 : 11);
          }
        }
      }
    }
    // Smokestacks with red/pink aircraft warning beacons
    s.box(bx + 46, 24, 10, 24, 2, 1);
    s.rect(bx + 48, 22, 6, 3, 14);
    s.box(bx + 124, 18, 10, 22, 2, 1);
    s.rect(bx + 126, 16, 6, 3, 10);
  }
  s.save('bg_sky.png', PAL_BG);
}

// ============================================================================
// 7. BACKGROUND PLANE A: LEVEL 1 PUB STREET "BAR ZAVODNOY" (512x224 = 64x28 tiles)
//    Top area transparent (index 0) so Plane B skyline shines through!
// ============================================================================
{
  const s = new PixelSurface(512, 224);
  for (let rep = 0; rep < 2; rep++) {
    const bx = rep * 256;

    // Bar brick facade (y = 56..119)
    s.box(bx + 0, 64, 112, 56, 8, 1);
    s.box(bx + 112, 72, 64, 48, 9, 1);
    s.box(bx + 176, 60, 80, 60, 8, 1);

    // Brick horizontal mortar lines
    for (let y = 70; y < 118; y += 8) {
      s.rect(bx + 2, y, 252, 1, 9);
    }

    // Glowing Neon "BAR / PIVO" signs
    s.box(bx + 14, 70, 84, 18, 1, 10);
    s.rect(bx + 20, 75, 72, 8, 10);
    s.rect(bx + 24, 77, 64, 4, 12);

    s.box(bx + 188, 68, 56, 16, 1, 14);
    s.rect(bx + 194, 73, 44, 6, 14);
    s.rect(bx + 198, 75, 36, 2, 15);

    // Warm Pub Windows & Door
    s.box(bx + 20, 94, 24, 24, 11, 1);
    s.rect(bx + 31, 94, 2, 24, 1);
    s.box(bx + 62, 92, 24, 28, 4, 1); // door
    s.rect(bx + 81, 106, 3, 3, 12);   // handle
    s.box(bx + 126, 92, 36, 20, 13, 1); // cyber terminal glass
    s.box(bx + 196, 94, 38, 24, 11, 1);

    // Sidewalk & Curb (y = 120..135)
    s.rect(bx + 0, 120, 256, 12, 7);
    s.rect(bx + 0, 132, 256, 4, 6);
    s.rect(bx + 0, 135, 256, 1, 1);
    for (let sx = 0; sx < 256; sx += 32) {
      s.rect(bx + sx, 120, 1, 15, 6);
    }

    // Streetlamp post
    s.box(bx + 168, 48, 4, 74, 6, 1);
    s.box(bx + 160, 44, 20, 6, 11, 1);
    s.rect(bx + 164, 46, 12, 3, 12);

    // Playable Asphalt Street (y = 136..223)
    s.rect(bx + 0, 136, 256, 88, 5);
    // Dashed yellow center road stripe
    for (let rx = 8; rx < 256; rx += 40) {
      s.rect(bx + rx, 178, 22, 4, 12);
    }
    // Subtle asphalt cracks & grit
    for (let rx = 12; rx < 256; rx += 28) {
      s.rect(bx + rx, 152 + (rx % 19), 6, 2, 6);
      s.rect(bx + rx + 8, 196 + (rx % 15), 8, 2, 6);
    }
  }
  s.save('bg_street.png', PAL_BG);
}

// ============================================================================
// 8. TITLE SCREEN BACKDROP (320x224 = 40x28 tiles, PAL_UI)
// ============================================================================
{
  const s = new PixelSurface(320, 224);
  s.rect(0, 0, 320, 224, 1);
  // Retro synth horizon grid stripes
  for (let y = 0; y < 224; y += 8) {
    s.rect(0, y, 320, 1, 2);
  }
  // Outer arcade neon frame
  s.box(8, 8, 304, 208, 1, 3);
  s.box(12, 12, 296, 200, 1, 6);

  // Stylized neon header banner box for title text
  s.box(24, 22, 272, 64, 2, 3);
  s.rect(26, 24, 268, 4, 3);
  s.rect(26, 80, 268, 4, 5);

  // Giant iconic overflowing Green Beer Mug emblem on left & right of banner
  for (const mx of [36, 262]) {
    s.box(mx, 36, 20, 34, 3, 1);
    s.box(mx + 20, 42, 6, 18, 11, 1);
    s.box(mx - 2, 30, 24, 9, 7, 1);
    s.rect(mx + 4, 42, 4, 22, 15);
    s.rect(mx + 12, 42, 4, 22, 13);
  }

  // Bottom industrial silhouette
  s.rect(14, 182, 292, 28, 2);
  for (let x = 18; x < 300; x += 28) {
    const h = 14 + ((x * 7) % 20);
    s.box(x, 184 - h, 22, h, 2, 13);
  }

  s.save('title_bg.png', PAL_UI);
}

console.log('✓ Exported all 4bpp Sega Mega Drive PNG sprites & backgrounds to megadrive/res/gfx/');
