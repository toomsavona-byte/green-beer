import { useEffect, useMemo, useState } from 'react';
import { Gamepad2, Maximize2, Minimize2, Trophy, Volume2, VolumeX } from 'lucide-react';
import { formatGamepadBinding, formatKeyCode } from '../game/controls';
import { DIFFICULTIES, LEVELS, TITLE_ART_URL } from '../game/data';
import { soundEngine } from '../game/audio';
import { DifficultyId, GameSettings, LevelId, TouchControlsMode } from '../game/types';
import { useGamepadMenuNav } from '../hooks/useGamepadMenuNav';
import { PWAInstallButton } from './PWAInstallButton';

interface TitleScreenProps {
  settings: GameSettings;
  highScore: number;
  showTouchControls: boolean;
  isTouchDevice: boolean;
  gamepadCount: number;
  controlsModalOpen?: boolean;
  iosGuideOpen?: boolean;
  leaderboardOpen?: boolean;
  canShowFullscreen?: boolean;
  isFullscreen?: boolean;
  onToggleFullscreen?: () => void;
  onUpdateSettings: (partial: Partial<GameSettings>) => void;
  onOpenControls: () => void;
  onOpenLeaderboard: () => void;
  onStart: () => void;
  onOpenOnlineLobby: () => void;
  onPreviewFinale: () => void;
}

type FocusItemId =
  | '1p'
  | '2p'
  | 'online'
  | 'start'
  | 'diff_easy'
  | 'diff_normal'
  | 'diff_hard'
  | 'controls'
  | 'touch'
  | 'ff'
  | 'lvl_1'
  | 'lvl_2'
  | 'lvl_3'
  | 'lvl_4'
  | 'lvl_5'
  | 'lvl_6'
  | 'finale'
  | 'leaderboard'
  | 'fullscreen'
  | 'mute';

const TOUCH_MODE_LABELS: Record<TouchControlsMode, string> = {
  auto: 'АВТО',
  on: 'СЕНСОР ВКЛ',
  off: 'КЛАВИАТУРА',
};

