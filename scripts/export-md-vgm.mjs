/**
 * Exports Sega Mega Drive YM2612 (FM) + SN76489 (PSG) VGM v1.50 music tracks
 * derived from GREEN BEER PIZEDES's soundtrack patterns + 14000 Hz 8-bit PCM
 * WAV sound effects for SGDK's XGM driver into megadrive/res/sfx/.
 *
 * Zero external dependencies!
 */

import fs from 'fs';
import path from 'path';

const OUT_DIR = path.join(process.cwd(), 'megadrive/res/sfx');
fs.mkdirSync(OUT_DIR, { recursive: true });

// ============================================================================
// 1. REAL YM2612 + SN76489 VGM v1.50 COMPILER (NTSC 60 Hz)
// ============================================================================

// Convert MIDI note number to YM2612 (block 0..7, fnum 0..2047) for NTSC 7.670454 MHz clock
function midiToYm2612(midi) {
  const freq = 440 * Math.pow(2, (midi - 69) / 12);
  // YM2612 formula: fnum = (144 * freq * 2^(20 - block)) / 7670454
  let block = 4;
  let fnum = Math.round((144 * freq * Math.pow(2, 20 - block)) / 7670454);
  while (fnum > 2047 && block < 7) {
    block++;
    fnum = Math.round((144 * freq * Math.pow(2, 20 - block)) / 7670454);
  }
  while (fnum < 512 && block > 0) {
    block--;
    fnum = Math.round((144 * freq * Math.pow(2, 20 - block)) / 7670454);
  }
  return { block, fnum: Math.max(1, Math.min(2047, fnum)) };
}

class VgmBuilder {
  constructor() {
    this.cmds = [];
    this.totalSamples = 0;
    this.loopOffsetCmdIdx = 0;
    this.loopSamples = 0;
  }
  ym0(reg, val) {
    this.cmds.push(0x52, reg & 0xff, val & 0xff);
  }
  ym1(reg, val) {
    this.cmds.push(0x53, reg & 0xff, val & 0xff);
  }
  psg(val) {
    this.cmds.push(0x50, val & 0xff);
  }
  waitFrame60() {
    this.cmds.push(0x62); // 735 samples (1 NTSC 60Hz frame)
    this.totalSamples += 735;
  }
  waitFrames(n) {
    for (let i = 0; i < n; i++) this.waitFrame60();
  }
  markLoop() {
    this.loopOffsetCmdIdx = this.cmds.length;
    this.loopSamples = this.totalSamples;
  }

  // Load a punchy 4-op FM patch onto YM2612 channel 0..2 (port 0)
  loadFmPatch(ch, patch) {
    const opOffsets = [0, 8, 4, 12]; // OP1, OP2, OP3, OP4
    this.ym0(0xb0 + ch, ((patch.fb & 7) << 3) | (patch.alg & 7));
    this.ym0(0xb4 + ch, 0xc0); // L+R stereo output
    for (let op = 0; op < 4; op++) {
      const o = ch + opOffsets[op];
      const p = patch.ops[op];
      this.ym0(0x30 + o, ((p.dt & 7) << 4) | (p.mul & 15));
      this.ym0(0x40 + o, p.tl & 0x7f);
      this.ym0(0x50 + o, ((p.rs & 3) << 6) | (p.ar & 31));
      this.ym0(0x60 + o, p.d1r & 31);
      this.ym0(0x70 + o, p.d2r & 31);
      this.ym0(0x80 + o, ((p.sl & 15) << 4) | (p.rr & 15));
    }
  }

  noteOn(ch, midi) {
    this.ym0(0x28, ch & 7); // Key OFF first for crisp retrigger
    const { block, fnum } = midiToYm2612(midi);
    this.ym0(0xa4 + ch, ((block & 7) << 3) | ((fnum >> 8) & 7));
    this.ym0(0xa0 + ch, fnum & 0xff);
    this.ym0(0x28, 0xf0 | (ch & 7)); // Key ON all 4 ops
  }

