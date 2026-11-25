import { HeroId, WeaponId } from './types';
import { MusicTrack, TRACKS, TrackPattern, TrackSection } from './musicTracks';

export type { MusicTrack };

function midiToFreq(midi: number): number {
  const f = 440 * Math.pow(2, (midi - 69) / 12);
  return Math.max(28, Math.min(12000, f));
}

function clampFreq(f: number): number {
  return Math.max(30, Math.min(14000, f));
}

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
  private stepIndex = 0;
  private nextNoteTime = 0;
  private schedulerTimer: number | null = null;

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

      this.musicDrive = this.ctx.createWaveShaper();
      this.musicDrive.curve = makeTanhCurve(2.2);
      this.musicDrive.oversample = 'none';

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

    this.schedulerTimer = window.setInterval(() => {
      if (this.muted || !this.ctx) return;
      if (this.ctx.state !== 'running') {
        this.nextNoteTime = this.ctx.currentTime + 0.05;
        return;
      }

      const now = this.ctx.currentTime;
      const stepDur = 60 / pattern.bpm / 4;

      if (this.nextNoteTime < now - 0.1 || this.nextNoteTime > now + 0.5) {
        this.nextNoteTime = now + 0.03;
      }

      const totalSteps =
        pattern.arrangement && pattern.arrangement.length > 0 ? pattern.arrangement.length * 32 : 64;
      const loopResetStep =
        pattern.arrangement && pattern.loopStart !== undefined
          ? Math.min(pattern.loopStart * 32, Math.max(0, totalSteps - 32))
          : 0;

      let scheduledThisTick = 0;
      while (this.nextNoteTime < now + 0.085 && scheduledThisTick < 2) {
        try {
          this.scheduleStep(pattern, this.stepIndex, this.nextNoteTime, stepDur);
        } catch {
          // Ignore transient scheduler errors
        }
        this.nextNoteTime += stepDur;
        this.stepIndex++;
        if (this.stepIndex >= totalSteps) {
          this.stepIndex = loopResetStep;
        }
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

  private resolveSection(
    pattern: TrackPattern,
    globalStep: number
  ): { section: TrackSection | null; step: number; isSectionB: boolean; filterMult: number } {
    const step = globalStep % 32;
    if (pattern.arrangement && pattern.sections && pattern.arrangement.length > 0) {
      const arrIdx = Math.floor(globalStep / 32) % pattern.arrangement.length;
      const key = pattern.arrangement[arrIdx];
      const section = pattern.sections[key] ?? null;
      if (section) {
        const startF = section.filterMult ?? 1.0;
        const endF = section.filterRampTo ?? startF;
        const filterMult = startF + (endF - startF) * (step / 31);
        return { section, step, isSectionB: Boolean(section.intense), filterMult };
      }
    }
    const isSectionB = globalStep % 64 >= 32;
    return { section: null, step, isSectionB, filterMult: isSectionB ? 1.12 : 1.0 };
  }

  private triggerSectionPad(
    chord: number[],
    time: number,
    barDur: number,
    bus: AudioNode,
    filterMult: number,
    gainPeak = 0.09
  ): void {
    if (!this.ctx || chord.length === 0) return;
    const padFilter = this.ctx.createBiquadFilter();
    const padEnv = this.ctx.createGain();
    padFilter.type = 'lowpass';
    padFilter.Q.setValueAtTime(1.2, time);
    padFilter.frequency.setValueAtTime(clampFreq(520 * filterMult), time);
    padFilter.frequency.exponentialRampToValueAtTime(clampFreq(1500 * filterMult), time + barDur * 0.48);
    padFilter.frequency.exponentialRampToValueAtTime(clampFreq(640 * filterMult), time + barDur * 0.98);

    padEnv.gain.setValueAtTime(0.001, time);
    padEnv.gain.linearRampToValueAtTime(gainPeak, time + barDur * 0.14);
    padEnv.gain.setValueAtTime(gainPeak * 0.9, time + barDur * 0.72);
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

  private triggerCounterVoice(
    midi: number,
    time: number,
    stepDur: number,
    bus: AudioNode,
    filterMult: number,
    muffled?: boolean
  ): void {
    if (!this.ctx || midi <= 0) return;
    const freq = midiToFreq(midi);
    const osc = this.ctx.createOscillator();
    const filter = this.ctx.createBiquadFilter();
    const env = this.ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(freq, time);

    filter.type = 'lowpass';
    filter.Q.setValueAtTime(2.2, time);
    filter.frequency.setValueAtTime(clampFreq((muffled ? 900 : 3200) * filterMult), time);
    filter.frequency.exponentialRampToValueAtTime(clampFreq((muffled ? 420 : 1200) * filterMult), time + stepDur * 1.3);

    const dur = stepDur * 1.45;
    env.gain.setValueAtTime(0.001, time);
    env.gain.linearRampToValueAtTime(muffled ? 0.055 : 0.085, time + 0.008);
    env.gain.exponentialRampToValueAtTime(0.001, time + dur);

    osc.connect(filter);
    filter.connect(env);
    env.connect(bus);

    bindCleanup(osc, [osc, filter, env]);
    osc.start(time);
    osc.stop(time + dur + 0.02);
  }

  private scheduleStep(pattern: TrackPattern, globalStep: number, time: number, stepDur: number): void {
    if (!this.ctx || !this.musicDrive) return;
    if (pattern.isSynthwave) {
      this.scheduleSynthwaveStep(pattern, globalStep, time, stepDur);
      return;
    }
    const bus = this.musicDrive;
    const { section, step, isSectionB, filterMult } = this.resolveSection(pattern, globalStep);

    // 0. Optional Atmospheric Breakdown / Chorus Pad Chords (triggered on each bar start)
    if (step % 16 === 0 && section?.padChords) {
      const barInSec = Math.floor(step / 16) % section.padChords.length;
      const chord = section.padChords[barInSec];
      if (chord && chord.length > 0) {
        this.triggerSectionPad(chord, time, stepDur * 16, bus, filterMult, pattern.muffled ? 0.05 : 0.082);
      }
    }

    // 1. Track-Tailored 16-bit Sega Bass (Acid 303 / Slap Funk / Heavy Industrial / Galloping Rock)
    const bassSeq = section ? section.bass : isSectionB ? pattern.bassB : pattern.bassA;
    const bassNote = bassSeq[step] ?? 0;
    const accentArr = section?.acidAccent ?? pattern.acidAccent;
    if (bassNote > 0) {
      const accent = accentArr[step] === 1;
      const freq = midiToFreq(bassNote);
      const bStyle = pattern.bassStyle ?? 'acid';

      const osc = this.ctx.createOscillator();
      const mod = this.ctx.createOscillator();
      const modGain = this.ctx.createGain();
      const filter = this.ctx.createBiquadFilter();
      const env = this.ctx.createGain();

      osc.type = bStyle === 'slap_funk' ? 'triangle' : bStyle === 'rock_gallop' ? 'square' : 'sawtooth';
      osc.frequency.setValueAtTime(freq, time);

      mod.type = bStyle === 'slap_funk' ? 'sine' : 'square';
      const modRatio = bStyle === 'slap_funk' ? 3 : bStyle === 'industrial' ? 1.5 : 2;
      mod.frequency.setValueAtTime(clampFreq(freq * modRatio), time);
      const safeModDepth = Math.min(
        freq * 0.85,
        pattern.muffled
          ? 28
          : bStyle === 'slap_funk'
            ? accent
              ? 185
              : 75
            : bStyle === 'rock_gallop'
              ? 42
              : accent
                ? 115
                : 62
      );
      modGain.gain.setValueAtTime(safeModDepth, time);
      modGain.gain.exponentialRampToValueAtTime(3, time + stepDur * (bStyle === 'slap_funk' ? 0.52 : 0.85));

      filter.type = 'lowpass';
      filter.Q.setValueAtTime(Math.min(8.5, pattern.muffled ? 3.5 : pattern.acidQ ?? 7.5), time);
      const baseStartCut = pattern.muffled
        ? 420
        : bStyle === 'slap_funk'
          ? accent
            ? 3200
            : 1400
          : bStyle === 'rock_gallop'
            ? 1500
            : accent
              ? 2500
              : 1050;
      const endCut = pattern.muffled ? 170 : bStyle === 'rock_gallop' ? 360 : accent ? 340 : 210;
      filter.frequency.setValueAtTime(clampFreq(baseStartCut * filterMult), time);
      filter.frequency.exponentialRampToValueAtTime(clampFreq(endCut * Math.max(0.7, filterMult)), time + stepDur * 0.92);

      const bassDur = bStyle === 'slap_funk' ? stepDur * 0.95 : bStyle === 'industrial' ? stepDur * 1.25 : stepDur * 1.1;
      env.gain.setValueAtTime(0.001, time);
      env.gain.linearRampToValueAtTime(accent ? 0.34 : 0.25, time + 0.005);
      env.gain.exponentialRampToValueAtTime(0.001, time + bassDur);

      mod.connect(modGain);
      modGain.connect(osc.frequency);
      osc.connect(filter);
      filter.connect(env);
      env.connect(bus);

      const stopTime = time + bassDur + 0.02;
      bindCleanup(osc, [osc, mod, modGain, filter, env]);
      osc.start(time);
      mod.start(time);
      osc.stop(stopTime);
      mod.stop(stopTime);
    }

    // 2. Distinct Per-Level & Per-Section Lead Synth
    const leadSeq = section ? section.lead : isSectionB ? pattern.leadB : pattern.leadA;
    const rawLead = leadSeq ? (leadSeq[step] ?? 0) : 0;
    const leadNote = rawLead > 0 ? rawLead + (section?.leadOctave ?? 0) : 0;
    if (leadNote > 0) {
      const freq = midiToFreq(leadNote);
      const lType = section?.leadType ?? pattern.leadType ?? 'fm_shred';
      const osc1 = this.ctx.createOscillator();
      const osc2 = this.ctx.createOscillator();
      const filter = this.ctx.createBiquadFilter();
      const env = this.ctx.createGain();

      if (lType === 'funk_brass') {
        osc1.type = 'sawtooth';
        osc2.type = 'triangle';
        osc1.frequency.setValueAtTime(freq, time);
        osc2.frequency.setValueAtTime(clampFreq(freq * 0.5), time); // Warm octave-down brass body
        osc1.detune.setValueAtTime(-7, time);
        osc2.detune.setValueAtTime(7, time);
      } else if (lType === 'guitar_lead') {
        osc1.type = 'sawtooth';
        osc2.type = 'square';
        osc1.frequency.setValueAtTime(freq, time);
        osc2.frequency.setValueAtTime(clampFreq(freq * 1.498), time); // Power-5th biker rock harmony!
        osc1.detune.setValueAtTime(-6, time);
        osc2.detune.setValueAtTime(6, time);
      } else if (lType === 'arp_pulse') {
        osc1.type = 'square';
        osc2.type = 'triangle';
        osc1.frequency.setValueAtTime(freq, time);
        osc2.frequency.setValueAtTime(clampFreq(freq * 2), time); // Shimmering octave-up elevator chip arp
        osc1.detune.setValueAtTime(0, time);
        osc2.detune.setValueAtTime(5, time);
      } else if (lType === 'organ_lead') {
        osc1.type = 'square';
        osc2.type = 'sawtooth';
        osc1.frequency.setValueAtTime(freq, time);
        osc2.frequency.setValueAtTime(clampFreq(freq * 2), time); // Gothic cathedral 16-bit FM organ
        osc1.detune.setValueAtTime(-5, time);
        osc2.detune.setValueAtTime(5, time);
      } else {
        osc1.type = lType === 'fm_shred' ? 'square' : 'sawtooth';
        osc2.type = 'sawtooth';
        osc1.frequency.setValueAtTime(freq, time);
        osc2.frequency.setValueAtTime(freq, time);
        osc1.detune.setValueAtTime(-14, time);
        osc2.detune.setValueAtTime(14, time);
      }

      if (lType === 'hoover' && step % 4 === 0) {
        osc1.frequency.setValueAtTime(clampFreq(freq * 0.92), time);
        osc1.frequency.exponentialRampToValueAtTime(freq, time + stepDur * 0.45);
        osc2.frequency.setValueAtTime(clampFreq(freq * 0.92), time);
        osc2.frequency.exponentialRampToValueAtTime(freq, time + stepDur * 0.45);
      } else if (lType === 'siren' && step % 4 === 0) {
        osc1.frequency.exponentialRampToValueAtTime(clampFreq(freq * 1.045), time + stepDur * 0.5);
        osc1.frequency.exponentialRampToValueAtTime(freq, time + stepDur * 1.05);
      }

      filter.type = 'lowpass';
      filter.Q.setValueAtTime(
        pattern.muffled ? 2 : lType === 'arp_pulse' ? 6.5 : lType === 'funk_brass' ? 3.2 : 4.5,
        time
      );
      const leadStartCut = pattern.muffled
        ? 560
        : lType === 'funk_brass'
          ? 2800
          : lType === 'arp_pulse'
            ? 4800
            : isSectionB
              ? 4400
              : 3500;
      const leadEndCut = pattern.muffled
        ? 280
        : lType === 'arp_pulse'
          ? 900
          : lType === 'guitar_lead'
            ? 1750
            : 1100;
      filter.frequency.setValueAtTime(clampFreq(leadStartCut * filterMult), time);
      filter.frequency.exponentialRampToValueAtTime(clampFreq(leadEndCut * Math.max(0.65, filterMult)), time + stepDur * 1.15);

      const dur =
        lType === 'arp_pulse'
          ? stepDur * 0.85
          : lType === 'guitar_lead' || lType === 'organ_lead'
            ? stepDur * 1.75
            : stepDur * 1.25;
      const peakGain = pattern.muffled
        ? 0.1
        : lType === 'arp_pulse'
          ? 0.11
          : isSectionB
            ? 0.155
            : 0.13;
      env.gain.setValueAtTime(0.001, time);
      env.gain.linearRampToValueAtTime(peakGain, time + (lType === 'funk_brass' ? 0.018 : 0.006));
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

    // 2b. Optional Secondary Counter-Melody / Harmony / Breakdown Arp
    const counterNote = section?.counter ? (section.counter[step] ?? 0) : 0;
    if (counterNote > 0) {
      this.triggerCounterVoice(counterNote, time, stepDur, bus, filterMult, pattern.muffled);
    }

    // 3. Track-Tailored 90s Genesis Chord Stabs (Minor / Funk Maj7 / Rock Power-5th / Industrial Dim)
    const stabSeq = section ? section.stab : pattern.stab;
    const stabRoot = stabSeq ? (stabSeq[step] ?? 0) : 0;
    if (stabRoot > 0) {
      const chordKind = section?.stabChord ?? pattern.stabChord ?? 'minor';
      const intervals =
        chordKind === 'major7'
          ? [0, 3, 7, 10]
          : chordKind === 'power5'
            ? [0, 7, 12]
            : chordKind === 'dim'
              ? [0, 3, 6]
              : isSectionB
                ? [0, 6, 12]
                : [0, 3, 7];
      const stabFilter = this.ctx.createBiquadFilter();
      const stabEnv = this.ctx.createGain();
      stabFilter.type = 'bandpass';
      stabFilter.Q.setValueAtTime(chordKind === 'major7' ? 1.1 : 1.5, time);
      stabFilter.frequency.setValueAtTime(clampFreq((pattern.muffled ? 650 : 2200) * filterMult), time);
      stabFilter.frequency.exponentialRampToValueAtTime(
        clampFreq((pattern.muffled ? 320 : 720) * Math.max(0.7, filterMult)),
        time + stepDur * 1.45
      );

      stabEnv.gain.setValueAtTime(0.001, time);
      stabEnv.gain.linearRampToValueAtTime(pattern.muffled ? 0.11 : 0.16, time + 0.005);
      stabEnv.gain.exponentialRampToValueAtTime(0.001, time + stepDur * 1.5);

      stabFilter.connect(stabEnv);
      stabEnv.connect(bus);

      const stopTime = time + stepDur * 1.55;
      const oscs: OscillatorNode[] = [];
      for (let i = 0; i < intervals.length; i++) {
        const o = this.ctx.createOscillator();
        o.type = chordKind === 'major7' ? 'triangle' : 'sawtooth';
        o.frequency.setValueAtTime(midiToFreq(stabRoot + intervals[i]), time);
        o.connect(stabFilter);
        o.start(time);
        o.stop(stopTime);
        oscs.push(o);
      }
      bindCleanup(oscs[0], [...oscs, stabFilter, stabEnv]);
    }

    // 4. Hardcore Prodigy Breakbeat & Sega MD Industrial Drums
    const drumSeq = section ? section.drums : isSectionB ? pattern.drumsB : pattern.drumsA;
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

  private scheduleSynthwaveStep(
    pattern: TrackPattern,
    globalStep: number,
    time: number,
    stepDur: number
  ): void {
    if (!this.ctx || !this.musicDrive) return;
    const bus = this.musicDrive;
    const { section, step, isSectionB, filterMult } = this.resolveSection(pattern, globalStep);

    // 1. Warm Juno Pad Chords (per-section 2-bar chords or legacy 4-bar chords)
    if (step % 16 === 0) {
      let chord: number[] | undefined;
      if (section?.padChords && section.padChords.length > 0) {
        chord = section.padChords[Math.floor(step / 16) % section.padChords.length];
      } else if (pattern.padChords && pattern.padChords.length > 0) {
        chord = pattern.padChords[Math.floor(globalStep / 16) % pattern.padChords.length];
      }
      if (chord) {
        this.triggerSectionPad(chord, time, stepDur * 16, bus, filterMult, 0.11);
      }
    }

    // 2. Pulsing Analog Octave Bass
    const bassSeq = section ? section.bass : isSectionB ? pattern.bassB : pattern.bassA;
    const bassNote = bassSeq[step] ?? 0;
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
      filter.frequency.setValueAtTime(clampFreq((isStrong ? 1180 : 720) * filterMult), time);
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

    // 3. Shimmering Offbeat Synthwave Arp
    const arpSeq = section?.stab ?? pattern.stab;
    const arpNote = arpSeq ? (arpSeq[step] ?? 0) : 0;
    if (arpNote > 0 && step % 2 === 1) {
      const arpFreq = midiToFreq(arpNote);
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

    // 4. Nostalgic OutRun Lead + Optional Chorus Harmony
    const leadSeq = section ? section.lead : isSectionB ? pattern.leadB : pattern.leadA;
    const leadNote = leadSeq ? (leadSeq[step] ?? 0) : 0;
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
      lpf.frequency.setValueAtTime(clampFreq(2550 * filterMult), time);
      lpf.frequency.exponentialRampToValueAtTime(clampFreq(920 * filterMult), time + stepDur * 2.1);

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

    const counterNote = section?.counter ? (section.counter[step] ?? 0) : 0;
    if (counterNote > 0) {
      this.triggerCounterVoice(counterNote, time, stepDur, bus, filterMult, false);
    }

    // 5. Gated 80s Reverb Snare & Linndrum Toms
    const drumSeq = section ? section.drums : isSectionB ? pattern.drumsB : pattern.drumsA;
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

  public playHeroMelee(heroId: HeroId): void {
    this.unlock();
    if (!this.allowSfx('hero_melee', 45)) return;

    switch (heroId) {
      case 'zavod_killer':
        // Heavy hollow steel pipe CLANG!
        this.playNoise(0.08, 460, 'bandpass', 0.24);
        this.playTone(170, 58, 0.13, 'sawtooth', 0.24, 0.02);
        this.playTone(595, 575, 0.26, 'triangle', 0.24, 0.025);
        this.playTone(1215, 1175, 0.22, 'sine', 0.18, 0.025);
        this.playTone(1890, 1810, 0.15, 'square', 0.1, 0.03);
        break;
      case 'bo':
        // Mechanical RGB keyboard clatter-smash!
        this.playTone(235, 92, 0.09, 'square', 0.2, 0.015);
        this.playNoise(0.06, 3600, 'highpass', 0.22);
        this.playTone(2250, 1450, 0.028, 'square', 0.13, 0.02);
        this.playTone(3150, 1900, 0.025, 'square', 0.12, 0.045);
        this.playTone(2650, 1600, 0.026, 'square', 0.11, 0.072);
        this.playTone(3480, 2100, 0.022, 'square', 0.09, 0.098);
        break;
      case 'ded':
        // Brass hookah clang + bubbly water-pipe gurgle!
        this.playTone(840, 795, 0.19, 'triangle', 0.18, 0.02);
        this.playTone(1440, 1360, 0.14, 'sine', 0.12, 0.025);
        this.playTone(255, 445, 0.075, 'sine', 0.18, 0.045);
        this.playTone(345, 575, 0.075, 'sine', 0.15, 0.095);
        this.playNoise(0.11, 1300, 'bandpass', 0.17);
        break;
      case 'sandro':
        // Fat electric bass guitar string slap & power chord slam!
        this.playNoise(0.08, 680, 'bandpass', 0.24);
        this.playTone(82.4, 76, 0.3, 'sawtooth', 0.3, 0.02);
        this.playTone(110, 103, 0.26, 'triangle', 0.24, 0.025);
        this.playTone(164.8, 152, 0.2, 'sawtooth', 0.16, 0.025);
        this.playTone(330, 215, 0.12, 'sawtooth', 0.18, 0.02);
        break;
      case 'vano':
        // Fast flexible fishing rod whip-swish + spinning reel click!
        this.playNoise(0.13, 2400, 'bandpass', 0.26);
        this.playTone(380, 1980, 0.068, 'sine', 0.16, 0);
        this.playTone(1980, 520, 0.095, 'triangle', 0.16, 0.058);
        this.playTone(2850, 1550, 0.032, 'square', 0.11, 0.085);
        break;
      case 'hooper':
        // Punchy rock snare / tom drum smash + snare wire rattle!
        this.playTone(220, 86, 0.16, 'triangle', 0.3, 0.015);
        this.playTone(142, 56, 0.19, 'sine', 0.26, 0.015);
        this.playTone(980, 410, 0.042, 'square', 0.17, 0.015);
        this.playNoise(0.16, 2200, 'highpass', 0.28);
        break;
      case 'koren':
        // Elastic spongy-psychedelic giant mushroom whomp!
        this.playNoise(0.07, 460, 'lowpass', 0.2);
        this.playTone(135, 355, 0.08, 'sine', 0.27, 0.015);
        this.playTone(355, 110, 0.15, 'triangle', 0.24, 0.072);
        this.playTone(940, 1520, 0.11, 'sine', 0.13, 0.055);
        break;
      case 'vadek':
      default:
        // Heavy hollow pressurized rubber car tire thud & bounce!
        this.playNoise(0.09, 310, 'lowpass', 0.27);
        this.playTone(150, 46, 0.17, 'sine', 0.33, 0.015);
        this.playTone(72, 122, 0.085, 'triangle', 0.22, 0.08);
        this.playTone(122, 54, 0.12, 'sine', 0.18, 0.145);
        break;
    }
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

  public playVanHorn(): void {
    this.unlock();
    if (this.muted || !this.ctx || !this.sfxGain) return;
    if (!this.allowSfx('van_horn', 260)) return;
    const now = this.ctx.currentTime;
    const freqs = [349.23, 440];
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

  public playHarleyThrottle(accelerating = true): void {
    this.unlock();
    if (this.muted || !this.ctx || !this.sfxGain) return;
    if (!this.allowSfx('harley_rev', accelerating ? 135 : 220)) return;
    const now = this.ctx.currentTime;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(accelerating ? 310 : 195, now);
    filter.frequency.exponentialRampToValueAtTime(accelerating ? 560 : 230, now + 0.08);
    filter.frequency.exponentialRampToValueAtTime(accelerating ? 260 : 165, now + 0.19);
    filter.Q.setValueAtTime(2.6, now);

    const env = this.ctx.createGain();
    env.gain.setValueAtTime(0.001, now);
    env.gain.linearRampToValueAtTime(accelerating ? 0.24 : 0.11, now + 0.025);
    env.gain.setValueAtTime(accelerating ? 0.19 : 0.09, now + 0.09);
    env.gain.exponentialRampToValueAtTime(0.001, now + 0.21);

    filter.connect(env);
    env.connect(this.sfxGain);

    const osc1 = this.ctx.createOscillator();
    osc1.type = 'sawtooth';
    osc1.frequency.setValueAtTime(accelerating ? 54 : 42, now);
    osc1.frequency.exponentialRampToValueAtTime(accelerating ? 82 : 47, now + 0.09);
    osc1.frequency.exponentialRampToValueAtTime(accelerating ? 60 : 41, now + 0.2);

    const osc2 = this.ctx.createOscillator();
    osc2.type = 'triangle';
    osc2.frequency.setValueAtTime(accelerating ? 81 : 63, now);
    osc2.frequency.exponentialRampToValueAtTime(accelerating ? 124 : 71, now + 0.09);
    osc2.frequency.exponentialRampToValueAtTime(accelerating ? 90 : 62, now + 0.2);

    const lfo = this.ctx.createOscillator();
    const lfoGain = this.ctx.createGain();
    lfo.type = 'sine';
    lfo.frequency.setValueAtTime(accelerating ? 19 : 12, now);
    lfoGain.gain.setValueAtTime(accelerating ? 14 : 7, now);
    lfo.connect(lfoGain);
    lfoGain.connect(osc1.frequency);

    osc1.connect(filter);
    osc2.connect(filter);

    osc1.start(now);
    osc2.start(now);
    lfo.start(now);
    osc1.stop(now + 0.22);
    osc2.stop(now + 0.22);
    lfo.stop(now + 0.22);

    bindCleanup(osc1, [osc1, osc2, lfo, lfoGain, filter, env]);
  }
}

export const soundEngine = new SoundEngine();