export function TitleScreen({
  settings,
  highScore,
  showTouchControls,
  isTouchDevice,
  gamepadCount,
  controlsModalOpen = false,
  iosGuideOpen = false,
  leaderboardOpen = false,
  canShowFullscreen = false,
  isFullscreen = false,
  onToggleFullscreen,
  onUpdateSettings,
  onOpenControls,
  onOpenLeaderboard,
  onStart,
  onOpenOnlineLobby,
  onPreviewFinale,
}: TitleScreenProps) {
  const [imgFailed, setImgFailed] = useState(false);
  const [focusRow, setFocusRow] = useState(0);
  const [focusCol, setFocusCol] = useState(3); // Defaults to PRESS START
  const [gpNavActive, setGpNavActive] = useState(gamepadCount > 0);

  const navRows = useMemo<FocusItemId[][]>(
    () => [
      ['1p', '2p', 'online', 'start'],
      ['diff_easy', 'diff_normal', 'diff_hard', 'controls', 'touch', 'ff'],
      ['lvl_1', 'lvl_2', 'lvl_3', 'lvl_4', 'lvl_5', 'lvl_6', 'finale'],
      canShowFullscreen && onToggleFullscreen
        ? ['leaderboard', 'fullscreen', 'mute']
        : ['leaderboard', 'mute'],
    ],
    [canShowFullscreen, onToggleFullscreen]
  );

  const safeRow = Math.min(focusRow, navRows.length - 1);
  const safeCol = Math.min(focusCol, navRows[safeRow].length - 1);
  const focusedId: FocusItemId | null = gpNavActive ? navRows[safeRow][safeCol] : null;
  const focusRing = (id: FocusItemId) => (focusedId === id ? 'gp-focus-ring' : '');

  useEffect(() => {
    const clearGpHighlight = () => setGpNavActive(false);
    window.addEventListener('pointerdown', clearGpHighlight, { passive: true });
    return () => window.removeEventListener('pointerdown', clearGpHighlight);
  }, []);

  useEffect(() => {
    if (controlsModalOpen || iosGuideOpen || leaderboardOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Enter' || e.code === 'Space') {
        e.preventDefault();
        soundEngine.unlock();
        soundEngine.playMenuConfirm();
        onStart();
      } else if (e.code === 'ArrowLeft' || e.code === 'KeyA') {
        soundEngine.unlock();
        soundEngine.playMenuMove();
        onUpdateSettings({ players: 1 });
      } else if (e.code === 'ArrowRight' || e.code === 'KeyD') {
        soundEngine.unlock();
        soundEngine.playMenuMove();
        onUpdateSettings({ players: 2 });
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [controlsModalOpen, iosGuideOpen, leaderboardOpen, onStart, onUpdateSettings]);

  const toggleMute = () => {
    const next = !settings.muted;
    soundEngine.unlock();
    soundEngine.setMuted(next);
    onUpdateSettings({ muted: next });
  };

  const cycleTouchMode = () => {
    soundEngine.unlock();
    soundEngine.playMenuMove();
    const order: TouchControlsMode[] = ['auto', 'on', 'off'];
    const next = order[(order.indexOf(settings.touchControlsMode) + 1) % order.length];
    onUpdateSettings({ touchControlsMode: next });
  };

  const activateFocusedItem = (id: FocusItemId) => {
    soundEngine.unlock();
    switch (id) {
      case '1p':
        soundEngine.playMenuMove();
        onUpdateSettings({ players: 1 });
        break;
      case '2p':
        soundEngine.playMenuMove();
        onUpdateSettings({ players: 2 });
        break;
      case 'online':
        soundEngine.playMenuConfirm();
        onOpenOnlineLobby();
        break;
      case 'start':
        soundEngine.playMenuConfirm();
        onStart();
        break;
      case 'diff_easy':
        soundEngine.playMenuMove();
        onUpdateSettings({ difficulty: 'easy' });
        break;
      case 'diff_normal':
        soundEngine.playMenuMove();
        onUpdateSettings({ difficulty: 'normal' });
        break;
      case 'diff_hard':
        soundEngine.playMenuMove();
        onUpdateSettings({ difficulty: 'hard' });
        break;
      case 'controls':
        soundEngine.playMenuMove();
        onOpenControls();
        break;
      case 'touch':
        cycleTouchMode();
        break;
      case 'ff':
        soundEngine.playMenuMove();
        onUpdateSettings({ friendlyFire: !settings.friendlyFire });
        break;
      case 'lvl_1':
      case 'lvl_2':
      case 'lvl_3':
      case 'lvl_4':
      case 'lvl_5':
      case 'lvl_6': {
        soundEngine.playMenuMove();
        const lvl = Number(id.slice(4)) as LevelId;
        onUpdateSettings({ startLevel: lvl });
        break;
      }
      case 'finale':
        soundEngine.playMenuConfirm();
        onPreviewFinale();
        break;
      case 'leaderboard':
        soundEngine.playMenuConfirm();
        onOpenLeaderboard();
        break;
      case 'fullscreen':
        soundEngine.playMenuMove();
        onToggleFullscreen?.();
        break;
      case 'mute':
        toggleMute();
        break;
    }
  };

  useGamepadMenuNav({
    enabled: !controlsModalOpen && !iosGuideOpen && !leaderboardOpen,
    gamepadBindings: settings.controls.gamepad,
    onActivity: () => setGpNavActive(true),
    onLeft: () => {
      soundEngine.unlock();
      soundEngine.playMenuMove();
      const rowLen = navRows[safeRow].length;
      setFocusCol((safeCol + rowLen - 1) % rowLen);
    },
    onRight: () => {
      soundEngine.unlock();
      soundEngine.playMenuMove();
      const rowLen = navRows[safeRow].length;
      setFocusCol((safeCol + 1) % rowLen);
    },
    onUp: () => {
      soundEngine.unlock();
      soundEngine.playMenuMove();
      const nextRow = (safeRow + navRows.length - 1) % navRows.length;
      setFocusRow(nextRow);
      setFocusCol(Math.min(safeCol, navRows[nextRow].length - 1));
    },
    onDown: () => {
      soundEngine.unlock();
      soundEngine.playMenuMove();
      const nextRow = (safeRow + 1) % navRows.length;
      setFocusRow(nextRow);
      setFocusCol(Math.min(safeCol, navRows[nextRow].length - 1));
    },
    onConfirm: () => {
      if (!gpNavActive) {
        setGpNavActive(true);
        activateFocusedItem('start');
        return;
      }
      activateFocusedItem(navRows[safeRow][safeCol]);
    },
    onStart: () => {
      soundEngine.unlock();
      soundEngine.playMenuConfirm();
      onStart();
    },
  });

  return (
    <div className="relative w-screen h-[100dvh] overflow-y-auto overflow-x-hidden bg-[#090C11] flex flex-col justify-between safe-area-inset">
      {/* Full-viewport Sega Mega Drive Key Art Backdrop */}
      {!imgFailed ? (
        <img
          src={TITLE_ART_URL}
          alt="GREEN BEER PIZEDES — Восемь героев на неоновой улице"
          referrerPolicy="no-referrer"
          onError={() => setImgFailed(true)}
          className="fixed inset-0 w-full h-full object-cover object-center pixelated pointer-events-none"
        />
      ) : (
        <div
          className="fixed inset-0 pointer-events-none"
          style={{
            background:
              'radial-gradient(circle at 50% 60%, #15321E 0%, #0D1420 55%, #090C11 100%)',
          }}
        />
      )}

      {/* Measured contrast scrims keeping characters clearly visible while guaranteeing 4.5:1 text legibility */}
      <div className="fixed inset-0 bg-gradient-to-b from-[#090C11]/92 via-[#090C11]/30 to-[#090C11]/95 pointer-events-none" />

      {/* Optional CRT Scanlines */}
      {settings.crtScanlines && (
        <div className="fixed inset-0 crt-scanlines pointer-events-none opacity-65" />
      )}

      {/* Top minimal utility strip (Score + Sound toggle) */}
      <div className="relative z-10 flex items-center justify-between gap-2 px-3 sm:px-6 pt-3 sm:pt-4">
        <div className="flex items-center gap-2 sm:gap-3 text-[11px] sm:text-xs text-[#A9B7C6] font-mono-num min-w-0 truncate">
          <span className="hidden sm:inline">SEGA 16-BIT EDITION</span>
          <span aria-hidden="true" className="hidden sm:inline">·</span>
          <span>HI-SCORE {highScore.toString().padStart(7, '0')}</span>
          <span aria-hidden="true" className="hidden md:inline">·</span>
          <span className="hidden md:inline">3 ЖИЗНИ × 3 HP · 3 КОНТИНЬЮ</span>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <PWAInstallButton />
          <button
            type="button"
            onClick={() => {
              soundEngine.unlock();
              soundEngine.playMenuConfirm();
              onOpenLeaderboard();
            }}
            aria-label="Топ игроков по очкам"
            className={`flex items-center gap-1.5 px-2.5 sm:px-3 min-h-[40px] sm:min-h-0 sm:py-1.5 bg-[#2A220D]/92 border border-[#FDE047] text-xs font-mono-num font-bold text-[#FEF08A] hover:bg-[#FDE047] hover:text-[#090C11] transition-colors cursor-pointer whitespace-nowrap shrink-0 ${focusRing('leaderboard')}`}
          >
            <Trophy className="w-4 h-4" />
            <span>ТОП</span>
          </button>
          {canShowFullscreen && onToggleFullscreen && (
            <button
              type="button"
              onClick={() => {
                soundEngine.unlock();
                soundEngine.playMenuMove();
                onToggleFullscreen();
              }}
              aria-label={isFullscreen ? 'Выйти из полного экрана' : 'Развернуть на полный экран'}
              className={`flex items-center gap-1.5 px-2.5 sm:px-3 min-h-[40px] sm:min-h-0 sm:py-1.5 bg-[#10272E]/92 border border-[#00E5FF] text-xs font-mono-num text-[#00E5FF] hover:bg-[#00E5FF] hover:text-[#090C11] transition-colors cursor-pointer whitespace-nowrap shrink-0 ${focusRing('fullscreen')}`}
            >
              {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
              <span className="hidden sm:inline">{isFullscreen ? 'СВЕРНУТЬ' : 'ПОЛНЫЙ ЭКРАН'}</span>
            </button>
          )}
          <button
            type="button"
            onClick={toggleMute}
            aria-label={settings.muted ? 'Включить звук' : 'Выключить звук'}
            className={`flex items-center gap-2 px-3 min-h-[40px] sm:min-h-0 sm:py-1.5 bg-[#141A24]/90 border border-[#2B3648] text-xs font-mono-num text-[#E6EDF3] hover:border-[#39FF14] transition-colors cursor-pointer whitespace-nowrap shrink-0 ${focusRing('mute')}`}
          >
            {settings.muted ? <VolumeX className="w-4 h-4 text-[#FF2A85]" /> : <Volume2 className="w-4 h-4 text-[#39FF14]" />}
            <span className="hidden sm:inline">{settings.muted ? 'ЗВУК ВЫКЛ' : 'ЗВУК ВКЛ'}</span>
          </button>
        </div>
      </div>

      {/* Upper Negative Space: Bespoke SVG Logo Lockup */}
      <div className="relative z-10 flex flex-col items-center px-3 sm:px-4 my-1 sm:mt-1">
        <svg
          viewBox="0 0 760 156"
          className="w-full max-w-[340px] sm:max-w-[560px] lg:max-w-[660px] h-auto drop-shadow-[0_6px_20px_rgba(0,0,0,0.92)]"
          role="img"
          aria-label="GREEN BEER PIZEDES"
        >
          <defs>
            <linearGradient id="neonGreen" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#B8FF9E" />
              <stop offset="45%" stopColor="#39FF14" />
              <stop offset="100%" stopColor="#14801E" />
            </linearGradient>
            <linearGradient id="rustMetal" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#F59E0B" />
              <stop offset="48%" stopColor="#B45309" />
              <stop offset="76%" stopColor="#7C2D12" />
              <stop offset="100%" stopColor="#3B1D13" />
            </linearGradient>
          </defs>

          {/* Steel backing bar with rivets */}
          <rect x="64" y="12" width="632" height="58" fill="#131923" stroke="#39FF14" strokeWidth="2.5" />
          <circle cx="78" cy="24" r="3" fill="#64748B" />
          <circle cx="682" cy="24" r="3" fill="#64748B" />
          <circle cx="78" cy="58" r="3" fill="#64748B" />
          <circle cx="682" cy="58" r="3" fill="#64748B" />

          {/* Top line: GREEN BEER */}
          <text
            x="380"
            y="55"
            textAnchor="middle"
            fontFamily="Chakra Petch, sans-serif"
            fontWeight="700"
            fontSize="44"
            letterSpacing="10"
            fill="url(#neonGreen)"
            stroke="#06210B"
            strokeWidth="2"
          >
            GREEN BEER
          </text>

          {/* Bottom jagged impact plate: PIZEDES */}
          <polygon
            points="110,74 650,74 668,142 92,142"
            fill="#1A1210"
            stroke="#B45309"
            strokeWidth="3"
          />
          <text
            x="380"
            y="129"
            textAnchor="middle"
            fontFamily="Chakra Petch, sans-serif"
            fontWeight="700"
            fontSize="58"
            letterSpacing="12"
            fill="url(#rustMetal)"
            stroke="#090C11"
            strokeWidth="3"
          >
            PIZEDES
          </text>
          {/* Neon green accent underline */}
          <rect x="136" y="138" width="488" height="4" fill="#39FF14" />
        </svg>

        <p className="mt-1 sm:mt-1.5 text-xs sm:text-sm text-[#CBD5E1] text-center max-w-xl font-medium tracking-wide">
          Вернулись с концерта Limp Bizkit в Верхней Алупке — а город заражён вирусом PIZED-77.
        </p>
      </div>

      {/* Bottom Interactive Arcade Launch Deck */}
      <div className="relative z-10 flex flex-col items-center gap-2 sm:gap-3 px-3 sm:px-6 pb-3 sm:pb-5">
        <div className="w-full max-w-3xl bg-[#0D121A]/92 border border-[#2B3648] px-3.5 sm:px-5 py-3 sm:py-4 flex flex-col gap-2.5 sm:gap-3.5">
          {/* Row 1: Mode + Primary Start CTA */}
          <div className="flex flex-wrap items-center justify-between gap-2.5 sm:gap-4">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  soundEngine.unlock();
                  soundEngine.playMenuMove();
                  onUpdateSettings({ players: 1 });
                }}
                className={`px-3.5 sm:px-4 min-h-[42px] sm:min-h-0 sm:py-2 text-xs sm:text-sm font-display font-bold tracking-wider border transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                  settings.players === 1
                    ? 'bg-[#39FF14] text-[#090C11] border-[#39FF14]'
                    : 'bg-[#141A24] text-[#CBD5E1] border-[#2B3648] hover:border-[#39FF14]'
                } ${focusRing('1p')}`}
              >
                1 PLAYER
              </button>
              <button
                type="button"
                onClick={() => {
                  soundEngine.unlock();
                  soundEngine.playMenuMove();
                  onUpdateSettings({ players: 2 });
                }}
                className={`px-3 sm:px-3.5 min-h-[42px] sm:min-h-0 sm:py-2 text-xs sm:text-sm font-display font-bold tracking-wider border transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                  settings.players === 2
                    ? 'bg-[#00E5FF] text-[#090C11] border-[#00E5FF]'
                    : 'bg-[#141A24] text-[#CBD5E1] border-[#2B3648] hover:border-[#00E5FF]'
                } ${focusRing('2p')}`}
              >
                2P ЛОКАЛЬНО
              </button>
              <button
                type="button"
                onClick={() => {
                  soundEngine.unlock();
                  soundEngine.playMenuConfirm();
                  onOpenOnlineLobby();
                }}
                className={`px-3 sm:px-3.5 min-h-[42px] sm:min-h-0 sm:py-2 text-xs sm:text-sm font-display font-bold tracking-wider border bg-[#10272E] text-[#00E5FF] border-[#00E5FF] hover:bg-[#00E5FF] hover:text-[#090C11] transition-colors cursor-pointer whitespace-nowrap shrink-0 ${focusRing('online')}`}
              >
                ОНЛАЙН 2P
              </button>
            </div>

            <button
              type="button"
              onClick={() => {
                soundEngine.unlock();
                soundEngine.playMenuConfirm();
                onStart();
              }}
              className={`flex-1 sm:flex-initial px-5 sm:px-7 min-h-[44px] sm:min-h-0 sm:py-2.5 bg-[#FF2A85] hover:bg-[#FF4696] text-white font-display font-bold text-sm sm:text-base tracking-widest border border-[#FF85B8] transition-transform active:scale-95 cursor-pointer whitespace-nowrap shrink-0 ${focusRing('start')}`}
            >
              PRESS START · ВЫБОР БОЙЦОВ
            </button>
          </div>

          {/* Row 2: Difficulty (Easy/Normal/Hard) + Platform Controls + Friendly Fire */}
          <div className="flex flex-wrap items-center justify-between gap-2 sm:gap-3 pt-2 sm:pt-2.5 border-t border-[#1E293B]">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-[11px] sm:text-xs text-[#94A3B8] mr-0.5 font-mono-num">СЛОЖНОСТЬ:</span>
              {DIFFICULTIES.map((diff) => {
                const active = settings.difficulty === diff.id;
                const activeStyle =
                  diff.id === 'easy'
                    ? 'bg-[#1F2D22] text-[#39FF14] border-[#39FF14]'
                    : diff.id === 'normal'
                      ? 'bg-[#2E2410] text-[#FFB000] border-[#FFB000]'
                      : 'bg-[#3B1520] text-[#FF2A85] border-[#FF2A85]';
                return (
                  <button
                    key={diff.id}
                    type="button"
                    title={diff.description}
                    onClick={() => {
                      soundEngine.unlock();
                      soundEngine.playMenuMove();
                      onUpdateSettings({ difficulty: diff.id as DifficultyId });
                    }}
                    className={`px-2.5 min-h-[34px] sm:min-h-0 sm:py-1 text-[11px] sm:text-xs font-mono-num font-bold border transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                      active
                        ? activeStyle
                        : 'bg-[#141A24] text-[#94A3B8] border-[#2B3648] hover:text-white'
                    } ${focusRing(`diff_${diff.id}` as FocusItemId)}`}
                  >
                    {diff.label}
                  </button>
                );
              })}
            </div>

            <div className="flex items-center gap-1.5 flex-wrap">
              <button
                type="button"
                onClick={() => {
                  soundEngine.unlock();
                  soundEngine.playMenuMove();
                  onOpenControls();
                }}
                className={`flex items-center gap-1.5 px-2.5 min-h-[34px] sm:min-h-0 sm:py-1 text-[11px] sm:text-xs font-mono-num font-bold border bg-[#1F2D22] text-[#39FF14] border-[#39FF14] hover:bg-[#39FF14] hover:text-[#090C11] transition-colors cursor-pointer whitespace-nowrap shrink-0 ${focusRing('controls')}`}
              >
                <Gamepad2 className="w-3.5 h-3.5" />
                КНОПКИ
              </button>

              <button
                type="button"
                onClick={cycleTouchMode}
                className={`px-2.5 min-h-[34px] sm:min-h-0 sm:py-1 text-[11px] sm:text-xs font-mono-num border transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                  showTouchControls
                    ? 'bg-[#10272E] text-[#00E5FF] border-[#00E5FF]'
                    : 'bg-[#141A24] text-[#94A3B8] border-[#2B3648] hover:text-white'
                } ${focusRing('touch')}`}
              >
                СЕНСОР: {TOUCH_MODE_LABELS[settings.touchControlsMode]}
              </button>

              <button
                type="button"
                onClick={() => {
                  soundEngine.unlock();
                  soundEngine.playMenuMove();
                  onUpdateSettings({ friendlyFire: !settings.friendlyFire });
                }}
                className={`px-2.5 min-h-[34px] sm:min-h-0 sm:py-1 text-[11px] sm:text-xs font-mono-num border transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                  settings.friendlyFire
                    ? 'bg-[#3B1520] text-[#FF2A85] border-[#FF2A85]'
                    : 'bg-[#141A24] text-[#94A3B8] border-[#2B3648] hover:text-white'
                } ${focusRing('ff')}`}
              >
                FF: {settings.friendlyFire ? 'ВКЛ' : 'ВЫКЛ'}
              </button>
            </div>
          </div>

          {/* Row 3: Level Select (1–6) */}
          <div className="flex items-center gap-1.5 flex-wrap pt-2 border-t border-[#1E293B]">
            <span className="text-[11px] sm:text-xs text-[#94A3B8] mr-0.5 font-mono-num">УРОВЕНЬ:</span>
            {LEVELS.map((lvl) => (
              <button
                key={lvl.id}
                type="button"
                onClick={() => {
                  soundEngine.unlock();
                  soundEngine.playMenuMove();
                  onUpdateSettings({ startLevel: lvl.id as LevelId });
                }}
                className={`px-2 sm:px-2.5 min-h-[34px] sm:min-h-0 sm:py-1 text-[11px] sm:text-xs font-mono-num border transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                  settings.startLevel === lvl.id
                    ? 'bg-[#1F2D22] text-[#39FF14] border-[#39FF14]'
                    : 'bg-[#141A24] text-[#94A3B8] border-[#2B3648] hover:text-white'
                } ${focusRing(`lvl_${lvl.id}` as FocusItemId)}`}
              >
                {lvl.shortName}
              </button>
            ))}
            <button
              type="button"
              onClick={() => {
                soundEngine.unlock();
                soundEngine.playMenuConfirm();
                onPreviewFinale();
              }}
              className={`px-2.5 min-h-[34px] sm:min-h-0 sm:py-1 text-[11px] sm:text-xs font-mono-num font-bold border border-[#FF40A8] bg-[#2D1028] text-[#FEF08A] hover:bg-[#FF40A8] hover:text-white transition-colors cursor-pointer whitespace-nowrap shrink-0 ${focusRing('finale')}`}
            >
              ★ ФИНАЛ
            </button>
          </div>
        </div>

        {/* Dynamic Platform Control Hint Line */}
        <div className="text-[11px] sm:text-xs text-[#94A3B8] font-mono-num tracking-wide text-center">
          {gamepadCount > 0 ? (
            <>
              Джойстик ({gamepadCount}): Стик/D-Pad навигация · A/✕ выбрать · START в бой · В бою:{' '}
              {formatGamepadBinding(settings.controls.gamepad.shoot)} Огонь ·{' '}
              {formatGamepadBinding(settings.controls.gamepad.melee)} Удар ·{' '}
              {formatGamepadBinding(settings.controls.gamepad.jump)} Прыжок
            </>
          ) : showTouchControls || isTouchDevice ? (
            <>
              Сенсор: стик · ОГОНЬ · УДАР · ПРЫЖОК · СТВОЛ · Джойстик:{' '}
              {formatGamepadBinding(settings.controls.gamepad.shoot)} Огонь ·{' '}
              {formatGamepadBinding(settings.controls.gamepad.melee)} Удар ·{' '}
              {formatGamepadBinding(settings.controls.gamepad.jump)} Прыжок
            </>
          ) : (
            <>
              P1: {formatKeyCode(settings.controls.p1Keyboard.up)}
              {formatKeyCode(settings.controls.p1Keyboard.left)}
              {formatKeyCode(settings.controls.p1Keyboard.down)}
              {formatKeyCode(settings.controls.p1Keyboard.right)} ·{' '}
              {formatKeyCode(settings.controls.p1Keyboard.melee)} Удар ·{' '}
              {formatKeyCode(settings.controls.p1Keyboard.jump)} Прыжок ·{' '}
              {formatKeyCode(settings.controls.p1Keyboard.shoot)} Огонь ·{' '}
              {formatKeyCode(settings.controls.p1Keyboard.swap)} Ствол · Esc/{formatKeyCode(settings.controls.p1Keyboard.pause)} Пауза
            </>
          )}
        </div>
      </div>
    </div>
  );
}