  noteOff(ch) {
    this.ym0(0x28, ch & 7);
  }

  // PSG Ch3 Noise burst for crisp Sega hi-hats & snares
  psgNoise(type, vol) {
    // Latch noise control: 1 11 0 0 FB NF1 NF0 -> 0xE4 = white noise high, 0xE5 = mid, 0xE6 = low
    this.psg(type);
    this.psg(0xf0 | (vol & 0x0f)); // 0 = loudest, 15 = silent
  }

  psgMuteAll() {
    this.psg(0x9f);
    this.psg(0xbf);
    this.psg(0xdf);
    this.psg(0xff);
  }

  toBuffer() {
    this.cmds.push(0x66); // End of sound data
    const headerSize = 0x40;
    const dataBuf = Buffer.from(this.cmds);
    const out = Buffer.alloc(headerSize + dataBuf.length);

    out.write('Vgm ', 0x00, 4, 'ascii');
    out.writeUInt32LE(out.length - 4, 0x04); // EOF offset
    out.writeUInt32LE(0x00000150, 0x08);     // VGM 1.50
    out.writeUInt32LE(3579545, 0x0c);        // SN76489 NTSC clock
    out.writeUInt32LE(0, 0x10);
    out.writeUInt32LE(0, 0x14);
    out.writeUInt32LE(this.totalSamples, 0x18);
    // Loop offset relative to 0x1C
    const loopPos = headerSize + this.loopOffsetCmdIdx;
    out.writeUInt32LE(loopPos - 0x1c, 0x1c);
    out.writeUInt32LE(this.totalSamples - this.loopSamples, 0x20);
    out.writeUInt32LE(60, 0x24);             // 60 Hz NTSC rate
    out.writeUInt16LE(0x0009, 0x28);         // SN76489 feedback
    out.writeUInt8(16, 0x2a);                // SN76489 shift width
    out.writeUInt32LE(7670454, 0x2c);        // YM2612 NTSC clock
    out.writeUInt32LE(0x0c, 0x34);           // VGM data offset relative to 0x34 -> 0x40

    dataBuf.copy(out, headerSize);
    return out;
  }
}

// Classic Streets of Rage / Contra Hard Corps YM2612 FM Patches
const PATCH_SLAP_BASS = {
  alg: 4, fb: 6,
  ops: [
    { dt: 3, mul: 1, tl: 26, rs: 1, ar: 31, d1r: 14, d2r: 4, sl: 3, rr: 8 },
    { dt: 0, mul: 1, tl: 10, rs: 0, ar: 31, d1r: 10, d2r: 2, sl: 2, rr: 9 },
    { dt: 5, mul: 2, tl: 30, rs: 1, ar: 31, d1r: 16, d2r: 6, sl: 4, rr: 8 },
    { dt: 0, mul: 1, tl: 12, rs: 0, ar: 31, d1r: 8,  d2r: 2, sl: 2, rr: 9 },
  ],
};

const PATCH_FM_LEAD = {
  alg: 5, fb: 7,
  ops: [
    { dt: 3, mul: 2, tl: 24, rs: 1, ar: 31, d1r: 12, d2r: 4, sl: 3, rr: 7 },
    { dt: 0, mul: 1, tl: 14, rs: 0, ar: 31, d1r: 6,  d2r: 1, sl: 2, rr: 7 },
    { dt: 7, mul: 1, tl: 16, rs: 0, ar: 31, d1r: 8,  d2r: 2, sl: 2, rr: 7 },
    { dt: 1, mul: 2, tl: 18, rs: 0, ar: 31, d1r: 8,  d2r: 2, sl: 3, rr: 7 },
  ],
};

