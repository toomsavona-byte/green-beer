import { useEffect, useState } from 'react';
import { Volume2, VolumeX } from 'lucide-react';
import { DIFFICULTIES, LEVELS, TITLE_ART_URL } from '../game/data';
import { soundEngine } from '../game/audio';
import { DifficultyId, GameSettings, LevelId, TouchControlsMode } from '../game/types';

interface TitleScreenProps {
  settings: GameSettings;
  highScore: number;
  showTouchControls: boolean;
  isTouchDevice: boolean;
  gamepadCount: number;
  onUpdateSettings: (partial: Partial<GameSettings>) => void;
  onStart: () => void;
  onOpenOnlineLobby: () => void;
}

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
  onUpdateSettings,
  onStart,
  onOpenOnlineLobby,
}: TitleScreenProps) {
  const [imgFailed, setImgFailed] = useState(false);

  useEffect(() => {
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
  }, [onStart, onUpdateSettings]);

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

        <button
          type="button"
          onClick={toggleMute}
          aria-label={settings.muted ? 'Включить звук' : 'Выключить звук'}
          className="flex items-center gap-2 px-3 min-h-[40px] sm:min-h-0 sm:py-1.5 bg-[#141A24]/90 border border-[#2B3648] text-xs font-mono-num text-[#E6EDF3] hover:border-[#39FF14] transition-colors cursor-pointer whitespace-nowrap shrink-0"
        >
          {settings.muted ? <VolumeX className="w-4 h-4 text-[#FF2A85]" /> : <Volume2 className="w-4 h-4 text-[#39FF14]" />}
          <span className="hidden sm:inline">{settings.muted ? 'ЗВУК ВЫКЛ' : 'ЗВУК ВКЛ'}</span>
        </button>
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
                }`}
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
                }`}
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
                className="px-3 sm:px-3.5 min-h-[42px] sm:min-h-0 sm:py-2 text-xs sm:text-sm font-display font-bold tracking-wider border bg-[#10272E] text-[#00E5FF] border-[#00E5FF] hover:bg-[#00E5FF] hover:text-[#090C11] transition-colors cursor-pointer whitespace-nowrap shrink-0"
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
              className="flex-1 sm:flex-initial px-5 sm:px-7 min-h-[44px] sm:min-h-0 sm:py-2.5 bg-[#FF2A85] hover:bg-[#FF4696] text-white font-display font-bold text-sm sm:text-base tracking-widest border border-[#FF85B8] transition-transform active:scale-95 cursor-pointer whitespace-nowrap shrink-0"
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
                    }`}
                  >
                    {diff.label}
                  </button>
                );
              })}
            </div>

            <div className="flex items-center gap-1.5 flex-wrap">
              <button
                type="button"
                onClick={cycleTouchMode}
                className={`px-2.5 min-h-[34px] sm:min-h-0 sm:py-1 text-[11px] sm:text-xs font-mono-num border transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                  showTouchControls
                    ? 'bg-[#10272E] text-[#00E5FF] border-[#00E5FF]'
                    : 'bg-[#141A24] text-[#94A3B8] border-[#2B3648] hover:text-white'
                }`}
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
                }`}
              >
                FF: {settings.friendlyFire ? 'ВКЛ' : 'ВЫКЛ'}
              </button>
            </div>
          </div>

          {/* Row 3: Level Select (1–5) */}
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
                }`}
              >
                {lvl.shortName}
              </button>
            ))}
          </div>
        </div>

        {/* Dynamic Platform Control Hint Line */}
        <div className="text-[11px] sm:text-xs text-[#94A3B8] font-mono-num tracking-wide text-center">
          {showTouchControls || isTouchDevice ? (
            <>
              Сенсорный геймпад: левый стик (8 напр.) · ОГОНЬ · УДАР · ПРЫЖОК · СТВОЛ
              {gamepadCount > 0 ? ` · Подключено геймпадов: ${gamepadCount}` : ' · Поддержка Bluetooth-геймпадов'}
            </>
          ) : (
            <>
              P1: WASD · J Удар · K Прыжок · L Огонь · I Ствол · P2: Стрелки + Num 1/2/3/4 (; &apos; / .) · Esc Пауза
              {gamepadCount > 0 ? ` · Геймпадов: ${gamepadCount}` : ''}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
