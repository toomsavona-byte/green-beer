import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Check, Eye, EyeOff, Home, Maximize2, Minimize2, Music, Trophy, Volume2, VolumeX, X } from 'lucide-react';
import { soundEngine } from '../game/audio';
import { GamepadControlMap, isGamepadBindingActive } from '../game/controls';
import {
  LeaderboardMode,
  loadLastPlayerName,
  submitLeaderboardScore,
} from '../game/leaderboard';
import { DifficultyId, HeroId } from '../game/types';
import { useGamepadMenuNav } from '../hooks/useGamepadMenuNav';

interface EndlessFinaleViewProps {
  score: number;
  highScore: number;
  heroes: HeroId[];
  difficulty: DifficultyId;
  gameMode: LeaderboardMode;
  crtScanlines: boolean;
  muted: boolean;
  isTouchDevice: boolean;
  renderScale: number;
  gamepadBindings?: GamepadControlMap;
  leaderboardOpen?: boolean;
  canShowFullscreen?: boolean;
  isFullscreen?: boolean;
  onToggleFullscreen?: () => void;
  onToggleMute: () => void;
  onScoreSaved?: (entryId: string, rank: number | null) => void;
  onOpenLeaderboard?: () => void;
  onReturnTitle: () => void;
}

interface BiomePalette {
  id: string;
  title: string;
  subtitle: string;
  skyTop: [number, number, number];
  skyMid: [number, number, number];
  skyLow: [number, number, number];
  skyHorizon: [number, number, number];
  waterTop: [number, number, number];
  waterBot: [number, number, number];
  sandLeft: [number, number, number];
  sandRight: [number, number, number];
  roadDark: [number, number, number];
  roadLight: [number, number, number];
  curbA: [number, number, number];
  curbB: [number, number, number];
  neonA: string;
  neonB: string;
  hasWaterLeft: boolean;
  hasWaterRight: boolean;
  leftTheme: 'hotels' | 'cliffs' | 'causeway' | 'strip';
  rightTheme: 'ocean' | 'malibu_surf' | 'causeway' | 'strip';
}

const BIOMES: BiomePalette[] = [
  {
    id: 'ocean_drive',
    title: 'OCEAN DRIVE · VICE CITY',
    subtitle: 'АР-ДЕКО НЕОН И УТРЕННИЙ ЗАЛИВ',
    skyTop: [18, 9, 44],
    skyMid: [82, 22, 102],
    skyLow: [224, 48, 138],
    skyHorizon: [255, 162, 82],
    waterTop: [46, 20, 88],
    waterBot: [21, 98, 134],
    sandLeft: [44, 24, 62],
    sandRight: [198, 126, 98],
    roadDark: [25, 22, 42],
    roadLight: [33, 28, 54],
    curbA: [255, 64, 168],
    curbB: [34, 211, 238],
    neonA: '#FF40A8',
    neonB: '#22D3EE',
    hasWaterLeft: false,
    hasWaterRight: true,
    leftTheme: 'hotels',
    rightTheme: 'ocean',
  },
  {
    id: 'malibu_coast',
    title: 'MALIBU PACIFIC HIGHWAY',
    subtitle: 'ТИХООКЕАНСКИЙ РАССВЕТ · КАЛИФОРНИЯ',
    skyTop: [22, 18, 58],
    skyMid: [112, 34, 96],
    skyLow: [242, 92, 120],
    skyHorizon: [255, 212, 114],
    waterTop: [34, 64, 116],
    waterBot: [28, 152, 168],
    sandLeft: [76, 46, 68],
    sandRight: [226, 166, 112],
    roadDark: [30, 26, 44],
    roadLight: [39, 34, 56],
    curbA: [251, 191, 36],
    curbB: [244, 114, 182],
    neonA: '#FBBF24',
    neonB: '#38BDF8',
    hasWaterLeft: false,
    hasWaterRight: true,
    leftTheme: 'cliffs',
    rightTheme: 'malibu_surf',
  },
  {
    id: 'neon_causeway',
    title: 'NEON BAY CAUSEWAY',
    subtitle: 'МОСТ ЧЕРЕЗ РОЗОВЫЙ ЗАЛИВ',
    skyTop: [12, 14, 48],
    skyMid: [54, 24, 108],
    skyLow: [196, 42, 142],
    skyHorizon: [255, 144, 94],
    waterTop: [24, 20, 74],
    waterBot: [14, 116, 148],
    sandLeft: [24, 34, 72],
    sandRight: [24, 34, 72],
    roadDark: [22, 24, 46],
    roadLight: [30, 32, 58],
    curbA: [34, 211, 238],
    curbB: [244, 63, 94],
    neonA: '#22D3EE',
    neonB: '#F43F5E',
    hasWaterLeft: true,
    hasWaterRight: true,
    leftTheme: 'causeway',
    rightTheme: 'causeway',
  },
  {
    id: 'sunset_strip',
    title: 'PALM BOULEVARD · SUNRISE STRIP',
    subtitle: 'БЕСКОНЕЧНАЯ ТРАССА ПАЛЬМ И МОТЕЛЕЙ',
    skyTop: [28, 10, 48],
    skyMid: [106, 24, 102],
    skyLow: [244, 63, 132],
    skyHorizon: [253, 196, 86],
    waterTop: [54, 22, 92],
    waterBot: [110, 42, 106],
    sandLeft: [52, 22, 64],
    sandRight: [56, 26, 68],
    roadDark: [28, 20, 44],
    roadLight: [37, 27, 56],
    curbA: [255, 92, 174],
    curbB: [253, 224, 71],
    neonA: '#FF5CAE',
    neonB: '#FDE047',
    hasWaterLeft: false,
    hasWaterRight: false,
    leftTheme: 'strip',
    rightTheme: 'strip',
  },
];

const EPILOGUE_LINES = [
  'ЗАВОД «ЗЕЛЁНЫЙ ПОТОК» УНИЧТОЖЕН — ЗЕЛЁНОЕ ПИВО НАВСЕГДА В ПРОШЛОМ',
  'VADEK ДАВИТ НА ГАЗ, ФУРГОН «ALUPKA 77» МЧИТ НАВСТРЕЧУ РАССВЕТУ',
  'SANDRO И ZAVOD KILLER УЖЕ ДОСТАЛИ ОХЛАЖДЁННЫЙ КРАФТ ИЗ БАГАЖНИКА',
  'DED ОТКРЫЛ ФОРТОЧКУ — ЗА ФУРГОНОМ ТЯНЕТСЯ ЛЁГКИЙ ШЛЕЙФ МИРА И ДОБРА',
  'VANO И KOREN СПОРЯТ, ГДЕ ЛУЧШИЙ СЁРФИНГ: В МАЛИБУ ИЛИ ПОД АЛУПКОЙ',
  'HOOPER КРУТИТ КАССЕТУ С СИНТИВЕЙВОМ, BO РАЗДАЁТ WI-FI С КРЫШИ',
  'БЕСКОНЕЧНОЕ ЛЕТО · БЕСКОНЕЧНЫЙ РАССВЕТ · GREEN BEER PIZEDES',
];

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function lerpRgb(
  c1: [number, number, number],
  c2: [number, number, number],
  t: number
): string {
  const r = Math.round(lerp(c1[0], c2[0], t));
  const g = Math.round(lerp(c1[1], c2[1], t));
  const b = Math.round(lerp(c1[2], c2[2], t));
  return `rgb(${r},${g},${b})`;
}

interface OncomingCar {
  z: number; // 1 (horizon) down to 0 (camera)
  laneOffset: number; // -0.52 oncoming lane
  color: string;
  accent: string;
  hairStyle: 'blonde' | 'brunette' | 'redhead';
  braColor: 'red' | 'green';
  wavePhase: number;
}

interface ExhaustPuff {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  alpha: number;
  isGreen: boolean;
}