const PATCH_FM_ARP = {
  alg: 4, fb: 4,
  ops: [
    { dt: 0, mul: 3, tl: 34, rs: 1, ar: 31, d1r: 16, d2r: 6, sl: 4, rr: 9 },
    { dt: 0, mul: 1, tl: 20, rs: 0, ar: 31, d1r: 12, d2r: 4, sl: 3, rr: 9 },
    { dt: 2, mul: 2, tl: 36, rs: 1, ar: 31, d1r: 16, d2r: 6, sl: 4, rr: 9 },
    { dt: 6, mul: 1, tl: 22, rs: 0, ar: 31, d1r: 12, d2r: 4, sl: 3, rr: 9 },
  ],
};

function compileTrackToVgm({ framesPerStep, bass, lead, arp, kick, snare, hat }) {
  const v = new VgmBuilder();
  v.psgMuteAll();
  v.ym0(0x22, 0x00); // LFO off
  v.ym0(0x2b, 0x00); // DAC off (XGM controls DAC if PCM plays)
  v.loadFmPatch(0, PATCH_SLAP_BASS);
  v.loadFmPatch(1, PATCH_FM_LEAD);
  v.loadFmPatch(2, PATCH_FM_ARP);

  v.markLoop();
  const len = bass.length;
  for (let i = 0; i < len; i++) {
    const b = bass[i];
    const l = lead[i];
    const a = arp[i];

    if (b > 0) v.noteOn(0, b);
    else if (b === -1) v.noteOff(0);

    if (l > 0) v.noteOn(1, l);
    else if (l === -1) v.noteOff(1);

    if (a > 0) v.noteOn(2, a);
    else if (a === -1) v.noteOff(2);

    // Percussion via PSG Noise + PSG Tone punch
    if (snare[i]) {
      v.psgNoise(0xe5, 2);
    } else if (hat[i]) {
      v.psgNoise(0xe4, 5);
    } else if (kick[i]) {
      v.psgNoise(0xe6, 4);
    }

    for (let f = 0; f < framesPerStep; f++) {
      v.waitFrame60();
      if (f === 1) {
        if (hat[i] && !snare[i]) v.psg(0xff); // crisp 1-frame hi-hat
        if (snare[i]) v.psg(0xf6);
      }
      if (f === 2) {
        v.psg(0xff); // mute noise tail cleanly
      }
    }
  }
  return v.toBuffer();
}

// Track 1: Title Anthem (Streets of Rage 16-bit synth punch, 128 BPM ~ 7 frames/step)
const titleVgm = compileTrackToVgm({
  framesPerStep: 7,
  bass: [
    36, 0, 36, 48, 36, 0, 43, 0, 39, 0, 39, 51, 39, 0, 46, 0,
    41, 0, 41, 53, 41, 0, 48, 0, 43, 0, 46, 0, 43, 41, 39, 43,
  ],
  lead: [
    60, 0, 0, 63, 67, 0, 72, 0, 70, 0, 67, 0, 63, 0, 67, 0,
    65, 0, 0, 68, 72, 0, 75, 0, 74, 0, 72, 70, 67, 0, -1, 0,
  ],
  arp: [
    60, 63, 67, 72, 60, 63, 67, 72, 63, 67, 70, 75, 63, 67, 70, 75,
    65, 68, 72, 77, 65, 68, 72, 77, 67, 70, 74, 79, 67, 70, 74, 79,
  ],
  kick:  [1,0,0,0, 1,0,0,0, 1,0,0,0, 1,0,1,0, 1,0,0,0, 1,0,0,0, 1,0,0,0, 1,0,1,0],
  snare: [0,0,0,0, 1,0,0,0, 0,0,0,0, 1,0,0,1, 0,0,0,0, 1,0,0,0, 0,0,0,0, 1,0,1,0],
  hat:   [1,0,1,1, 1,0,1,0, 1,0,1,1, 1,0,1,0, 1,0,1,1, 1,0,1,0, 1,0,1,1, 1,1,1,1],
});
fs.writeFileSync(path.join(OUT_DIR, 'music_title.vgm'), titleVgm);

