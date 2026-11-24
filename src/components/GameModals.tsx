import { useEffect, useMemo, useState } from 'react';
import { Gamepad2, Maximize2, Minimize2 } from 'lucide-react';
import { soundEngine } from '../game/audio';
import { formatGamepadBinding, formatKeyCode } from '../game/controls';
import { DIFFICULTY_MAP } from '../game/data';
import { DifficultyId, GameSettings, ScreenState, StageClearSummary, TouchControlsMode } from '../game/types';
import { useGamepadMenuNav } from '../hooks/useGamepadMenuNav';

interface GameModalsProps {
  screen: ScreenState;
  settings: GameSettings;
  showTouchControls: boolean;
  continuesLeft: number;
  score: number;
  highScore: number;
  stageSummary: StageClearSummary | null;
  controlsModalOpen?: boolean;
  iosGuideOpen?: boolean;
  canShowFullscreen?: boolean;
  isFullscreen?: boolean;
  onToggleFullscreen?: () => void;
  onResume: () => void;
  onRestartLevel: () => void;
  onUseContinue: () => void;
  onGiveUpContinue: () => void;
  onNextStage: () => void;
  onReturnTitle: () => void;
  onUpdateSettings: (partial: Partial<GameSettings>) => void;
  onOpenControls: () => void;
  isOnlineGuest?: boolean;
}

const TOUCH_LABELS: Record<TouchControlsMode, string> = {
  auto: 'АВТО',
  on: 'ВКЛ',
  off: 'ВЫКЛ',
};