export const EndlessFinaleView: React.FC<EndlessFinaleViewProps> = ({
  score,
  highScore,
  heroes,
  difficulty,
  gameMode,
  crtScanlines,
  muted,
  isTouchDevice,
  renderScale,
  gamepadBindings,
  leaderboardOpen = false,
  canShowFullscreen = false,
  isFullscreen = false,
  onToggleFullscreen,
  onToggleMute,
  onScoreSaved,
  onOpenLeaderboard,
  onReturnTitle,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [hudVisible, setHudVisible] = useState(true);
  const [biomeLabel, setBiomeLabel] = useState({
    title: BIOMES[0].title,
    subtitle: BIOMES[0].subtitle,
  });
  const [epilogueIdx, setEpilogueIdx] = useState(0);

  // Non-interrupting Hall of Fame score entry state (vanishes completely once submitted or skipped)
  const [showScoreEntry, setShowScoreEntry] = useState(true);
  const [playerName, setPlayerName] = useState<string>(() => loadLastPlayerName());
  const [submittingScore, setSubmittingScore] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [inputFocused, setInputFocused] = useState(false);
  const [savedNotice, setSavedNotice] = useState<string | null>(null);

  const effectiveScore = score > 0 ? score : highScore;

  // Interactive cruise state stored in refs for zero-re-render 60fps loop
  const steerInputRef = useRef(0); // -1..1 keyboard/touch steer
  const vanOffsetRef = useRef(0.18); // lane position (-0.65..0.65), defaults to right cruise lane
  const hornFlashRef = useRef(0);
  const pointerActiveRef = useRef(false);
  const pointerLastXRef = useRef(0);

  const triggerHorn = useCallback(() => {
    soundEngine.playVanHorn();
    hornFlashRef.current = 0.45;
  }, []);

  const handleSubmitScore = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (submittingScore) return;
      const trimmed = playerName.trim();
      if (!trimmed) {
        setSubmitError('ВВЕДИ ИМЯ');
        return;
      }
      setSubmittingScore(true);
      setSubmitError(null);
      try {
        soundEngine.unlock();
        const res = await submitLeaderboardScore({
          name: trimmed,
          score: effectiveScore,
          heroes,
          difficulty,
          mode: gameMode,
        });
        soundEngine.playMenuConfirm();
        // Immediately hide the input box so only the live running finale remains!
        setShowScoreEntry(false);
        setInputFocused(false);
        onScoreSaved?.(res.entry.id, res.rank);
        const rankText = res.rank ? `МЕСТО #${res.rank}` : 'ЗАПИСАНО В ТОП';
        setSavedNotice(rankText);
        window.setTimeout(() => setSavedNotice(null), 3200);
      } catch (err) {
        setSubmitError(err instanceof Error ? err.message : 'Ошибка записи');
      } finally {
        setSubmittingScore(false);
      }
    },
    [submittingScore, playerName, effectiveScore, heroes, difficulty, gameMode, onScoreSaved]
  );

  // Rotate epilogue captions every 7.5 seconds
  useEffect(() => {
    const id = window.setInterval(() => {
      setEpilogueIdx((prev) => (prev + 1) % EPILOGUE_LINES.length);
    }, 7500);
    return () => window.clearInterval(id);
  }, []);

  // Keyboard controls: Left/Right or A/D steer, Space honks, H toggles clean screen (ignored while typing name!)
  useEffect(() => {
    const pressed = new Set<string>();
    const updateSteer = () => {
      const left = pressed.has('ArrowLeft') || pressed.has('KeyA');
      const right = pressed.has('ArrowRight') || pressed.has('KeyD');
      steerInputRef.current = (right ? 1 : 0) - (left ? 1 : 0);
    };

    const isTypingInInput = () => {
      const el = document.activeElement;
      return Boolean(el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA'));
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (leaderboardOpen || isTypingInInput()) return;
      if (e.code === 'ArrowLeft' || e.code === 'KeyA' || e.code === 'ArrowRight' || e.code === 'KeyD') {
        pressed.add(e.code);
        updateSteer();
      } else if (e.code === 'Space') {
        e.preventDefault();
        triggerHorn();
      } else if (e.code === 'KeyH') {
        setHudVisible((v) => !v);
      } else if (e.code === 'KeyM') {
        onToggleMute();
      }
    };

    const onKeyUp = (e: KeyboardEvent) => {
      if (pressed.has(e.code)) {
        pressed.delete(e.code);
        updateSteer();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, [leaderboardOpen, onToggleMute, triggerHorn]);

  // Gamepad buttons in Endless Finale: A/○ honks horn, X/Y toggles HUD, B/✕ or START returns to title
  useGamepadMenuNav({
    enabled: !inputFocused && !leaderboardOpen,
    gamepadBindings,
    onConfirm: () => {
      soundEngine.unlock();
      triggerHorn();
    },
    onAlt: () => setHudVisible((v) => !v),
    onBack: () => {
      soundEngine.unlock();
      soundEngine.playMenuMove();
      onReturnTitle();
    },
    onStart: () => {
      soundEngine.unlock();
      soundEngine.playMenuMove();
      onReturnTitle();
    },
  });

  // Smooth continuous Left Stick / D-Pad steering for the Touring Van
  useEffect(() => {
    let rafId = 0;
    let gpSteering = false;
    const pollSteer = () => {
      const pads = navigator.getGamepads ? navigator.getGamepads() : [];
      let steer = 0;
      for (let i = 0; i < pads.length; i++) {
        const pad = pads[i];
        if (!pad || !pad.connected) continue;
        const ax = Number(pad.axes[0]) || 0;
        if (Math.abs(ax) > 0.22) {
          steer = ax;
          break;
        }
        const left =
          Boolean(pad.buttons[14]?.pressed) ||
          (gamepadBindings ? isGamepadBindingActive(pad, gamepadBindings.left) : false);
        const right =
          Boolean(pad.buttons[15]?.pressed) ||
          (gamepadBindings ? isGamepadBindingActive(pad, gamepadBindings.right) : false);
        if (left || right) {
          steer = (right ? 1 : 0) - (left ? 1 : 0);
          break;
        }
      }
      if (steer !== 0) {
        gpSteering = true;
        steerInputRef.current = steer;
      } else if (gpSteering) {
        gpSteering = false;
        steerInputRef.current = 0;
      }
      rafId = requestAnimationFrame(pollSteer);
    };
    rafId = requestAnimationFrame(pollSteer);
    return () => cancelAnimationFrame(rafId);
  }, [gamepadBindings]);

  // Main 60 FPS Endless Malibu / Vice City OutRun Canvas Loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const BASE_W = 1280;
    const BASE_H = 720;
    const safeScale = Number.isFinite(renderScale) ? renderScale : 1;
    const scale = Math.max(0.75, Math.min(1.5, safeScale));
    canvas.width = Math.round(BASE_W * scale);
    canvas.height = Math.round(BASE_H * scale);

    // Pre-generate deterministic stars & seagulls
    const stars = Array.from({ length: 48 }, (_, i) => ({
      x: ((i * 197 + 43) % 1240) + 20,
      y: ((i * 89 + 19) % 170) + 12,
      size: i % 5 === 0 ? 2.4 : 1.4,
      phase: i * 0.9,
    }));

    const seagulls = Array.from({ length: 6 }, (_, i) => ({
      x: 680 + i * 95,
      y: 120 + (i % 3) * 32,
      speed: 24 + (i % 3) * 11,
      phase: i * 1.4,
    }));

    const hairCycle: Array<OncomingCar['hairStyle']> = ['blonde', 'brunette', 'redhead'];
    const carColors: Array<{ color: string; accent: string }> = [
      { color: '#F43F5E', accent: '#FDE047' },
      { color: '#22D3EE', accent: '#FF40A8' },
      { color: '#A855F7', accent: '#38BDF8' },
      { color: '#F59E0B', accent: '#F472B6' },
    ];
    let spawnCounter = 3;

    const oncomingCars: OncomingCar[] = [
      {
        z: 0.86,
        laneOffset: -0.52,
        color: '#F43F5E',
        accent: '#FDE047',
        hairStyle: 'blonde',
        braColor: 'green',
        wavePhase: 0.3,
      },
      {
        z: 0.52,
        laneOffset: -0.52,
        color: '#22D3EE',
        accent: '#FF40A8',
        hairStyle: 'brunette',
        braColor: 'red',
        wavePhase: 2.1,
      },
      {
        z: 0.18,
        laneOffset: -0.52,
        color: '#A855F7',
        accent: '#38BDF8',
        hairStyle: 'redhead',
        braColor: 'green',
        wavePhase: 4.0,
      },
    ];

    const puffs: ExhaustPuff[] = [];
    let rafId = 0;
    let lastTime: number | null = null;
    let elapsed = 0;
    let distance = 0;
    let lastBiomeIdx = 0;
    let puffTimer = 0;
    let smokeTimer = 0;

    const BIOME_DURATION = 26; // seconds per biome
    const TRANSITION_DUR = 4.2; // smooth crossfade seconds

    const drawPalmTree = (
      x: number,
      baseY: number,
      h: number,
      lean: number,
      sway: number,
      tint: string,
      rimColor: string
    ) => {
      if (h < 6) return;
      const topX = x + lean * h * 0.34 + sway * h * 0.04;
      const topY = baseY - h;
      const midX = x + lean * h * 0.14;
      const midY = baseY - h * 0.52;

      // Trunk silhouette
      ctx.strokeStyle = tint;
      ctx.lineWidth = Math.max(1.5, h * 0.055);
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(x, baseY);
      ctx.quadraticCurveTo(midX, midY, topX, topY);
      ctx.stroke();

      // Sunset rim-light along trunk edge
      ctx.strokeStyle = rimColor;
      ctx.lineWidth = Math.max(0.8, h * 0.014);
      ctx.beginPath();
      ctx.moveTo(x + (lean > 0 ? -1 : 1) * h * 0.02, baseY);
      ctx.quadraticCurveTo(midX, midY, topX, topY);
      ctx.stroke();

      // Palm fronds (7 sweeping fronds)
      const frondCount = 7;
      for (let f = 0; f < frondCount; f++) {
        const angle = -Math.PI + (f / (frondCount - 1)) * Math.PI * 1.45 - 0.22 + sway * 0.08;
        const len = h * (0.28 + (f % 2) * 0.09);
        const fx = topX + Math.cos(angle) * len;
        const fy = topY + Math.sin(angle) * len * 0.65 + len * 0.28;
        const cx = topX + Math.cos(angle) * len * 0.55;
        const cy = topY + Math.sin(angle) * len * 0.45 - len * 0.12;

        ctx.strokeStyle = tint;
        ctx.lineWidth = Math.max(1.2, h * 0.028);
        ctx.beginPath();
        ctx.moveTo(topX, topY);
        ctx.quadraticCurveTo(cx, cy, fx, fy);
        ctx.stroke();
      }
    };

    const drawArtDecoHotel = (
      x: number,
      baseY: number,
      w: number,
      h: number,
      seed: number,
      neonA: string,
      neonB: string
    ) => {
      if (h < 10) return;
      const left = x - w;
      const top = baseY - h;

      // Building body (Vice City pastel-in-shadow silhouette)
      ctx.fillStyle = seed % 2 === 0 ? '#1E1138' : '#261442';
      ctx.fillRect(left, top, w, h);

      // Stepped Art Deco crown
      ctx.fillRect(left + w * 0.18, top - h * 0.11, w * 0.64, h * 0.11);
      ctx.fillRect(left + w * 0.36, top - h * 0.18, w * 0.28, h * 0.07);

      // Neon horizontal trim bands
      const trim = seed % 2 === 0 ? neonA : neonB;
      ctx.fillStyle = trim;
      ctx.fillRect(left, top + h * 0.08, w, Math.max(1.5, h * 0.025));
      ctx.fillRect(left + w * 0.18, top - h * 0.11, w * 0.64, Math.max(1.2, h * 0.02));

      // Lit hotel windows grid
      const cols = 4;
      const rows = 5;
      const winW = (w * 0.72) / cols;
      const winH = (h * 0.62) / rows;
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const lit = (seed + r * 3 + c * 5) % 4 !== 0;
          if (!lit) continue;
          ctx.fillStyle = (r + c + seed) % 3 === 0 ? '#FDE68A' : 'rgba(255,146,198,0.65)';
          ctx.fillRect(
            left + w * 0.14 + c * winW + winW * 0.18,
            top + h * 0.2 + r * winH + winH * 0.18,
            winW * 0.62,
            winH * 0.56
          );
        }
      }

      // Vertical neon hotel sign on right edge facing the road
      if (h > 36) {
        ctx.fillStyle = seed % 2 === 0 ? neonB : neonA;
        ctx.fillRect(x - w * 0.08, top + h * 0.16, Math.max(2, w * 0.07), h * 0.52);
      }
    };

    const drawMalibuCliffVilla = (x: number, baseY: number, w: number, h: number, seed: number) => {
      if (h < 10) return;
      // Rocky sandstone coastal bluff
      ctx.fillStyle = '#2B1838';
      ctx.beginPath();
      ctx.moveTo(x, baseY);
      ctx.lineTo(x - w * 1.35, baseY);
      ctx.lineTo(x - w * 1.25, baseY - h * 0.75);
      ctx.lineTo(x - w * 0.48, baseY - h * 0.92);
      ctx.lineTo(x - w * 0.15, baseY - h * 0.42);
      ctx.closePath();
      ctx.fill();

      // Sun-kissed rim on bluff crest
      ctx.strokeStyle = 'rgba(255, 184, 108, 0.55)';
      ctx.lineWidth = Math.max(1, h * 0.02);
      ctx.beginPath();
      ctx.moveTo(x - w * 0.48, baseY - h * 0.92);
      ctx.lineTo(x - w * 0.15, baseY - h * 0.42);
      ctx.stroke();

      // Modernist Malibu glass beach house perched on the bluff
      if (seed % 2 === 0 && h > 22) {
        const vw = w * 0.62;
        const vh = h * 0.24;
        const vx = x - w * 0.96;
        const vy = baseY - h * 0.92 - vh;
        ctx.fillStyle = '#19102A';
        ctx.fillRect(vx, vy, vw, vh);
        ctx.fillStyle = '#FDBA74';
        ctx.fillRect(vx + vw * 0.1, vy + vh * 0.28, vw * 0.8, vh * 0.44);
      }
    };

    const drawLifeguardTower = (x: number, baseY: number, h: number) => {
      if (h < 12) return;
      const w = h * 0.68;
      // Wooden stilts
      ctx.strokeStyle = '#311B3F';
      ctx.lineWidth = Math.max(1.2, h * 0.05);
      ctx.beginPath();
      ctx.moveTo(x - w * 0.3, baseY);
      ctx.lineTo(x - w * 0.22, baseY - h * 0.52);
      ctx.moveTo(x + w * 0.3, baseY);
      ctx.lineTo(x + w * 0.22, baseY - h * 0.52);
      ctx.stroke();

      // Cabin
      ctx.fillStyle = '#38BDF8';
      ctx.fillRect(x - w * 0.35, baseY - h * 0.9, w * 0.7, h * 0.4);
      // Slanted roof
      ctx.fillStyle = '#F8FAFC';
      ctx.fillRect(x - w * 0.44, baseY - h, w * 0.88, h * 0.12);
      // Window glowing with sunrise
      ctx.fillStyle = '#FDE047';
      ctx.fillRect(x - w * 0.22, baseY - h * 0.82, w * 0.44, h * 0.18);
    };

    const drawNeonStreetLamp = (
      x: number,
      baseY: number,
      h: number,
      side: -1 | 1,
      glowColor: string
    ) => {
      if (h < 10) return;
      ctx.strokeStyle = '#1E1535';
      ctx.lineWidth = Math.max(1.2, h * 0.032);
      ctx.beginPath();
      ctx.moveTo(x, baseY);
      ctx.lineTo(x, baseY - h);
      ctx.lineTo(x - side * h * 0.24, baseY - h * 0.96);
      ctx.stroke();

      const lx = x - side * h * 0.24;
      const ly = baseY - h * 0.95;
      const rad = Math.max(3, h * 0.12);
      const g = ctx.createRadialGradient(lx, ly, 0.5, lx, ly, rad);
      g.addColorStop(0, '#FFFFFF');
      g.addColorStop(0.35, glowColor);
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(lx, ly, rad, 0, Math.PI * 2);
      ctx.fill();
    };

    const drawRetroSportsCar = (
      cx: number,
      cy: number,
      scaleFactor: number,
      car: OncomingCar,
      t: number
    ) => {
      const w = 138 * scaleFactor;
      const h = 48 * scaleFactor;
      if (w < 8) return;

      // Ground shadow
      ctx.fillStyle = 'rgba(0,0,0,0.45)';
      ctx.fillRect(cx - w * 0.56, cy - h * 0.08, w * 1.12, h * 0.18);

      // 1. Open-top 80s Convertible Cabin & Waving Girl (drawn before front windshield frame!)
      if (scaleFactor > 0.12) {
        const hairPalettes = {
          blonde: { main: '#FDE047', hi: '#FEF9C3', dark: '#CA8A04', top: '#FF40A8' },
          brunette: { main: '#3B2314', hi: '#6B4226', dark: '#1C0F08', top: '#22D3EE' },
          redhead: { main: '#EA580C', hi: '#FB923C', dark: '#9A3412', top: '#A855F7' },
        };
        const pal = hairPalettes[car.hairStyle];
        const girlX = cx + w * 0.13; // Passenger/center-right open seat facing our van!
        const shoulderY = cy - h * 0.88;
        const headR = Math.max(2.2, w * 0.095);
        const headY = shoulderY - headR * 1.35;
        const wind = Math.sin(t * 13 + car.wavePhase) * headR * 0.35;

        // Interior dark convertible headrest / cabin backing
        ctx.fillStyle = '#140B24';
        ctx.fillRect(cx - w * 0.34, cy - h * 0.92, w * 0.68, h * 0.42);

        // Wind-blown back hair volume (blonde / brunette / redhead)
        ctx.fillStyle = pal.dark;
        ctx.beginPath();
        ctx.ellipse(girlX - headR * 0.2 + wind * 0.5, headY + headR * 0.4, headR * 1.45, headR * 1.35, -0.15, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = pal.main;
        ctx.beginPath();
        ctx.ellipse(girlX + wind * 0.7, headY + headR * 0.25, headR * 1.35, headR * 1.2, 0.12, 0, Math.PI * 2);
        ctx.fill();

        // Shoulders & bright summer top
        ctx.fillStyle = '#F5C2A3';
        ctx.beginPath();
        ctx.ellipse(girlX, shoulderY + headR * 0.2, headR * 1.25, headR * 0.75, 0, Math.PI, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = pal.top;
        ctx.fillRect(girlX - headR * 0.9, shoulderY + headR * 0.15, headR * 1.8, headR * 0.95);

        // Raised waving arm toward our van + fluttering red/green bra in hand!
        const waveSwing = Math.sin(t * 11 + car.wavePhase);
        const shoulderArmX = girlX + headR * 0.85;
        const shoulderArmY = shoulderY + headR * 0.05;
        const elbowX = shoulderArmX + headR * (0.75 + waveSwing * 0.22);
        const elbowY = shoulderArmY - headR * 1.05;
        const handX = elbowX + headR * (0.45 + waveSwing * 0.72);
        const handY = elbowY - headR * (1.25 - Math.abs(waveSwing) * 0.18);

        ctx.strokeStyle = '#F5C2A3';
        ctx.lineWidth = Math.max(1.6, headR * 0.44);
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.beginPath();
        ctx.moveTo(shoulderArmX, shoulderArmY);
        ctx.lineTo(elbowX, elbowY);
        ctx.lineTo(handX, handY);
        ctx.stroke();

        // Second cheering arm raised slightly on left side
        const leftHandX = girlX - headR * (1.35 - waveSwing * 0.35);
        const leftHandY = shoulderY - headR * (1.45 + waveSwing * 0.25);
        ctx.beginPath();
        ctx.moveTo(girlX - headR * 0.8, shoulderArmY);
        ctx.lineTo(girlX - headR * 1.15, shoulderArmY - headR * 0.7);
        ctx.lineTo(leftHandX, leftHandY);
        ctx.stroke();

        // Face
        ctx.fillStyle = '#FAD1B6';
        ctx.beginPath();
        ctx.arc(girlX, headY, headR * 0.92, 0, Math.PI * 2);
        ctx.fill();

        // Retro 80s sunglasses
        ctx.fillStyle = '#0F172A';
        ctx.fillRect(girlX - headR * 0.68, headY - headR * 0.25, headR * 0.58, headR * 0.34);
        ctx.fillRect(girlX + headR * 0.1, headY - headR * 0.25, headR * 0.58, headR * 0.34);
        ctx.fillRect(girlX - headR * 0.12, headY - headR * 0.16, headR * 0.24, headR * 0.12);
        // Bright happy smile
        ctx.fillStyle = '#F43F5E';
        ctx.fillRect(girlX - headR * 0.26, headY + headR * 0.32, headR * 0.52, Math.max(1, headR * 0.18));

        // Top bangs / wind-swept hair crown
        ctx.fillStyle = pal.main;
        ctx.beginPath();
        ctx.arc(girlX, headY - headR * 0.32, headR * 0.96, Math.PI * 1.02, Math.PI * 1.98);
        ctx.fill();
        ctx.fillStyle = pal.hi;
        ctx.beginPath();
        ctx.arc(girlX + headR * 0.18, headY - headR * 0.55, headR * 0.45, Math.PI * 1.1, Math.PI * 1.85);
        ctx.fill();

        // Bright RED or GREEN BRA twirling/waving in her raised right hand!
        const braMain = car.braColor === 'red' ? '#FF1E4D' : '#22E538';
        const braTrim = car.braColor === 'red' ? '#FDA4AF' : '#BBF7D0';
        const braStrap = car.braColor === 'red' ? '#DC2626' : '#16A34A';
        const flutter = Math.sin(t * 15 + car.wavePhase) * 0.45;
        const cupR = Math.max(2.4, headR * 0.62);

        ctx.save();
        ctx.translate(handX, handY);
        ctx.rotate(waveSwing * 0.55 + flutter * 0.4);

        // Fluttering bra straps looped around her hand & trailing in the wind
        ctx.strokeStyle = braStrap;
        ctx.lineWidth = Math.max(1.2, cupR * 0.26);
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.quadraticCurveTo(cupR * 0.8, -cupR * 0.9, cupR * 1.4, -cupR * 0.1);
        ctx.moveTo(0, 0);
        ctx.quadraticCurveTo(cupR * 1.3, cupR * 0.95, cupR * 2.5, cupR * 0.35);
        // Trailing back strap flying in the wind
        ctx.moveTo(cupR * 2.5, cupR * 0.25);
        ctx.quadraticCurveTo(cupR * 3.4, -cupR * 0.2 + flutter * cupR, cupR * 3.9, cupR * 0.45);
        ctx.stroke();

        // Center bridge connecting the two cups
        ctx.strokeStyle = braMain;
        ctx.lineWidth = Math.max(1.5, cupR * 0.32);
        ctx.beginPath();
        ctx.moveTo(cupR * 0.9, cupR * 0.25);
        ctx.lineTo(cupR * 2.2, cupR * 0.35);
        ctx.stroke();

        // Left & right bra cups
        for (const offset of [
          { bx: cupR * 0.85, by: cupR * 0.25 },
          { bx: cupR * 2.15, by: cupR * 0.32 },
        ]) {
          ctx.fillStyle = braMain;
          ctx.beginPath();
          ctx.arc(offset.bx, offset.by, cupR * 0.72, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = braTrim;
          ctx.lineWidth = Math.max(0.8, cupR * 0.16);
          ctx.beginPath();
          ctx.arc(offset.bx, offset.by - cupR * 0.08, cupR * 0.56, Math.PI * 1.1, Math.PI * 1.9);
          ctx.stroke();
        }
        ctx.restore();
      }

      // 2. Low-slung 80s Convertible Body & Chrome Windshield Frame facing us
      ctx.fillStyle = car.color;
      ctx.beginPath();
      ctx.moveTo(cx - w * 0.52, cy);
      ctx.lineTo(cx - w * 0.48, cy - h * 0.54);
      ctx.lineTo(cx - w * 0.38, cy - h * 0.64);
      ctx.lineTo(cx + w * 0.38, cy - h * 0.64);
      ctx.lineTo(cx + w * 0.48, cy - h * 0.54);
      ctx.lineTo(cx + w * 0.52, cy);
      ctx.closePath();
      ctx.fill();

      // Low tinted convertible windshield (translucent so girl remains clearly visible above & behind!)
      const wg = ctx.createLinearGradient(cx, cy - h * 0.9, cx, cy - h * 0.56);
      wg.addColorStop(0, 'rgba(255, 158, 87, 0.55)');
      wg.addColorStop(1, 'rgba(49, 20, 76, 0.72)');
      ctx.fillStyle = wg;
      ctx.beginPath();
      ctx.moveTo(cx - w * 0.32, cy - h * 0.86);
      ctx.lineTo(cx + w * 0.32, cy - h * 0.86);
      ctx.lineTo(cx + w * 0.4, cy - h * 0.56);
      ctx.lineTo(cx - w * 0.4, cy - h * 0.56);
      ctx.closePath();
      ctx.fill();

      // Sleek chrome windshield frame
      ctx.strokeStyle = '#E2E8F0';
      ctx.lineWidth = Math.max(1.2, w * 0.02);
      ctx.beginPath();
      ctx.moveTo(cx - w * 0.4, cy - h * 0.56);
      ctx.lineTo(cx - w * 0.32, cy - h * 0.86);
      ctx.lineTo(cx + w * 0.32, cy - h * 0.86);
      ctx.lineTo(cx + w * 0.4, cy - h * 0.56);
      ctx.stroke();

      // Front bumper grille
      ctx.fillStyle = '#0F0A1C';
      ctx.fillRect(cx - w * 0.42, cy - h * 0.3, w * 0.84, h * 0.18);

      // Twin blazing oncoming pop-up headlights
      const hlGlow = Math.max(4, w * 0.24);
      for (const sx of [-1, 1]) {
        const hx = cx + sx * w * 0.35;
        const hy = cy - h * 0.42;
        const grd = ctx.createRadialGradient(hx, hy, 1, hx, hy, hlGlow);
        grd.addColorStop(0, '#FFFFFF');
        grd.addColorStop(0.35, car.accent);
        grd.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = grd;
        ctx.beginPath();
        ctx.arc(hx, hy, hlGlow, 0, Math.PI * 2);
        ctx.fill();
      }
    };

    // Detailed Rear View of VADEK's Iconic 80s Touring Van ("ALUPKA 77")
    const drawTouringVanRear = (
      cx: number,
      baseY: number,
      steerLean: number,
      t: number,
      hornGlow: number
    ) => {
      // Beat-synced 108 BPM gentle cruise suspension bounce (subtle & smooth)
      const beatPhase = (t * (108 / 60)) * Math.PI * 2;
      const bounceY = Math.sin(beatPhase) * 1.2 + Math.sin(t * 14) * 0.35;
      const bodyY = baseY + bounceY;

      ctx.save();
      ctx.translate(cx, bodyY);
      ctx.rotate(steerLean * 0.042);

      // 1. Wet asphalt soft shadow & crimson tail-light reflection pool under the van
      ctx.fillStyle = 'rgba(5, 3, 14, 0.72)';
      ctx.beginPath();
      ctx.ellipse(0, 6, 152, 20, 0, 0, Math.PI * 2);
      ctx.fill();

      const tailReflect = ctx.createRadialGradient(0, 18, 12, 0, 24, 155);
      tailReflect.addColorStop(0, hornGlow > 0 ? 'rgba(255, 80, 120, 0.55)' : 'rgba(255, 38, 92, 0.36)');
      tailReflect.addColorStop(1, 'rgba(255, 38, 92, 0)');
      ctx.fillStyle = tailReflect;
      ctx.fillRect(-170, -4, 340, 56);

      // 2. Fat rear rubber tires (left & right)
      ctx.fillStyle = '#0D0B14';
      ctx.fillRect(-124, -44, 36, 48);
      ctx.fillRect(88, -44, 36, 48);
      // Tire treads / subtle highlight
      ctx.fillStyle = '#252136';
      for (let tr = 0; tr < 4; tr++) {
        const ty = -38 + ((tr * 12 + Math.floor(distance * 60)) % 42);
        ctx.fillRect(-121, ty, 30, 3);
        ctx.fillRect(91, ty, 30, 3);
      }

      // Twin chrome exhaust tailpipes
      ctx.fillStyle = '#94A3B8';
      ctx.fillRect(-86, -14, 14, 9);
      ctx.fillRect(72, -14, 14, 9);
      ctx.fillStyle = '#0F172A';
      ctx.fillRect(-83, -12, 8, 5);
      ctx.fillRect(75, -12, 8, 5);

      // 3. Rear chassis under-panel
      ctx.fillStyle = '#111827';
      ctx.fillRect(-118, -36, 236, 18);

      // 4. Main boxy 80s touring van body (tapered slightly toward roof)
      const bodyGrad = ctx.createLinearGradient(0, -210, 0, -24);
      bodyGrad.addColorStop(0, '#36265C');
      bodyGrad.addColorStop(0.26, '#233258');
      bodyGrad.addColorStop(0.62, '#1A2444');
      bodyGrad.addColorStop(1, '#121830');

      ctx.fillStyle = bodyGrad;
      ctx.beginPath();
      ctx.moveTo(-132, -32);
      ctx.lineTo(-134, -122);
      ctx.lineTo(-116, -206);
      ctx.quadraticCurveTo(-112, -218, -96, -218);
      ctx.lineTo(96, -218);
      ctx.quadraticCurveTo(112, -218, 116, -206);
      ctx.lineTo(134, -122);
      ctx.lineTo(132, -32);
      ctx.closePath();
      ctx.fill();

      // Golden-pink sunrise rim light wrapping over roof and side edges!
      ctx.strokeStyle = 'rgba(255, 198, 118, 0.72)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(-116, -206);
      ctx.quadraticCurveTo(-112, -218, -96, -218);
      ctx.lineTo(96, -218);
      ctx.quadraticCurveTo(112, -218, 116, -206);
      ctx.stroke();

      // Side-view mirrors sticking out left & right
      ctx.fillStyle = '#1E1B3A';
      ctx.fillRect(-152, -162, 22, 16);
      ctx.fillRect(130, -162, 22, 16);
      ctx.fillStyle = '#FDA4AF';
      ctx.fillRect(-149, -159, 14, 10);
      ctx.fillRect(135, -159, 14, 10);

      // 5. Roof Rack + Malibu Surfboard + Rock Band Gear Cases + Green Beer Cooler!
      // Chrome roof rails
      ctx.fillStyle = '#CBD5E1';
      ctx.fillRect(-100, -225, 200, 6);
      ctx.fillRect(-92, -225, 6, 10);
      ctx.fillRect(86, -225, 6, 10);

      // Retro California Surfboard strapped on roof right
      ctx.fillStyle = '#FEF08A';
      ctx.beginPath();
      ctx.ellipse(46, -231, 48, 8, -0.04, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#FF40A8';
      ctx.fillRect(16, -233, 60, 4);

      // Drum / Amp road case strapped on roof left
      ctx.fillStyle = '#1E293B';
      ctx.fillRect(-84, -252, 58, 27);
      ctx.strokeStyle = '#94A3B8';
      ctx.lineWidth = 2;
      ctx.strokeRect(-84, -252, 58, 27);
      ctx.fillStyle = '#22D3EE';
      ctx.fillRect(-76, -244, 42, 6);

      // Retro cooler box in middle
      ctx.fillStyle = '#10B981';
      ctx.fillRect(-20, -245, 36, 20);
      ctx.fillStyle = '#F8FAFC';
      ctx.fillRect(-21, -248, 38, 6);

      // 6. Iconic 80s Malibu Sunset Custom Stripe Band across rear doors
      ctx.fillStyle = '#FF40A8';
      ctx.fillRect(-132, -118, 264, 9);
      ctx.fillStyle = '#FB923C';
      ctx.fillRect(-132, -109, 264, 7);
      ctx.fillStyle = '#FDE047';
      ctx.fillRect(-132, -102, 264, 5);

      // 7. Split Rear Barn Doors seam & outline
      ctx.strokeStyle = '#090D1C';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(0, -206);
      ctx.lineTo(0, -40);
      ctx.stroke();
      ctx.strokeStyle = 'rgba(15, 23, 42, 0.75)';
      ctx.lineWidth = 2;
      ctx.strokeRect(-108, -206, 216, 162);

      // 8. Rear Double Windows with Warm Sunset Cabin Glow & Bobbing Crew Silhouettes!
      const drawCabinWindow = (wx: number, wy: number, ww: number, wh: number, side: -1 | 1) => {
        // Rubber window gasket
        ctx.fillStyle = '#0B0F1E';
        ctx.fillRect(wx - 4, wy - 4, ww + 8, wh + 8);

        // Warm sunrise glow visible through front windshield from behind!
        const winGrad = ctx.createLinearGradient(wx, wy, wx, wy + wh);
        winGrad.addColorStop(0, '#4C1D5F');
        winGrad.addColorStop(0.55, '#F472B6');
        winGrad.addColorStop(1, '#FDBA74');
        ctx.fillStyle = winGrad;
        ctx.fillRect(wx, wy, ww, wh);

        // Bobbing crew silhouettes inside the van!
        ctx.fillStyle = '#140B24';
        const bob1 = Math.sin(beatPhase + (side < 0 ? 0 : 1.1)) * 3;
        const bob2 = Math.sin(beatPhase + (side < 0 ? 1.8 : 2.6)) * 3;

        // Back-row buddy silhouette 1
        ctx.beginPath();
        ctx.arc(wx + ww * 0.3, wy + wh * 0.56 + bob1, 13, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillRect(wx + ww * 0.12, wy + wh * 0.68 + bob1, ww * 0.36, wh * 0.32);

        // Back-row buddy silhouette 2
        ctx.beginPath();
        ctx.arc(wx + ww * 0.72, wy + wh * 0.6 + bob2, 12, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillRect(wx + ww * 0.54, wy + wh * 0.7 + bob2, ww * 0.36, wh * 0.3);

        // Raised celebratory beer mug silhouette on right window (pulses on horn or periodically)
        if (side === 1 && (hornGlow > 0 || Math.sin(t * 0.8) > 0.45)) {
          const armLift = hornGlow > 0 ? -8 : Math.sin(t * 4) * 3;
          ctx.fillStyle = '#140B24';
          ctx.fillRect(wx + ww * 0.46, wy + wh * 0.32 + armLift, 11, 16);
          ctx.fillStyle = '#FDE047';
          ctx.fillRect(wx + ww * 0.48, wy + wh * 0.34 + armLift, 7, 6);
        }

        // Subtle diagonal glass reflection streak
        ctx.fillStyle = 'rgba(255, 255, 255, 0.18)';
        ctx.beginPath();
        ctx.moveTo(wx + 8, wy);
        ctx.lineTo(wx + 24, wy);
        ctx.lineTo(wx + 4, wy + wh);
        ctx.lineTo(wx, wy + wh);
        ctx.closePath();
        ctx.fill();
      };

      drawCabinWindow(-98, -196, 88, 64, -1);
      drawCabinWindow(10, -196, 88, 64, 1);

      // 9. Rear-door Mounted Spare Tire (left door, iconic touring van detail!)
      ctx.fillStyle = '#0F172A';
      ctx.beginPath();
      ctx.arc(-64, -84, 34, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#334155';
      ctx.lineWidth = 4;
      ctx.stroke();
      // Spare tire cover graphic (palm / neon sun emblem)
      const coverGrad = ctx.createLinearGradient(-64, -110, -64, -58);
      coverGrad.addColorStop(0, '#FF40A8');
      coverGrad.addColorStop(1, '#FBBF24');
      ctx.fillStyle = coverGrad;
      ctx.beginPath();
      ctx.arc(-64, -84, 23, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#1E1B4B';
      ctx.fillRect(-84, -82, 40, 4);
      ctx.fillRect(-82, -74, 36, 3);
      ctx.fillStyle = '#FFFFFF';
      ctx.font = 'bold 9px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('VICE', -64, -87);

      // 10. License Plate "ALUPKA 77" on right door
      ctx.fillStyle = '#FEF08A';
      ctx.fillRect(20, -90, 68, 28);
      ctx.strokeStyle = '#0EA5E9';
      ctx.lineWidth = 2.5;
      ctx.strokeRect(20, -90, 68, 28);
      ctx.fillStyle = '#0F172A';
      ctx.font = 'bold 11px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('ALUPKA', 54, -77);
      ctx.fillStyle = '#BE185D';
      ctx.font = 'bold 10px monospace';
      ctx.fillText('77 · SUN', 54, -66);

      // Chrome door handle
      ctx.fillStyle = '#E2E8F0';
      ctx.fillRect(6, -116, 12, 5);

      // 11. Glowing Twin Tail Lights + Brake / Horn Flash!
      const brakeBoost = hornGlow > 0 ? 1 : 0.45 + 0.15 * Math.sin(beatPhase);
      for (const sx of [-1, 1]) {
        const tx = sx < 0 ? -126 : 108;
        const ty = -96;
        // Housing
        ctx.fillStyle = '#181026';
        ctx.fillRect(tx - 2, ty - 2, 22, 46);
        // Upper amber blinker
        ctx.fillStyle = hornGlow > 0 ? '#FEF08A' : '#F59E0B';
        ctx.fillRect(tx, ty, 18, 12);
        // Main glowing crimson tail light
        ctx.fillStyle = hornGlow > 0 ? '#FF80A0' : '#FF2255';
        ctx.fillRect(tx, ty + 14, 18, 28);

        // Radiant tail-light bloom
        const bloom = ctx.createRadialGradient(tx + 9, ty + 24, 3, tx + 9, ty + 24, 38 + brakeBoost * 18);
        bloom.addColorStop(0, `rgba(255, 64, 120, ${0.75 * brakeBoost})`);
        bloom.addColorStop(0.5, `rgba(255, 24, 88, ${0.28 * brakeBoost})`);
        bloom.addColorStop(1, 'rgba(255, 24, 88, 0)');
        ctx.fillStyle = bloom;
        ctx.beginPath();
        ctx.arc(tx + 9, ty + 24, 38 + brakeBoost * 18, 0, Math.PI * 2);
        ctx.fill();
      }

      // 12. Heavy Chrome Rear Bumper
      const bumpGrad = ctx.createLinearGradient(0, -44, 0, -24);
      bumpGrad.addColorStop(0, '#F8FAFC');
      bumpGrad.addColorStop(0.45, '#94A3B8');
      bumpGrad.addColorStop(0.55, '#334155');
      bumpGrad.addColorStop(1, '#E2E8F0');
      ctx.fillStyle = bumpGrad;
      ctx.fillRect(-138, -42, 276, 16);
      // Rubber bumperettes
      ctx.fillStyle = '#0F172A';
      ctx.fillRect(-92, -45, 14, 21);
      ctx.fillRect(78, -45, 14, 21);

      ctx.restore();
    };

    const render = (now: number) => {
      const dt =
        lastTime === null ? 0.016 : Math.max(0, Math.min(0.05, (now - lastTime) / 1000));
      lastTime = now;
      elapsed = Math.max(0, elapsed + dt);
      distance = Math.max(0, distance + dt * 9.5);
      if (hornFlashRef.current > 0) {
        hornFlashRef.current = Math.max(0, hornFlashRef.current - dt);
      }

      // Determine current biome & smooth blend factor to next biome
      const cyclePos = elapsed / BIOME_DURATION;
      const biomeIdx = ((Math.floor(cyclePos) % BIOMES.length) + BIOMES.length) % BIOMES.length;
      const nextBiomeIdx = (biomeIdx + 1) % BIOMES.length;
      const timeInBiome = (cyclePos - Math.floor(cyclePos)) * BIOME_DURATION;
      const blend =
        timeInBiome > BIOME_DURATION - TRANSITION_DUR
          ? Math.max(0, Math.min(1, (timeInBiome - (BIOME_DURATION - TRANSITION_DUR)) / TRANSITION_DUR))
          : 0;

      if (biomeIdx !== lastBiomeIdx) {
        lastBiomeIdx = biomeIdx;
        setBiomeLabel({
          title: BIOMES[biomeIdx].title,
          subtitle: BIOMES[biomeIdx].subtitle,
        });
      }

      const bA = BIOMES[biomeIdx];
      const bB = BIOMES[nextBiomeIdx];

      // Gentle OutRun highway curves
      const roadCurve =
        Math.sin(elapsed * 0.24) * 1.15 + Math.sin(elapsed * 0.11 + 1.2) * 0.65;

      // Update interactive van lane offset (or gentle drift back toward right cruise lane)
      if (steerInputRef.current !== 0) {
        vanOffsetRef.current += steerInputRef.current * dt * 1.05;
      } else if (!pointerActiveRef.current) {
        // Gentle cruise drift toward right-center lane
        vanOffsetRef.current += (0.16 - vanOffsetRef.current) * dt * 0.9;
      }
      vanOffsetRef.current = Math.max(-0.56, Math.min(0.58, vanOffsetRef.current));

      ctx.save();
      try {
        ctx.scale(scale, scale);

        const horizonY = 312;

      // =========================================================
      // 1. SYNTHWAVE MALIBU / VICE CITY SUNRISE SKY
      // =========================================================
      const skyGrad = ctx.createLinearGradient(0, 0, 0, horizonY);
      skyGrad.addColorStop(0, lerpRgb(bA.skyTop, bB.skyTop, blend));
      skyGrad.addColorStop(0.38, lerpRgb(bA.skyMid, bB.skyMid, blend));
      skyGrad.addColorStop(0.75, lerpRgb(bA.skyLow, bB.skyLow, blend));
      skyGrad.addColorStop(1, lerpRgb(bA.skyHorizon, bB.skyHorizon, blend));
      ctx.fillStyle = skyGrad;
      ctx.fillRect(0, 0, BASE_W, horizonY + 4);

      // Subtle twinkling high-altitude twilight stars
      for (const st of stars) {
        const tw = 0.25 + 0.55 * Math.abs(Math.sin(elapsed * 1.4 + st.phase));
        ctx.fillStyle = `rgba(255, 240, 255, ${tw * 0.7})`;
        ctx.fillRect(st.x, st.y, st.size, st.size);
      }

      // =========================================================
      // 2. GIANT SEGMENTED RETROWAVE SUNRISE SUN
      // =========================================================
      const sunX = BASE_W * 0.52 - roadCurve * 42;
      const sunY = horizonY - 22;
      const sunR = 138;

      // Outer atmospheric sunrise halo
      const halo = ctx.createRadialGradient(sunX, sunY, sunR * 0.35, sunX, sunY, sunR * 2.45);
      halo.addColorStop(0, 'rgba(255, 210, 110, 0.52)');
      halo.addColorStop(0.45, 'rgba(255, 86, 152, 0.24)');
      halo.addColorStop(1, 'rgba(255, 86, 152, 0)');
      ctx.fillStyle = halo;
      ctx.beginPath();
      ctx.arc(sunX, sunY, sunR * 2.45, 0, Math.PI * 2);
      ctx.fill();

      // Sun disc clipped above horizon with iconic OutRun horizontal scan slices
      ctx.save();
      ctx.beginPath();
      ctx.rect(0, 0, BASE_W, horizonY);
      ctx.clip();

      const sunGrad = ctx.createLinearGradient(sunX, sunY - sunR, sunX, sunY + sunR * 0.5);
      sunGrad.addColorStop(0, '#FFF7AE');
      sunGrad.addColorStop(0.38, '#FDBA34');
      sunGrad.addColorStop(0.72, '#FF5C8D');
      sunGrad.addColorStop(1, '#C026D3');
      ctx.fillStyle = sunGrad;
      ctx.beginPath();
      ctx.arc(sunX, sunY, sunR, 0, Math.PI * 2);
      ctx.fill();

      // Horizontal retrowave cutouts in lower half of the rising sun
      ctx.fillStyle = lerpRgb(bA.skyLow, bB.skyLow, blend);
      const slicePositions = [0.06, 0.22, 0.36, 0.5, 0.62, 0.74, 0.85];
      slicePositions.forEach((sp, idx) => {
        const sy = sunY + sp * (sunR * 0.82) - 42;
        const sh = 2.5 + idx * 1.45;
        ctx.fillRect(sunX - sunR - 4, sy, sunR * 2 + 8, sh);
      });
      ctx.restore();

      // Wispy pink-gold dawn clouds drifting slowly
      ctx.fillStyle = 'rgba(255, 190, 160, 0.22)';
      for (let c = 0; c < 6; c++) {
        const cx = ((c * 290 + elapsed * (8 + c * 2)) % (BASE_W + 320)) - 160;
        const cy = 78 + (c % 3) * 44;
        const cw = 150 + (c % 3) * 65;
        ctx.beginPath();
        ctx.ellipse(cx, cy, cw, 11 + (c % 2) * 5, 0, 0, Math.PI * 2);
        ctx.fill();
      }

      // =========================================================
      // 3. DISTANT HORIZON SILHOUETTES (MIAMI SKYLINE / MALIBU HILLS / BLIMP)
      // =========================================================
      const horizonShift = -roadCurve * 34;

      // Distant Malibu coastal mountains on the left
      ctx.fillStyle = 'rgba(32, 14, 58, 0.82)';
      ctx.beginPath();
      ctx.moveTo(0, horizonY);
      ctx.lineTo(0, horizonY - 46);
      ctx.lineTo(140 + horizonShift * 0.4, horizonY - 76);
      ctx.lineTo(290 + horizonShift * 0.4, horizonY - 42);
      ctx.lineTo(430 + horizonShift * 0.4, horizonY - 60);
      ctx.lineTo(560 + horizonShift * 0.4, horizonY);
      ctx.closePath();
      ctx.fill();

      // Distant Vice City neon skyline silhouette across the bay (strongest in Ocean Drive & Causeway)
      ctx.fillStyle = 'rgba(26, 12, 50, 0.88)';
      const skylineBase = 720 + horizonShift * 0.5;
      const towers = [
        [0, 32, 64],
        [36, 26, 92],
        [68, 40, 74],
        [114, 28, 110],
        [148, 36, 82],
        [190, 30, 62],
        [226, 44, 96],
        [278, 32, 56],
      ];
      for (const [tx, tw, th] of towers) {
        ctx.fillRect(skylineBase + tx, horizonY - th, tw, th);
        // Tiny neon roof trim on Vice City towers
        ctx.fillStyle = tx % 64 === 0 ? bA.neonA : bA.neonB;
        ctx.fillRect(skylineBase + tx + 2, horizonY - th + 3, tw - 4, 2);
        ctx.fillStyle = 'rgba(26, 12, 50, 0.88)';
      }

      // Floating Retro Blimp on the horizon!
      const blimpX = ((elapsed * 14 + 260) % (BASE_W + 240)) - 120;
      const blimpY = 122 + Math.sin(elapsed * 0.9) * 5;
      ctx.fillStyle = '#241442';
      ctx.beginPath();
      ctx.ellipse(blimpX, blimpY, 44, 13, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = bA.neonB;
      ctx.fillRect(blimpX - 24, blimpY - 3, 48, 5);
      ctx.fillStyle = '#0F172A';
      ctx.fillRect(blimpX - 8, blimpY + 12, 16, 5);

      // Gliding coastal seagulls in the sunrise sky
      ctx.strokeStyle = 'rgba(42, 16, 56, 0.72)';
      ctx.lineWidth = 2;
      for (const g of seagulls) {
        const gx = ((g.x - elapsed * g.speed) % (BASE_W + 200) + BASE_W + 200) % (BASE_W + 200) - 100;
        const gy = g.y + Math.sin(elapsed * 2 + g.phase) * 8;
        const flap = Math.sin(elapsed * 6.5 + g.phase) * 5;
        ctx.beginPath();
        ctx.moveTo(gx - 9, gy + flap);
        ctx.quadraticCurveTo(gx - 4, gy - 4, gx, gy);
        ctx.quadraticCurveTo(gx + 4, gy - 4, gx + 9, gy + flap);
        ctx.stroke();
      }

      // =========================================================
      // 4. GROUND, PACIFIC OCEAN / VICE BAY & SHIMMERING SUN PATH
      // =========================================================
      const groundH = BASE_H - horizonY;

      // Base coastal terrain / sand fill
      const leftColor = lerpRgb(bA.sandLeft, bB.sandLeft, blend);
      const rightColor = lerpRgb(bA.sandRight, bB.sandRight, blend);
      ctx.fillStyle = leftColor;
      ctx.fillRect(0, horizonY, BASE_W * 0.5, groundH);
      ctx.fillStyle = rightColor;
      ctx.fillRect(BASE_W * 0.5, horizonY, BASE_W * 0.5, groundH);

      // Ocean / Bay water zones (right side on Ocean Drive & Malibu, both sides on Causeway!)
      const waterGrad = ctx.createLinearGradient(0, horizonY, 0, BASE_H);
      waterGrad.addColorStop(0, lerpRgb(bA.waterTop, bB.waterTop, blend));
      waterGrad.addColorStop(1, lerpRgb(bA.waterBot, bB.waterBot, blend));

      const showWaterRight = bA.hasWaterRight || (blend > 0.25 && bB.hasWaterRight);
      const showWaterLeft = bA.hasWaterLeft || (blend > 0.25 && bB.hasWaterLeft);

      if (showWaterRight) {
        const waterAlpha = bA.hasWaterRight && bB.hasWaterRight ? 1 : bA.hasWaterRight ? 1 - blend : blend;
        ctx.save();
        ctx.globalAlpha = waterAlpha;
        ctx.fillStyle = waterGrad;
        ctx.fillRect(BASE_W * 0.5, horizonY, BASE_W * 0.5, groundH);

        // Shimmering sunrise reflection ribbons across the ocean!
        for (let r = 0; r < 24; r++) {
          const p = (r + ((elapsed * 1.4) % 1)) / 24;
          const ry = horizonY + Math.pow(p, 1.55) * groundH;
          const rw = 26 + p * 190 + Math.sin(elapsed * 3 + r) * 16;
          const rx = Math.max(BASE_W * 0.58, sunX + 120 * p);
          ctx.fillStyle =
            r % 2 === 0 ? 'rgba(255, 206, 118, 0.42)' : 'rgba(255, 92, 168, 0.32)';
          ctx.fillRect(rx - rw * 0.5, ry, rw, 2 + p * 3.5);
        }

        // Rolling white Malibu surf foam line along the beach edge
        if (bA.rightTheme === 'malibu_surf' || bA.rightTheme === 'ocean') {
          ctx.strokeStyle = 'rgba(255, 245, 235, 0.45)';
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.moveTo(BASE_W * 0.54, horizonY + 8);
          ctx.quadraticCurveTo(
            BASE_W * 0.72 + Math.sin(elapsed * 2.1) * 18,
            horizonY + groundH * 0.48,
            BASE_W * 0.96,
            BASE_H
          );
          ctx.stroke();
        }
        ctx.restore();
      }

      if (showWaterLeft) {
        const waterAlpha = bA.hasWaterLeft && bB.hasWaterLeft ? 1 : bA.hasWaterLeft ? 1 - blend : blend;
        ctx.save();
        ctx.globalAlpha = waterAlpha;
        ctx.fillStyle = waterGrad;
        ctx.fillRect(0, horizonY, BASE_W * 0.5, groundH);
        for (let r = 0; r < 18; r++) {
          const p = (r + ((elapsed * 1.3) % 1)) / 18;
          const ry = horizonY + Math.pow(p, 1.55) * groundH;
          const rw = 30 + p * 130;
          ctx.fillStyle = 'rgba(34, 211, 238, 0.22)';
          ctx.fillRect(140 - rw * 0.3, ry, rw, 2 + p * 2.5);
        }
        ctx.restore();
      }

      // =========================================================
      // 5. PSEUDO-3D OUTRUN CURVING HIGHWAY (BACK-TO-FRONT SLICES)
      // =========================================================
      const SLICES = 68;
      const roadHalfBottom = 460;
      const roadHalfTop = 24;

      const projectSlice = (depthNorm: number) => {
        // depthNorm: 0 at horizon, 1 at bottom of screen
        const persp = Math.pow(depthNorm, 1.65);
        const y = horizonY + persp * groundH;
        const halfW = lerp(roadHalfTop, roadHalfBottom, persp);
        const curveOffset = Math.pow(1 - persp, 2.1) * roadCurve * 155;
        const playerShift = -vanOffsetRef.current * halfW * 0.65;
        const centerX = BASE_W * 0.5 + curveOffset + playerShift;
        const worldZ = distance + (1 / Math.max(0.055, persp + 0.045)) * 1.15;
        return { y, halfW, centerX, persp, worldZ };
      };

      const roadDarkCol = lerpRgb(bA.roadDark, bB.roadDark, blend);
      const roadLightCol = lerpRgb(bA.roadLight, bB.roadLight, blend);
      const curbACol = lerpRgb(bA.curbA, bB.curbA, blend);
      const curbBCol = lerpRgb(bA.curbB, bB.curbB, blend);

      for (let i = 0; i < SLICES; i++) {
        const d0 = i / SLICES;
        const d1 = (i + 1) / SLICES;
        const s0 = projectSlice(d0);
        const s1 = projectSlice(d1);

        const stripeParity = Math.floor(s0.worldZ * 1.35) % 2 === 0;

        // Subtle shoulder strip outside road
        const sh0 = s0.halfW * 1.14;
        const sh1 = s1.halfW * 1.14;
        ctx.fillStyle = stripeParity ? 'rgba(20, 12, 38, 0.5)' : 'rgba(34, 18, 56, 0.45)';
        ctx.beginPath();
        ctx.moveTo(s0.centerX - sh0, s0.y);
        ctx.lineTo(s0.centerX + sh0, s0.y);
        ctx.lineTo(s1.centerX + sh1, s1.y + 1);
        ctx.lineTo(s1.centerX - sh1, s1.y + 1);
        ctx.closePath();
        ctx.fill();

        // Neon rumble curbs (left & right)
        const curb0 = s0.halfW * 1.055;
        const curb1 = s1.halfW * 1.055;
        ctx.fillStyle = stripeParity ? curbACol : curbBCol;
        ctx.beginPath();
        ctx.moveTo(s0.centerX - curb0, s0.y);
        ctx.lineTo(s0.centerX + curb0, s0.y);
        ctx.lineTo(s1.centerX + curb1, s1.y + 1);
        ctx.lineTo(s1.centerX - curb1, s1.y + 1);
        ctx.closePath();
        ctx.fill();

        // Main asphalt road surface
        ctx.fillStyle = stripeParity ? roadDarkCol : roadLightCol;
        ctx.beginPath();
        ctx.moveTo(s0.centerX - s0.halfW, s0.y);
        ctx.lineTo(s0.centerX + s0.halfW, s0.y);
        ctx.lineTo(s1.centerX + s1.halfW, s1.y + 1);
        ctx.lineTo(s1.centerX - s1.halfW, s1.y + 1);
        ctx.closePath();
        ctx.fill();

        // Warm sunrise specular sheen down center of wet asphalt
        ctx.fillStyle = 'rgba(255, 168, 120, 0.065)';
        ctx.beginPath();
        ctx.moveTo(s0.centerX - s0.halfW * 0.28, s0.y);
        ctx.lineTo(s0.centerX + s0.halfW * 0.28, s0.y);
        ctx.lineTo(s1.centerX + s1.halfW * 0.28, s1.y + 1);
        ctx.lineTo(s1.centerX - s1.halfW * 0.28, s1.y + 1);
        ctx.closePath();
        ctx.fill();

        // Dashed glowing highway center & lane dividers
        if (stripeParity) {
          const lineW0 = Math.max(1, s0.halfW * 0.028);
          const lineW1 = Math.max(1.5, s1.halfW * 0.028);
          ctx.fillStyle = '#FDE047';
          ctx.beginPath();
          ctx.moveTo(s0.centerX - lineW0, s0.y);
          ctx.lineTo(s0.centerX + lineW0, s0.y);
          ctx.lineTo(s1.centerX + lineW1, s1.y + 1);
          ctx.lineTo(s1.centerX - lineW1, s1.y + 1);
          ctx.closePath();
          ctx.fill();

          // Subtle outer lane dashes
          ctx.fillStyle = 'rgba(255, 255, 255, 0.32)';
          for (const laneSign of [-0.52, 0.52]) {
            const lx0 = s0.centerX + s0.halfW * laneSign;
            const lx1 = s1.centerX + s1.halfW * laneSign;
            ctx.beginPath();
            ctx.moveTo(lx0 - lineW0 * 0.55, s0.y);
            ctx.lineTo(lx0 + lineW0 * 0.55, s0.y);
            ctx.lineTo(lx1 + lineW1 * 0.55, s1.y + 1);
            ctx.lineTo(lx1 - lineW1 * 0.55, s1.y + 1);
            ctx.closePath();
            ctx.fill();
          }
        }
      }

      // =========================================================
      // 6. ROADSIDE SCENERY (PALMS, VICE HOTELS, MALIBU CLIFFS, CAUSEWAY PYLONS)
      // =========================================================
      const PROP_SLOTS = 24;
      const sway = Math.sin(elapsed * 1.7);
      const propScroll = distance * 0.42;
      const propPhase = propScroll % 1;
      const propBaseIdx = Math.floor(propScroll);

      // Iterate back-to-front (horizon slot 0 -> foreground slot N-1) so props rush backward past the van
      for (let slot = 0; slot < PROP_SLOTS; slot++) {
        const frac = (slot + propPhase) / PROP_SLOTS;
        if (frac <= 0.03 || frac >= 1.02) continue;

        // Exponential depth mapping: dense near horizon, accelerating smoothly backward past camera
        const depthNorm = Math.pow(frac, 1.35);
        const s = projectSlice(depthNorm);
        const pScale = s.persp;
        // Stable prop identity across wrap: (N - slot) + baseIdx stays identical when slot & baseIdx both +1
        const propIdx = (PROP_SLOTS - slot) + propBaseIdx;

        const leftEdge = s.centerX - s.halfW * 1.15;
        const rightEdge = s.centerX + s.halfW * 1.15;

        // --- LEFT SIDE SCENERY ---
        if (bA.leftTheme === 'hotels') {
          if (propIdx % 2 === 0) {
            drawArtDecoHotel(
              leftEdge - 26 * pScale,
              s.y + 4 * pScale,
              155 * pScale,
              210 * pScale,
              propIdx,
              bA.neonA,
              bA.neonB
            );
          }
          drawPalmTree(
            leftEdge - 10 * pScale,
            s.y + 2 * pScale,
            195 * pScale,
            -0.35,
            sway,
            '#180B2E',
            'rgba(255, 160, 110, 0.55)'
          );
          if (propIdx % 2 === 1) {
            drawNeonStreetLamp(leftEdge + 4 * pScale, s.y, 130 * pScale, -1, bA.neonA);
          }
        } else if (bA.leftTheme === 'cliffs') {
          drawMalibuCliffVilla(
            leftEdge - 18 * pScale,
            s.y + 4 * pScale,
            210 * pScale,
            185 * pScale,
            propIdx
          );
          if (propIdx % 2 === 0) {
            drawPalmTree(
              leftEdge - 6 * pScale,
              s.y + 2 * pScale,
              170 * pScale,
              -0.5,
              sway,
              '#201034',
              'rgba(255, 206, 120, 0.6)'
            );
          }
        } else if (bA.leftTheme === 'causeway') {
          // Glowing bridge pylon + neon streetlamp over bay water
          drawNeonStreetLamp(leftEdge + 2 * pScale, s.y, 145 * pScale, -1, bA.neonA);
          ctx.fillStyle = '#1E293B';
          ctx.fillRect(leftEdge - 8 * pScale, s.y - 26 * pScale, 12 * pScale, 30 * pScale);
          ctx.fillStyle = bA.neonA;
          ctx.fillRect(leftEdge - 8 * pScale, s.y - 24 * pScale, 12 * pScale, 4 * pScale);
        } else {
          // Sunset Strip: double palms + glowing retro motels
          if (propIdx % 2 === 0) {
            drawArtDecoHotel(
              leftEdge - 32 * pScale,
              s.y + 4 * pScale,
              145 * pScale,
              165 * pScale,
              propIdx + 1,
              bA.neonA,
              bA.neonB
            );
          }
          drawPalmTree(
            leftEdge - 10 * pScale,
            s.y + 2 * pScale,
            220 * pScale,
            -0.38,
            sway,
            '#1A0A2E',
            'rgba(255, 196, 110, 0.58)'
          );
          drawNeonStreetLamp(leftEdge + 6 * pScale, s.y, 135 * pScale, -1, bA.neonB);
        }

        // --- RIGHT SIDE SCENERY ---
        if (bA.rightTheme === 'ocean') {
          drawPalmTree(
            rightEdge + 12 * pScale,
            s.y + 2 * pScale,
            185 * pScale,
            0.55,
            sway,
            '#180B2E',
            'rgba(255, 178, 120, 0.6)'
          );
          if (propIdx % 3 === 0) {
            drawNeonStreetLamp(rightEdge - 2 * pScale, s.y, 125 * pScale, 1, bA.neonB);
          }
        } else if (bA.rightTheme === 'malibu_surf') {
          if (propIdx % 3 === 0) {
            drawLifeguardTower(rightEdge + 62 * pScale, s.y + 4 * pScale, 88 * pScale);
          }
          if (propIdx % 2 === 0) {
            drawPalmTree(
              rightEdge + 14 * pScale,
              s.y + 2 * pScale,
              180 * pScale,
              0.62,
              sway,
              '#1D0F32',
              'rgba(255, 212, 128, 0.65)'
            );
          }
        } else if (bA.rightTheme === 'causeway') {
          drawNeonStreetLamp(rightEdge - 2 * pScale, s.y, 145 * pScale, 1, bA.neonB);
          ctx.fillStyle = '#1E293B';
          ctx.fillRect(rightEdge - 4 * pScale, s.y - 26 * pScale, 12 * pScale, 30 * pScale);
          ctx.fillStyle = bA.neonB;
          ctx.fillRect(rightEdge - 4 * pScale, s.y - 24 * pScale, 12 * pScale, 4 * pScale);
        } else {
          // Sunset Strip right side: palms + motels + neon arches
          if (propIdx % 2 === 1) {
            drawArtDecoHotel(
              rightEdge + 175 * pScale,
              s.y + 4 * pScale,
              145 * pScale,
              160 * pScale,
              propIdx + 2,
              bA.neonB,
              bA.neonA
            );
          }
          drawPalmTree(
            rightEdge + 12 * pScale,
            s.y + 2 * pScale,
            225 * pScale,
            0.42,
            sway,
            '#1A0A2E',
            'rgba(255, 196, 110, 0.58)'
          );
          drawNeonStreetLamp(rightEdge - 6 * pScale, s.y, 135 * pScale, 1, bA.neonA);
        }
      }

      // =========================================================
      // 7. ONCOMING 80s RETRO CONVERTIBLES WITH WAVING FANS!
      // =========================================================
      for (const car of oncomingCars) {
        car.z -= dt * 0.24;
        if (car.z <= 0.02) {
          car.z = 1.0;
          const nextPaint = carColors[spawnCounter % carColors.length];
          car.color = nextPaint.color;
          car.accent = nextPaint.accent;
          car.hairStyle = hairCycle[spawnCounter % hairCycle.length];
          car.braColor = spawnCounter % 2 === 0 ? 'red' : 'green';
          car.wavePhase = spawnCounter * 1.7;
          spawnCounter += 1;
        }
      }
      // Draw farthest oncoming car first, closest last
      const sortedCars = [...oncomingCars].sort((a, b) => b.z - a.z);
      for (const car of sortedCars) {
        const depthNorm = 1 - car.z;
        const s = projectSlice(depthNorm);
        const carX = s.centerX + s.halfW * car.laneOffset;
        drawRetroSportsCar(carX, s.y, s.persp * 1.18, car, elapsed);
      }

      // =========================================================
      // 8. EXHAUST PUFFS & DED's GREEN WINDOW SMOKE
      // =========================================================
      const vanX = BASE_W * 0.5 + vanOffsetRef.current * 240;
      const vanBaseY = BASE_H - 54;

      puffTimer += dt;
      if (puffTimer > 0.14) {
        puffTimer = 0;
        for (const sx of [-78, 78]) {
          puffs.push({
            x: vanX + sx,
            y: vanBaseY - 8,
            vx: (Math.random() - 0.5) * 18 - roadCurve * 16,
            vy: 14 + Math.random() * 14,
            r: 5 + Math.random() * 4,
            alpha: 0.34,
            isGreen: false,
          });
        }
      }

      smokeTimer += dt;
      if (smokeTimer > 0.65) {
        smokeTimer = 0;
        puffs.push({
          x: vanX + 126,
          y: vanBaseY - 164,
          vx: 36 + Math.random() * 20,
          vy: -28 - Math.random() * 16,
          r: 7 + Math.random() * 4,
          alpha: 0.38,
          isGreen: true,
        });
      }

      for (let i = puffs.length - 1; i >= 0; i--) {
        const p = puffs[i];
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.r += dt * (p.isGreen ? 14 : 18);
        p.alpha -= dt * (p.isGreen ? 0.22 : 0.45);
        if (p.alpha <= 0.01) {
          puffs.splice(i, 1);
          continue;
        }
        ctx.fillStyle = p.isGreen
          ? `rgba(110, 231, 183, ${p.alpha})`
          : `rgba(255, 210, 230, ${p.alpha})`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fill();
      }

      // =========================================================
      // 9. VADEK'S TOURING VAN (REAR VIEW HERO PIECE!)
      // =========================================================
      const visualLean = steerInputRef.current * 0.85 - roadCurve * 0.25;
      drawTouringVanRear(vanX, vanBaseY, visualLean, elapsed, hornFlashRef.current);

      // Subtle warm golden sunrise vignette at top/bottom edges
      const vig = ctx.createRadialGradient(
        BASE_W * 0.5,
        BASE_H * 0.46,
        BASE_W * 0.28,
        BASE_W * 0.5,
        BASE_H * 0.5,
        BASE_W * 0.72
      );
      vig.addColorStop(0, 'rgba(0,0,0,0)');
      vig.addColorStop(1, 'rgba(12, 4, 24, 0.34)');
      ctx.fillStyle = vig;
      ctx.fillRect(0, 0, BASE_W, BASE_H);
      } catch (err) {
        console.error('EndlessFinaleView render error:', err);
      } finally {
        ctx.restore();
      }
      rafId = requestAnimationFrame(render);
    };

    rafId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(rafId);
  }, [renderScale]);

  // Pointer/touch steering directly on canvas
  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    soundEngine.unlock();
    pointerActiveRef.current = true;
    pointerLastXRef.current = e.clientX;
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!pointerActiveRef.current) return;
    const dx = e.clientX - pointerLastXRef.current;
    pointerLastXRef.current = e.clientX;
    vanOffsetRef.current = Math.max(-0.56, Math.min(0.58, vanOffsetRef.current + dx * 0.0032));
  };

  const handlePointerUp = () => {
    pointerActiveRef.current = false;
  };

  return (
    <div className="relative w-screen h-[100dvh] bg-[#0B0618] overflow-hidden flex items-center justify-center select-none">
      {/* Full-Bleed Endless Synthwave Malibu / Vice City Canvas */}
      <canvas
        ref={canvasRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onPointerLeave={handlePointerUp}
        className="w-full h-full object-cover block cursor-grab active:cursor-grabbing"
      />

      {/* Optional CRT Scanlines */}
      {crtScanlines && (
        <div className="pointer-events-none fixed inset-0 z-10 crt-scanlines opacity-40" />
      )}

      {/* Clean Minimal Top Bar (Hidden cleanly when "ЧИСТЫЙ ЭКРАН" is active) */}
      {hudVisible ? (
        <>
          <header className="fixed top-0 inset-x-0 z-20 px-4 sm:px-6 py-3 bg-gradient-to-b from-[#0C051C]/85 via-[#0C051C]/45 to-transparent flex flex-wrap items-center justify-between gap-3">
            {/* Biome & Victory Badge */}
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-1.5 h-8 bg-gradient-to-b from-[#FDE047] via-[#FF40A8] to-[#22D3EE] shrink-0" />
              <div className="min-w-0">
                <div className="font-display text-xs sm:text-sm tracking-[0.18em] text-[#FEF08A] uppercase truncate">
                  {biomeLabel.title}
                </div>
                <div className="text-[11px] font-mono-num tracking-wider text-[#F9A8D4]/90 truncate">
                  {biomeLabel.subtitle}
                </div>
              </div>
            </div>

            {/* Score Readout (Unboxed, tabular-nums) */}
            <div className="hidden md:flex items-center gap-6 font-mono-num">
              <div className="text-right">
                <div className="text-[10px] uppercase tracking-[0.16em] text-[#F9A8D4]/75">
                  ПОБЕДНЫЙ СЧЁТ
                </div>
                <div className="text-lg font-bold text-[#FEF08A] tabular-nums">
                  {score.toLocaleString('ru-RU')}
                </div>
              </div>
              <div className="h-6 w-px bg-white/15" />
              <div className="text-right">
                <div className="text-[10px] uppercase tracking-[0.16em] text-[#67E8F9]/75">
                  РЕКОРД
                </div>
                <div className="text-lg font-bold text-[#67E8F9] tabular-nums">
                  {Math.max(score, highScore).toLocaleString('ru-RU')}
                </div>
              </div>
            </div>

            {/* Single-Line Action Controls */}
            <div className="flex items-center gap-2">
              {savedNotice && (
                <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 bg-[#14301D]/90 border border-[#39FF14] text-[#39FF14] text-xs font-mono-num font-bold">
                  <Check className="w-3.5 h-3.5" />
                  <span>{savedNotice}</span>
                </div>
              )}

              {onOpenLeaderboard && (
                <button
                  type="button"
                  onClick={() => {
                    soundEngine.unlock();
                    soundEngine.playMenuMove();
                    onOpenLeaderboard();
                  }}
                  className="px-2.5 py-1.5 bg-[#0F0822]/75 hover:bg-[#1E1042] border border-[#FDE047]/65 text-[#FEF08A] text-xs font-display tracking-wider flex items-center gap-1.5 transition cursor-pointer whitespace-nowrap"
                >
                  <Trophy className="w-3.5 h-3.5 text-[#FDE047]" />
                  <span className="hidden sm:inline">ТОП</span>
                </button>
              )}

              <button
                type="button"
                onClick={triggerHorn}
                className="px-3 py-1.5 bg-[#FF40A8]/20 hover:bg-[#FF40A8]/35 border border-[#FF40A8]/65 text-[#FCE7F3] text-xs font-display tracking-wider flex items-center gap-1.5 transition cursor-pointer whitespace-nowrap"
              >
                <Music className="w-3.5 h-3.5 text-[#FEF08A]" />
                <span>ГУДОК</span>
              </button>

              {canShowFullscreen && onToggleFullscreen && (
                <button
                  type="button"
                  onClick={onToggleFullscreen}
                  aria-label={isFullscreen ? 'Выйти из полного экрана' : 'На полный экран'}
                  title={isFullscreen ? 'Выйти из полного экрана' : 'На полный экран'}
                  className="p-2 bg-[#0F0822]/75 hover:bg-[#1E1042] border border-[#22D3EE]/50 text-[#67E8F9] transition cursor-pointer"
                >
                  {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
                </button>
              )}

              <button
                type="button"
                onClick={onToggleMute}
                aria-label={muted ? 'Включить звук' : 'Выключить звук'}
                className="p-2 bg-[#0F0822]/75 hover:bg-[#1E1042] border border-white/20 text-[#F8FAFC] transition cursor-pointer"
              >
                {muted ? <VolumeX className="w-4 h-4 text-[#FB7185]" /> : <Volume2 className="w-4 h-4 text-[#67E8F9]" />}
              </button>

              <button
                type="button"
                onClick={() => setHudVisible(false)}
                title="Скрыть интерфейс (H)"
                className="px-2.5 py-1.5 bg-[#0F0822]/75 hover:bg-[#1E1042] border border-white/20 text-[#E2E8F0] text-xs font-mono-num flex items-center gap-1.5 transition cursor-pointer whitespace-nowrap"
              >
                <EyeOff className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">ЧИСТЫЙ ЭКРАН</span>
              </button>

              <button
                type="button"
                onClick={onReturnTitle}
                className="px-3 py-1.5 bg-[#FDE047] hover:bg-[#FEF08A] text-[#140826] text-xs font-display font-bold tracking-wider flex items-center gap-1.5 transition cursor-pointer whitespace-nowrap"
              >
                <Home className="w-3.5 h-3.5" />
                <span>В МЕНЮ</span>
              </button>
            </div>
          </header>

          {/* Non-Interrupting Floating Hall of Fame Name Input — disappears completely after submit/close */}
          {showScoreEntry && (
            <div className="pointer-events-none fixed top-[64px] sm:top-[74px] inset-x-3 z-25 flex justify-center">
              <form
                onSubmit={handleSubmitScore}
                onPointerDown={(e) => e.stopPropagation()}
                className="pointer-events-auto w-full max-w-lg bg-[#0D071F]/82 backdrop-blur-xs border border-[#FF40A8]/80 shadow-[0_0_24px_rgba(255,64,168,0.28)] px-3.5 py-2.5 flex flex-col gap-2"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <Trophy className="w-4 h-4 text-[#FDE047] shrink-0" />
                    <span className="font-display text-xs sm:text-sm tracking-[0.14em] text-[#FEF08A] uppercase truncate">
                      ВПИШИ ИМЯ В ТОП ИГРОКОВ
                    </span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="font-mono-num text-xs sm:text-sm font-bold text-[#39FF14] tabular-nums">
                      {effectiveScore.toLocaleString('ru-RU')} PTS
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        soundEngine.playMenuMove();
                        setShowScoreEntry(false);
                        setInputFocused(false);
                      }}
                      aria-label="Скрыть ввод имени"
                      title="Пропустить"
                      className="p-1 text-[#CBD5E1]/70 hover:text-white cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={playerName}
                    onChange={(e) => {
                      setPlayerName(e.target.value.slice(0, 18));
                      if (submitError) setSubmitError(null);
                    }}
                    onFocus={() => setInputFocused(true)}
                    onBlur={() => setInputFocused(false)}
                    placeholder="ТВОЙ НИК (ДО 18 СИМВ.)"
                    maxLength={18}
                    autoComplete="nickname"
                    className="flex-1 min-w-0 px-3 py-1.5 bg-[#080414]/90 border border-[#22D3EE]/70 focus:border-[#39FF14] focus:outline-none text-[#F8FAFC] placeholder:text-[#64748B] font-mono-num text-xs sm:text-sm tracking-wider select-text"
                  />
                  <button
                    type="submit"
                    disabled={submittingScore}
                    className="px-4 py-1.5 bg-[#39FF14] hover:bg-[#6DFF52] disabled:opacity-60 text-[#090C11] font-display font-bold text-xs sm:text-sm tracking-widest transition-colors cursor-pointer whitespace-nowrap shrink-0"
                  >
                    {submittingScore ? '...' : 'ЗАПИСАТЬ'}
                  </button>
                </div>

                {submitError && (
                  <div className="text-[11px] font-mono-num text-[#FDA4AF]">{submitError}</div>
                )}
              </form>
            </div>
          )}

          {/* Bottom Epilogue Ticker & Controls Hint */}
          <footer className="pointer-events-none fixed bottom-0 inset-x-0 z-20 px-4 sm:px-6 pb-3 pt-8 bg-gradient-to-t from-[#0B041A]/85 via-[#0B041A]/35 to-transparent flex flex-col items-center gap-1.5 text-center">
            <p className="font-display text-xs sm:text-sm tracking-[0.14em] text-[#FEF9C3] drop-shadow-[0_2px_8px_rgba(255,64,168,0.65)] max-w-3xl">
              {EPILOGUE_LINES[epilogueIdx]}
            </p>
            <div className="flex items-center gap-4 text-[10px] sm:text-[11px] font-mono-num tracking-widest text-[#E9D5FF]/70 uppercase">
              <span>{isTouchDevice ? 'СВАЙП — РУЛЬ' : '← / → РУЛЬ · SPACE ГУДОК · H СКРЫТЬ HUD'}</span>
              <span className="hidden sm:inline">·</span>
              <span className="hidden sm:inline text-[#67E8F9]/85">SYNTHWAVE ENDLESS DRIVE</span>
            </div>
          </footer>
        </>
      ) : (
        /* Unobtrusive Restore Button in Pure Screen Mode */
        <button
          type="button"
          onClick={() => setHudVisible(true)}
          aria-label="Показать интерфейс"
          className="fixed top-3 right-3 z-20 p-2 bg-[#0B041A]/55 hover:bg-[#0B041A]/85 border border-white/20 text-white/80 hover:text-white transition cursor-pointer"
        >
          <Eye className="w-4 h-4" />
        </button>
      )}
    </div>
  );
};