// Track 2: Level 1 Bar Zavodnoy (Funk-Rock Acid Street Beat, 136 BPM ~ 6 frames/step)
const level1Vgm = compileTrackToVgm({
  framesPerStep: 6,
  bass: [
    40, 40, 52, 40, 43, 0, 45, 47, 40, 40, 52, 40, 47, 0, 45, 43,
    36, 36, 48, 36, 39, 0, 43, 0,  38, 38, 50, 38, 43, 45, 47, 0,
  ],
  lead: [
    64, 0, 67, 0, 71, 0, 69, 67, 64, 0, 0, 62, 64, 0, -1, 0,
    72, 0, 71, 0, 69, 0, 67, 0,  66, 0, 69, 0, 71, 0, 76, 0,
  ],
  arp: [
    52, 55, 59, 64, 52, 55, 59, 64, 52, 55, 59, 64, 52, 55, 59, 64,
    48, 52, 55, 60, 48, 52, 55, 60, 50, 54, 57, 62, 50, 54, 57, 62,
  ],
  kick:  [1,0,1,0, 0,0,1,0, 1,0,0,1, 0,0,1,0, 1,0,1,0, 0,0,1,0, 1,0,1,0, 1,0,0,0],
  snare: [0,0,0,0, 1,0,0,0, 0,0,0,0, 1,0,0,1, 0,0,0,0, 1,0,0,0, 0,0,0,0, 1,0,1,1],
  hat:   [1,1,1,0, 1,1,1,0, 1,1,1,0, 1,1,1,0, 1,1,1,0, 1,1,1,0, 1,1,1,1, 1,1,1,1],
});
fs.writeFileSync(path.join(OUT_DIR, 'music_level1.vgm'), level1Vgm);

// Track 3: Boss Fight (Contra Hard Corps Metal Gallop, 155 BPM ~ 5 frames/step)
const bossVgm = compileTrackToVgm({
  framesPerStep: 5,
  bass: [
    38, 38, 38, 50, 38, 38, 41, 44, 38, 38, 38, 50, 44, 43, 41, 38,
    36, 36, 36, 48, 36, 36, 39, 43, 37, 37, 41, 44, 49, 44, 41, 37,
  ],
  lead: [
    62, 0, 65, 68, 69, 0, 68, 65, 62, 0, 74, 0, 73, 0, 70, 0,
    67, 0, 70, 72, 74, 0, 77, 0, 76, 74, 73, 70, 69, 0, -1, 0,
  ],
  arp: [
    50, 53, 57, 62, 50, 53, 57, 62, 50, 53, 56, 62, 50, 53, 56, 62,
    48, 51, 55, 60, 48, 51, 55, 60, 49, 53, 56, 61, 49, 53, 56, 61,
  ],
  kick:  [1,1,0,1, 0,1,1,0, 1,1,0,1, 0,1,1,0, 1,1,0,1, 0,1,1,0, 1,1,0,1, 1,1,1,0],
  snare: [0,0,1,0, 1,0,0,1, 0,0,1,0, 1,0,1,1, 0,0,1,0, 1,0,0,1, 0,0,1,0, 1,0,1,1],
  hat:   [1,0,1,0, 1,0,1,0, 1,0,1,0, 1,0,1,0, 1,0,1,0, 1,0,1,0, 1,0,1,0, 1,1,1,1],
});
fs.writeFileSync(path.join(OUT_DIR, 'music_boss.vgm'), bossVgm);