export function GameModals({
  screen,
  settings,
  showTouchControls,
  continuesLeft,
  score,
  highScore,
  stageSummary,
  controlsModalOpen = false,
  iosGuideOpen = false,
  canShowFullscreen = false,
  isFullscreen = false,
  onToggleFullscreen,
  onResume,
  onRestartLevel,
  onUseContinue,
  onGiveUpContinue,
  onNextStage,
  onReturnTitle,
  onUpdateSettings,
  onOpenControls,
  isOnlineGuest = false,
}: GameModalsProps) {
  const [countdown, setCountdown] = useState(10);
  const [focusIdx, setFocusIdx] = useState(0);
  const [gpNavActive, setGpNavActive] = useState(false);

  const isModalScreen = ['PAUSED', 'CONTINUE', 'STAGE_CLEAR', 'GAME_OVER', 'VICTORY'].includes(screen);

  const modalItems = useMemo<string[]>(() => {
    if (screen === 'PAUSED') {
      const list = ['resume', 'controls', 'difficulty', 'ff', 'crt', 'touch'];
      if (canShowFullscreen && onToggleFullscreen) list.push('fullscreen');
      list.push('restart', 'title');
      return list;
    }
    if (screen === 'CONTINUE') {
      return isOnlineGuest ? [] : ['continue', 'giveup'];
    }
    if (screen === 'STAGE_CLEAR') {
      return isOnlineGuest ? [] : ['next'];
    }
    if (screen === 'GAME_OVER') {
      return isOnlineGuest ? ['title'] : ['restart', 'title'];
    }
    if (screen === 'VICTORY') {
      return ['title'];
    }
    return [];
  }, [screen, isOnlineGuest, canShowFullscreen, onToggleFullscreen]);

  useEffect(() => {
    setFocusIdx(0);
  }, [screen]);

  useEffect(() => {
    const clearGp = () => setGpNavActive(false);
    window.addEventListener('pointerdown', clearGp, { passive: true });
    return () => window.removeEventListener('pointerdown', clearGp);
  }, []);

  const safeIdx = modalItems.length > 0 ? Math.min(focusIdx, modalItems.length - 1) : 0;
  const focusedKey = gpNavActive && modalItems.length > 0 ? modalItems[safeIdx] : null;
  const focusRing = (key: string) => (focusedKey === key ? 'gp-focus-ring' : '');

  useEffect(() => {
    if (screen !== 'CONTINUE' || isOnlineGuest) return;
    setCountdown(10);
    const id = window.setInterval(() => {
      setCountdown((c) => {
        if (c <= 1) {
          window.clearInterval(id);
          onGiveUpContinue();
          return 0;
        }
        return c - 1;
      });
    }, 1000);
    return () => window.clearInterval(id);
  }, [screen, isOnlineGuest, onGiveUpContinue]);

  useEffect(() => {
    if (isOnlineGuest || controlsModalOpen || iosGuideOpen) return;
    if (!isModalScreen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Enter' || e.code === 'Space') {
        e.preventDefault();
        if (screen === 'PAUSED') onResume();
        else if (screen === 'CONTINUE' && continuesLeft > 0) onUseContinue();
        else if (screen === 'STAGE_CLEAR') onNextStage();
        else if (screen === 'GAME_OVER' || screen === 'VICTORY') onReturnTitle();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [screen, continuesLeft, controlsModalOpen, iosGuideOpen, isModalScreen, isOnlineGuest, onResume, onUseContinue, onNextStage, onReturnTitle]);

  const cycleTouchMode = () => {
    const order: TouchControlsMode[] = ['auto', 'on', 'off'];
    const next = order[(order.indexOf(settings.touchControlsMode) + 1) % order.length];
    onUpdateSettings({ touchControlsMode: next });
  };

  const cycleDifficulty = () => {
    const order: DifficultyId[] = ['easy', 'normal', 'hard'];
    const next = order[(order.indexOf(settings.difficulty) + 1) % order.length];
    onUpdateSettings({ difficulty: next });
  };

  const triggerModalItem = (key: string) => {
    soundEngine.unlock();
    switch (key) {
      case 'resume':
        soundEngine.playMenuConfirm();
        onResume();
        break;
      case 'controls':
        soundEngine.playMenuMove();
        onOpenControls();
        break;
      case 'difficulty':
        soundEngine.playMenuMove();
        cycleDifficulty();
        break;
      case 'ff':
        soundEngine.playMenuMove();
        onUpdateSettings({ friendlyFire: !settings.friendlyFire });
        break;
      case 'crt':
        soundEngine.playMenuMove();
        onUpdateSettings({ crtScanlines: !settings.crtScanlines });
        break;
      case 'touch':
        soundEngine.playMenuMove();
        cycleTouchMode();
        break;
      case 'fullscreen':
        soundEngine.playMenuMove();
        onToggleFullscreen?.();
        break;
      case 'restart':
        soundEngine.playMenuConfirm();
        onRestartLevel();
        break;
      case 'title':
        soundEngine.playMenuConfirm();
        onReturnTitle();
        break;
      case 'continue':
        if (continuesLeft > 0) {
          soundEngine.playMenuConfirm();
          onUseContinue();
        }
        break;
      case 'giveup':
        soundEngine.playMenuMove();
        onGiveUpContinue();
        break;
      case 'next':
        soundEngine.playMenuConfirm();
        onNextStage();
        break;
    }
  };

  useGamepadMenuNav({
    enabled: isModalScreen && !controlsModalOpen && !iosGuideOpen && modalItems.length > 0,
    gamepadBindings: settings.controls.gamepad,
    onActivity: () => setGpNavActive(true),
    onUp: () => {
      if (modalItems.length <= 1) return;
      soundEngine.playMenuMove();
      setFocusIdx((i) => (i + modalItems.length - 1) % modalItems.length);
    },
    onDown: () => {
      if (modalItems.length <= 1) return;
      soundEngine.playMenuMove();
      setFocusIdx((i) => (i + 1) % modalItems.length);
    },
    onLeft: () => {
      const cur = modalItems[safeIdx];
      if (cur === 'difficulty' || cur === 'touch' || cur === 'ff' || cur === 'crt') {
        triggerModalItem(cur);
      } else if (modalItems.length > 1) {
        soundEngine.playMenuMove();
        setFocusIdx((i) => (i + modalItems.length - 1) % modalItems.length);
      }
    },
    onRight: () => {
      const cur = modalItems[safeIdx];
      if (cur === 'difficulty' || cur === 'touch' || cur === 'ff' || cur === 'crt') {
        triggerModalItem(cur);
      } else if (modalItems.length > 1) {
        soundEngine.playMenuMove();
        setFocusIdx((i) => (i + 1) % modalItems.length);
      }
    },
    onConfirm: () => {
      const key = modalItems[safeIdx];
      if (key) triggerModalItem(key);
    },
    onBack: () => {
      if (screen === 'PAUSED') {
        soundEngine.playMenuMove();
        onResume();
      } else if (screen === 'GAME_OVER' || screen === 'VICTORY') {
        soundEngine.playMenuMove();
        onReturnTitle();
      }
    },
    // Do NOT bind onStart during PAUSED because GameEngine.pollGamepadPause already toggles PAUSED on START
    onStart:
      screen === 'PAUSED'
        ? undefined
        : () => {
            const key = modalItems[safeIdx];
            if (key) triggerModalItem(key);
          },
  });

  if (screen === 'PAUSED') {
    const diffInfo = DIFFICULTY_MAP[settings.difficulty];
    const p1 = settings.controls.p1Keyboard;
    const p2 = settings.controls.p2Keyboard;
    const gp = settings.controls.gamepad;
    return (
      <div className="fixed inset-0 z-30 bg-[#090C11]/82 flex items-center justify-center p-3 sm:p-4">
        <div className="w-full max-w-md max-h-[92dvh] overflow-y-auto bg-[#121822] border-2 border-[#39FF14] p-4 sm:p-6 flex flex-col gap-3 sm:gap-4">
          <div className="flex items-center justify-between border-b border-[#242F40] pb-2.5">
            <h2 className="font-display font-bold text-xl sm:text-2xl text-[#39FF14] tracking-wider">ПАУЗА</h2>
            <span className="font-mono-num text-xs text-[#94A3B8]">
              ESC / {formatKeyCode(p1.pause)} / {formatGamepadBinding(gp.pause)}
            </span>
          </div>

          <div className="flex flex-col gap-1.5 text-[11px] sm:text-xs font-mono-num text-[#CBD5E1] bg-[#090C11] border border-[#242F40] p-2.5 sm:p-3">
            {showTouchControls ? (
              <>
                <div>СЕНСОР: Стик слева · Справа: ОГОНЬ, УДАР, ПРЫЖОК, СТВОЛ</div>
                <div>
                  ДЖОЙСТИК: {formatGamepadBinding(gp.shoot)} Огонь · {formatGamepadBinding(gp.melee)} Удар ·{' '}
                  {formatGamepadBinding(gp.jump)} Прыжок · {formatGamepadBinding(gp.swap)} Ствол
                </div>
              </>
            ) : (
              <>
                <div>
                  P1: {formatKeyCode(p1.up)}
                  {formatKeyCode(p1.left)}
                  {formatKeyCode(p1.down)}
                  {formatKeyCode(p1.right)} · {formatKeyCode(p1.melee)} Удар · {formatKeyCode(p1.jump)} Прыжок ·{' '}
                  {formatKeyCode(p1.shoot)} Огонь · {formatKeyCode(p1.swap)} Ствол
                </div>
                <div>
                  P2: {formatKeyCode(p2.up)}
                  {formatKeyCode(p2.left)}
                  {formatKeyCode(p2.down)}
                  {formatKeyCode(p2.right)} · {formatKeyCode(p2.melee)} Удар · {formatKeyCode(p2.jump)} Прыжок ·{' '}
                  {formatKeyCode(p2.shoot)} Огонь · {formatKeyCode(p2.swap)} Ствол
                </div>
                <div>
                  ДЖОЙСТИК: {formatGamepadBinding(gp.shoot)} Огонь · {formatGamepadBinding(gp.melee)} Удар ·{' '}
                  {formatGamepadBinding(gp.jump)} Прыжок · {formatGamepadBinding(gp.swap)} Ствол
                </div>
              </>
            )}
          </div>

          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={onOpenControls}
              className={`col-span-2 flex items-center justify-center gap-2 px-3 min-h-[40px] py-2 text-[11px] sm:text-xs font-mono-num bg-[#1F2D22] border border-[#39FF14] hover:bg-[#39FF14] text-[#39FF14] hover:text-[#090C11] font-bold cursor-pointer transition-colors ${focusRing('controls')}`}
            >
              <Gamepad2 className="w-4 h-4" />
              НАЗНАЧЕНИЕ КНОПОК (КЛАВИАТУРА / ДЖОЙСТИК)
            </button>
            <button
              type="button"
              onClick={cycleDifficulty}
              className={`col-span-2 px-3 min-h-[40px] py-2 text-[11px] sm:text-xs font-mono-num bg-[#141A24] border border-[#2B3648] hover:border-[#FFB000] text-[#FFB000] font-bold cursor-pointer ${focusRing('difficulty')}`}
            >
              СЛОЖНОСТЬ: {diffInfo.label} (нажмите для смены)
            </button>
            <button
              type="button"
              onClick={() => onUpdateSettings({ friendlyFire: !settings.friendlyFire })}
              className={`px-2.5 min-h-[40px] py-2 text-[11px] sm:text-xs font-mono-num bg-[#141A24] border border-[#2B3648] hover:border-[#FF2A85] text-white cursor-pointer ${focusRing('ff')}`}
            >
              FRIENDLY FIRE: {settings.friendlyFire ? 'ВКЛ' : 'ВЫКЛ'}
            </button>
            <button
              type="button"
              onClick={() => onUpdateSettings({ crtScanlines: !settings.crtScanlines })}
              className={`px-2.5 min-h-[40px] py-2 text-[11px] sm:text-xs font-mono-num bg-[#141A24] border border-[#2B3648] hover:border-[#00E5FF] text-white cursor-pointer ${focusRing('crt')}`}
            >
              CRT: {settings.crtScanlines ? 'ВКЛ' : 'ВЫКЛ'}
            </button>
            <button
              type="button"
              onClick={cycleTouchMode}
              className={`col-span-2 px-3 min-h-[40px] py-2 text-[11px] sm:text-xs font-mono-num bg-[#141A24] border border-[#2B3648] hover:border-[#39FF14] text-[#00E5FF] cursor-pointer ${focusRing('touch')}`}
            >
              СЕНСОРНЫЕ КНОПКИ: {TOUCH_LABELS[settings.touchControlsMode]} ({showTouchControls ? 'АКТИВНЫ' : 'СКРЫТЫ'})
            </button>
            {canShowFullscreen && onToggleFullscreen && (
              <button
                type="button"
                onClick={onToggleFullscreen}
                className={`col-span-2 flex items-center justify-center gap-2 px-3 min-h-[40px] py-2 text-[11px] sm:text-xs font-mono-num bg-[#10272E] border border-[#00E5FF] hover:bg-[#00E5FF] text-[#00E5FF] hover:text-[#090C11] font-bold cursor-pointer transition-colors ${focusRing('fullscreen')}`}
              >
                {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
                {isFullscreen ? 'ВЫЙТИ ИЗ ПОЛНОГО ЭКРАНА' : 'РАЗВЕРНУТЬ НА ПОЛНЫЙ ЭКРАН'}
              </button>
            )}
          </div>

          <div className="flex flex-col gap-2 pt-1">
            <button
              type="button"
              onClick={onResume}
              className={`w-full min-h-[44px] py-2.5 bg-[#39FF14] text-[#090C11] font-display font-bold text-sm tracking-widest cursor-pointer ${focusRing('resume')}`}
            >
              ПРОДОЛЖИТЬ БОЙ
            </button>
            <button
              type="button"
              onClick={onRestartLevel}
              className={`w-full min-h-[42px] py-2 bg-[#1B2331] border border-[#2B3648] hover:border-[#FFB000] text-[#E6EDF3] font-display font-bold text-sm tracking-wider cursor-pointer ${focusRing('restart')}`}
            >
              НАЧАТЬ УРОВЕНЬ ЗАНОВО
            </button>
            <button
              type="button"
              onClick={onReturnTitle}
              className={`w-full min-h-[42px] py-2 bg-[#141A24] border border-[#2B3648] hover:border-[#FF2A85] text-[#94A3B8] hover:text-white font-display font-bold text-sm tracking-wider cursor-pointer ${focusRing('title')}`}
            >
              ВЫЙТИ В ГЛАВНОЕ МЕНЮ
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (screen === 'CONTINUE') {
    return (
      <div className="fixed inset-0 z-30 bg-[#090C11]/88 flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-[#121822] border-2 border-[#FFB000] p-6 text-center flex flex-col gap-4">
          <div className="font-mono-num text-xs text-[#FF2A85] font-bold">
            ВСЕ ЖИЗНИ ПОТРАЧЕНЫ
          </div>
          <h2 className="font-display font-bold text-4xl text-[#FFB000] tracking-widest">
            CONTINUE?
          </h2>
          <div className="font-mono-num text-6xl font-bold text-white">{countdown}</div>
          <div className="text-xs font-mono-num text-[#94A3B8]">
            ОСТАЛОСЬ КОНТИНЬЮ: <span className="text-[#39FF14] font-bold">{continuesLeft} / 3</span> · ВОЗРОЖДЕНИЕ: 3 ЖИЗНИ × 3 HP
          </div>

          <div className="flex flex-col gap-2 pt-2">
            {isOnlineGuest ? (
              <div className="py-3 bg-[#090C11] border border-[#00E5FF] text-[#00E5FF] font-mono-num text-xs">
                ОЖИДАНИЕ РЕШЕНИЯ ХОСТА (P1)...
              </div>
            ) : (
              <>
                <button
                  type="button"
                  onClick={onUseContinue}
                  className={`w-full py-3 bg-[#39FF14] text-[#090C11] font-display font-bold text-base tracking-widest cursor-pointer ${focusRing('continue')}`}
                >
                  ИСПОЛЬЗОВАТЬ КОНТИНЬЮ (ENTER)
                </button>
                <button
                  type="button"
                  onClick={onGiveUpContinue}
                  className={`w-full py-2 bg-[#141A24] border border-[#2B3648] text-[#94A3B8] hover:text-white font-mono-num text-xs cursor-pointer ${focusRing('giveup')}`}
                >
                  СДАТЬСЯ (GAME OVER)
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (screen === 'STAGE_CLEAR' && stageSummary) {
    const isFinalStage = stageSummary.levelId >= 7;
    return (
      <div className="fixed inset-0 z-30 bg-[#090C11]/88 flex items-center justify-center p-4">
        <div className="w-full max-w-lg bg-[#121822] border-2 border-[#39FF14] p-6 flex flex-col gap-4">
          <div className="text-center">
            <div className="font-mono-num text-xs text-[#FFB000]">
              {isFinalStage ? 'ИГРА ПРОЙДЕНА · ПОБЕДА!' : 'УРОВЕНЬ ПРОЙДЕН'}
            </div>
            <h2 className="font-display font-bold text-3xl text-[#39FF14] tracking-wider mt-1">
              {isFinalStage ? 'ФИНАЛ ПРОЙДЕН!' : `STAGE ${stageSummary.levelId} CLEAR!`}
            </h2>
            <p className="text-sm text-[#CBD5E1] mt-1">
              {stageSummary.levelId === 3
                ? 'Электрик повержен, подстанция взорвана — забор завода обесточен!'
                : `Босс «${stageSummary.bossName}» повержен.`}
            </p>
          </div>

          <div className="grid grid-cols-3 gap-2 bg-[#090C11] border border-[#242F40] p-3 text-center font-mono-num">
            <div>
              <div className="text-[11px] text-[#94A3B8]">СЧЁТ</div>
              <div className="text-lg font-bold text-white">{stageSummary.score}</div>
            </div>
            <div>
              <div className="text-[11px] text-[#94A3B8]">ВРАГОВ</div>
              <div className="text-lg font-bold text-[#39FF14]">{stageSummary.enemiesDefeated}</div>
            </div>
            <div>
              <div className="text-[11px] text-[#94A3B8]">КОНТИНЬЮ</div>
              <div className="text-lg font-bold text-[#FFB000]">{stageSummary.continuesLeft}/3</div>
            </div>
          </div>

          {isOnlineGuest ? (
            <div className="w-full py-3 bg-[#090C11] border border-[#00E5FF] text-center text-[#00E5FF] font-mono-num text-xs">
              {isFinalStage
                ? 'ОЖИДАНИЕ ЗАПУСКА ФИНАЛЬНОЙ ЗАСТАВКИ ХОСТОМ...'
                : 'ОЖИДАНИЕ ПЕРЕХОДА ХОСТА НА СЛЕДУЮЩИЙ ЭТАП...'}
            </div>
          ) : (
            <button
              type="button"
              onClick={onNextStage}
              className={`w-full py-3 bg-[#39FF14] text-[#090C11] font-display font-bold text-base tracking-widest cursor-pointer ${focusRing('next')}`}
            >
              {isFinalStage ? 'СМОТРЕТЬ ФИНАЛ ->' : 'СЛЕДУЮЩИЙ УРОВЕНЬ ->'}
            </button>
          )}
        </div>
      </div>
    );
  }

  if (screen === 'GAME_OVER') {
    return (
      <div className="fixed inset-0 z-30 bg-[#090C11]/92 flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-[#121822] border-2 border-[#FF2A85] p-6 text-center flex flex-col gap-4">
          <h2 className="font-display font-bold text-4xl text-[#FF2A85] tracking-widest">
            GAME OVER
          </h2>
          <p className="text-sm text-[#CBD5E1]">
            Вирус PIZED-77 на этот раз оказался сильнее. Соберись и верни город!
          </p>
          <div className="bg-[#090C11] border border-[#242F40] p-3 font-mono-num text-sm flex justify-between">
            <span className="text-[#94A3B8]">ИТОГОВЫЙ СЧЁТ</span>
            <span className="text-white font-bold">{score}</span>
          </div>
          <div className="flex flex-col gap-2 pt-1">
            {!isOnlineGuest && (
              <button
                type="button"
                onClick={onRestartLevel}
                className={`w-full py-2.5 bg-[#39FF14] text-[#090C11] font-display font-bold text-sm tracking-widest cursor-pointer ${focusRing('restart')}`}
              >
                ИГРАТЬ СНОВА (3 КОНТИНЬЮ)
              </button>
            )}
            <button
              type="button"
              onClick={onReturnTitle}
              className={`w-full py-2 bg-[#141A24] border border-[#2B3648] text-[#CBD5E1] font-display font-bold text-sm cursor-pointer ${focusRing('title')}`}
            >
              В ГЛАВНОЕ МЕНЮ
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (screen === 'VICTORY') {
    return (
      <div className="fixed inset-0 z-30 bg-[#090C11]/92 flex items-center justify-center p-4">
        <div className="w-full max-w-lg bg-[#121822] border-2 border-[#39FF14] p-7 text-center flex flex-col gap-4">
          <div className="font-mono-num text-xs text-[#FFB000] tracking-widest">
            МИССИЯ ВЫПОЛНЕНА · ХАРДКОР ПРОЙДЕН
          </div>
          <h2 className="font-display font-bold text-4xl text-[#39FF14] tracking-wider">
            ГОРОД СВОБОДЕН!
          </h2>
          <p className="text-sm text-[#CBD5E1] leading-relaxed">
            Директор завода «Зелёный Поток» повержен, вирус «PIZED-77» уничтожен.
            Восемь товарищей возвращают городу нормальное классическое пиво и живой звук!
          </p>
          <div className="grid grid-cols-2 gap-3 bg-[#090C11] border border-[#242F40] p-4 font-mono-num">
            <div>
              <div className="text-xs text-[#94A3B8]">ФИНАЛЬНЫЙ СЧЁТ</div>
              <div className="text-2xl font-bold text-white">{score}</div>
            </div>
            <div>
              <div className="text-xs text-[#94A3B8]">РЕКОРД</div>
              <div className="text-2xl font-bold text-[#FFB000]">{Math.max(score, highScore)}</div>
            </div>
          </div>
          <button
            type="button"
            onClick={onReturnTitle}
            className={`w-full py-3 bg-[#39FF14] text-[#090C11] font-display font-bold text-base tracking-widest cursor-pointer ${focusRing('title')}`}
          >
            ИГРАТЬ ЕЩЁ РАЗ
          </button>
        </div>
      </div>
    );
  }

  return null;
}