// ============================================================================
// 2. 14000 Hz 8-BIT UNSIGNED PCM WAV SFX GENERATOR (SGDK XGM Driver Ready)
// ============================================================================
function writeWav14k(filename, durationSec, sampleFn) {
  const rate = 14000;
  // Pad to multiple of 256 bytes (XGM DMA alignment best practice)
  const rawCount = Math.ceil((rate * durationSec) / 256) * 256;
  const pcm = Buffer.alloc(rawCount);
  for (let i = 0; i < rawCount; i++) {
    const t = i / rate;
    const progress = i / rawCount;
    const v = Math.max(-1, Math.min(1, sampleFn(t, progress)));
    pcm[i] = Math.round((v * 0.5 + 0.5) * 255) & 0xff;
  }

  const hdr = Buffer.alloc(44);
  hdr.write('RIFF', 0, 4, 'ascii');
  hdr.writeUInt32LE(36 + pcm.length, 4);
  hdr.write('WAVE', 8, 4, 'ascii');
  hdr.write('fmt ', 12, 4, 'ascii');
  hdr.writeUInt32LE(16, 16);
  hdr.writeUInt16LE(1, 20);      // PCM
  hdr.writeUInt16LE(1, 22);      // Mono
  hdr.writeUInt32LE(rate, 24);
  hdr.writeUInt32LE(rate, 28);
  hdr.writeUInt16LE(1, 32);
  hdr.writeUInt16LE(8, 34);      // 8-bit
  hdr.write('data', 36, 4, 'ascii');
  hdr.writeUInt32LE(pcm.length, 40);

  fs.writeFileSync(path.join(OUT_DIR, filename), Buffer.concat([hdr, pcm]));
}

// Jump: crisp upward 16-bit sweep
writeWav14k('sfx_jump.wav', 0.14, (t, p) => {
  const f = 190 + p * 460;
  const env = Math.pow(1 - p, 1.3);
  return (Math.sin(2 * Math.PI * f * t) > 0 ? 0.75 : -0.75) * env;
});

// Shoot: punchy arcade shotgun / flame blast
writeWav14k('sfx_shoot.wav', 0.16, (t, p) => {
  const noise = Math.random() * 2 - 1;
  const punch = Math.sin(2 * Math.PI * (240 - p * 180) * t);
  const env = Math.pow(1 - p, 2.0);
  return (noise * 0.65 + punch * 0.55) * env;
});

// Steel Pipe Clang (ZAVOD KILLER): hollow metallic FM ring!
writeWav14k('sfx_pipe.wav', 0.24, (t, p) => {
  const env = Math.pow(1 - p, 1.8);
  const ring =
    Math.sin(2 * Math.PI * 620 * t) * 0.45 +
    Math.sin(2 * Math.PI * 1380 * t) * 0.35 +
    Math.sin(2 * Math.PI * 2410 * t) * 0.25;
  const thud = p < 0.12 ? (Math.random() * 2 - 1) * 0.6 : 0;
  return (ring + thud) * env;
});

// Car Wheel Thud (VADEK): heavy hollow rubber slam!
writeWav14k('sfx_wheel.wav', 0.20, (t, p) => {
  const env = Math.pow(1 - p, 1.9);
  const f = 145 - p * 85;
  const bounce = Math.sin(2 * Math.PI * f * t) * 0.8 + Math.sin(2 * Math.PI * f * 2.1 * t) * 0.25;
  const slap = p < 0.15 ? (Math.random() * 2 - 1) * 0.5 : 0;
  return (bounce + slap) * env;
});

// Hit impact
writeWav14k('sfx_hit.wav', 0.11, (t, p) => {
  const env = Math.pow(1 - p, 2.2);
  return ((Math.random() * 2 - 1) * 0.7 + Math.sin(2 * Math.PI * (180 - p * 110) * t) * 0.5) * env;
});

// Explosion
writeWav14k('sfx_explosion.wav', 0.36, (t, p) => {
  const env = Math.pow(1 - p, 1.5);
  const rumble = Math.sin(2 * Math.PI * (95 - p * 60) * t) * 0.5;
  const blast = (Math.random() * 2 - 1) * 0.85;
  return (blast + rumble) * env;
});

// Beer / Food Heal Chime
writeWav14k('sfx_beer.wav', 0.22, (t, p) => {
  const step = p < 0.33 ? 523.25 : p < 0.66 ? 659.25 : 783.99;
  const env = Math.pow(1 - (p % 0.33) / 0.33, 1.1) * 0.75;
  return (Math.sin(2 * Math.PI * step * t) > 0 ? 1 : -1) * env;
});

console.log('✓ Exported YM2612+PSG VGM music (3 tracks) and 14kHz PCM WAV SFX (7 effects) to megadrive/res/sfx/');
