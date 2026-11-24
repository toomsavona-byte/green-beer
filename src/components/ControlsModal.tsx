import { useEffect, useMemo, useRef, useState } from 'react';
import { Gamepad2, Keyboard, RotateCcw, X } from 'lucide-react';
import { soundEngine } from '../game/audio';
import {
  ACTION_META,
  areGamepadBindingsEqual,
  ControlBindings,
  DEFAULT_GAMEPAD,
  DEFAULT_P1_KEYBOARD,
  DEFAULT_P2_KEYBOARD,
  formatGamepadBinding,
  formatKeyCode,
  GAMEPAD_PRESET_SHOOTER,
  GamepadAction,
  GamepadBinding,
  KeyboardAction,
  Player2KeyboardAction,
} from '../game/controls';
import { useGamepadMenuNav } from '../hooks/useGamepadMenuNav';

interface ControlsModalProps {
  bindings: ControlBindings;
  isTouchDevice: boolean;
  gamepadCount: number;
  onChange: (next: ControlBindings) => void;
  onClose: () => void;
}

type TabId = 'p1' | 'p2' | 'gamepad';

type ListeningTarget =
  | { tab: 'p1'; action: KeyboardAction }
  | { tab: 'p2'; action: Player2KeyboardAction }
  | { tab: 'gamepad'; action: GamepadAction }
  | null;

const P1_ACTIONS: KeyboardAction[] = ['up', 'down', 'left', 'right', 'melee', 'jump', 'shoot', 'swap', 'pause'];
const P2_ACTIONS: Player2KeyboardAction[] = ['up', 'down', 'left', 'right', 'melee', 'jump', 'shoot', 'swap'];
const GP_ACTIONS: GamepadAction[] = ['shoot', 'melee', 'jump', 'swap', 'pause', 'up', 'down', 'left', 'right'];

function readConnectedGamepads(): Gamepad[] {
  if (typeof navigator === 'undefined' || !navigator.getGamepads) return [];
  try {
    const list = navigator.getGamepads();
    const out: Gamepad[] = [];
    for (let i = 0; i < list.length; i++) {
      const gp = list[i];
      if (gp && gp.connected) out.push(gp);
    }
    return out;
  } catch {
    return [];
  }
}

export function ControlsModal({
  bindings,
  isTouchDevice,
  gamepadCount,
  onChange,
  onClose,
}: ControlsModalProps) {
  const [tab, setTab] = useState<TabId>(() => (isTouchDevice || gamepadCount > 0 ? 'gamepad' : 'p1'));
  const [listening, setListening] = useState<ListeningTarget>(null);
  const [padNames, setPadNames] = useState<string[]>(() => readConnectedGamepads().map((p) => p.id));
  const [lastDetectedPadInput, setLastDetectedPadInput] = useState<string | null>(null);
  const [gpNavActive, setGpNavActive] = useState(gamepadCount > 0);
  const [focusIdx, setFocusIdx] = useState(0);
  const [navCooldownUntil, setNavCooldownUntil] = useState(0);

  const bindingsRef = useRef(bindings);
  bindingsRef.current = bindings;
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  // Baseline snapshot taken right when gamepad listening starts, so resting triggers/sticks don't false-fire
  const baselineButtonsRef = useRef<Record<number, boolean[]>>({});
  const baselineAxesRef = useRef<Record<number, number[]>>({});

  useEffect(() => {
    const clearGp = () => setGpNavActive(false);
    window.addEventListener('pointerdown', clearGp, { passive: true });
    return () => window.removeEventListener('pointerdown', clearGp);
  }, []);

  const focusableIds = useMemo<string[]>(() => {
    const list: string[] = [];
    if (tab === 'gamepad') {
      list.push('preset:classic', 'preset:shooter');
      GP_ACTIONS.forEach((a) => list.push(`act:${a}`));
    } else if (tab === 'p1') {
      P1_ACTIONS.forEach((a) => list.push(`act:${a}`));
    } else {
      P2_ACTIONS.forEach((a) => list.push(`act:${a}`));
    }
    list.push('reset', 'done');
    return list;
  }, [tab]);

  useEffect(() => {
    setFocusIdx(0);
  }, [tab]);

  const safeFocusIdx = Math.min(focusIdx, Math.max(0, focusableIds.length - 1));
  const focusedId = gpNavActive && !listening ? focusableIds[safeFocusIdx] : null;
  const focusRing = (id: string) => (focusedId === id ? 'gp-focus-ring' : '');

  const beginListening = (target: ListeningTarget) => {
    soundEngine.playMenuMove();
    if (target?.tab === 'gamepad') {
      const pads = readConnectedGamepads();
      const btnMap: Record<number, boolean[]> = {};
      const axisMap: Record<number, number[]> = {};
      for (const pad of pads) {
        btnMap[pad.index] = pad.buttons.map((b) => Boolean(b.pressed) || b.value > 0.45);
        axisMap[pad.index] = pad.axes.map((a) => Number(a) || 0);
      }
      baselineButtonsRef.current = btnMap;
      baselineAxesRef.current = axisMap;
    }
    setListening(target);
  };

  // Keyboard listener for remapping P1 / P2 keys and ESC close/cancel
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (listening && (listening.tab === 'p1' || listening.tab === 'p2')) {
        e.preventDefault();
        e.stopPropagation();
        if (e.code === 'Escape') {
          soundEngine.playMenuMove();
          setListening(null);
          return;
        }
        const cur = bindingsRef.current;
        if (listening.tab === 'p1') {
          const nextP1 = { ...cur.p1Keyboard };
          const prevCode = nextP1[listening.action];
          // Swap cleanly if another P1 action already uses this key
          (Object.keys(nextP1) as KeyboardAction[]).forEach((act) => {
            if (act !== listening.action && nextP1[act] === e.code) {
              nextP1[act] = prevCode;
            }
          });
          nextP1[listening.action] = e.code;
          onChangeRef.current({ ...cur, p1Keyboard: nextP1 });
        } else {
          const nextP2 = { ...cur.p2Keyboard };
          const prevCode = nextP2[listening.action];
          (Object.keys(nextP2) as Player2KeyboardAction[]).forEach((act) => {
            if (act !== listening.action && nextP2[act] === e.code) {
              nextP2[act] = prevCode;
            }
          });
          nextP2[listening.action] = e.code;
          onChangeRef.current({ ...cur, p2Keyboard: nextP2 });
        }
        soundEngine.playMenuConfirm();
        setListening(null);
        return;
      }

      if (e.code === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        if (listening) {
          setListening(null);
        } else {
          soundEngine.playMenuMove();
          onClose();
        }
      }
    };

    window.addEventListener('keydown', onKeyDown, true);
    return () => window.removeEventListener('keydown', onKeyDown, true);
  }, [listening, onClose]);

  // Gamepad polling loop: detects connected controllers, live button test, AND remapping capture (buttons + analog axes/triggers!)
  useEffect(() => {
    let rafId = 0;
    const prevIdleButtons: Record<number, boolean[]> = {};

    const poll = () => {
      const pads = readConnectedGamepads();
      const names = pads.map((p) => p.id);
      setPadNames((prev) =>
        prev.length === names.length && prev.every((v, idx) => v === names[idx]) ? prev : names
      );

      if (listening?.tab === 'gamepad') {
        let captured: GamepadBinding | null = null;
        for (const pad of pads) {
          const baseBtns = baselineButtonsRef.current[pad.index] ?? [];
          const baseAxes = baselineAxesRef.current[pad.index] ?? [];

          // 1. Prefer newly pressed buttons (including triggers reported as buttons 6/7)
          for (let i = 0; i < pad.buttons.length; i++) {
            const pressed = Boolean(pad.buttons[i]?.pressed) || (pad.buttons[i]?.value ?? 0) > 0.55;
            if (pressed && !baseBtns[i]) {
              captured = { type: 'button', index: i };
              break;
            }
            if (!pressed && baseBtns[i]) {
              baseBtns[i] = false;
            }
          }
          if (captured) break;

          // 2. Fallback: newly deflected axes (Android D-pad hat switches / analog trigger axes)
          for (let i = 0; i < pad.axes.length; i++) {
            const val = Number(pad.axes[i]) || 0;
            const base = baseAxes[i] ?? 0;
            if (Math.abs(val - base) > 0.6 && Math.abs(val) > 0.55) {
              captured = { type: 'axis', index: i, dir: val > base ? 1 : -1 };
              break;
            }
          }
          if (captured) break;
        }

        if (captured) {
          const cur = bindingsRef.current;
          const nextGp = { ...cur.gamepad };
          const prevBinding = nextGp[listening.action];
          (Object.keys(nextGp) as GamepadAction[]).forEach((act) => {
            if (act !== listening.action && areGamepadBindingsEqual(nextGp[act], captured!)) {
              nextGp[act] = { ...prevBinding };
            }
          });
          nextGp[listening.action] = captured;
          onChangeRef.current({ ...cur, gamepad: nextGp });
          setLastDetectedPadInput(formatGamepadBinding(captured));
          soundEngine.playMenuConfirm();
          setNavCooldownUntil(performance.now() + 420);
          setListening(null);
        }
      } else if (tab === 'gamepad') {
        // Live button tester when viewing the Gamepad tab
        for (const pad of pads) {
          const prevBtns = prevIdleButtons[pad.index] ?? [];
          const nextBtns: boolean[] = [];
          for (let i = 0; i < pad.buttons.length; i++) {
            const pressed = Boolean(pad.buttons[i]?.pressed) || (pad.buttons[i]?.value ?? 0) > 0.55;
            nextBtns[i] = pressed;
            if (pressed && !prevBtns[i]) {
              setLastDetectedPadInput(formatGamepadBinding({ type: 'button', index: i }));
            }
          }
          prevIdleButtons[pad.index] = nextBtns;
        }
      }

      rafId = requestAnimationFrame(poll);
    };

    rafId = requestAnimationFrame(poll);
    return () => cancelAnimationFrame(rafId);
  }, [listening, tab]);

  const handleResetTab = () => {
    soundEngine.playMenuMove();
    setListening(null);
    if (tab === 'p1') {
      onChange({ ...bindings, p1Keyboard: { ...DEFAULT_P1_KEYBOARD } });
    } else if (tab === 'p2') {
      onChange({ ...bindings, p2Keyboard: { ...DEFAULT_P2_KEYBOARD } });
    } else {
      onChange({
        ...bindings,
        gamepad: {
          up: { ...DEFAULT_GAMEPAD.up },
          down: { ...DEFAULT_GAMEPAD.down },
          left: { ...DEFAULT_GAMEPAD.left },
          right: { ...DEFAULT_GAMEPAD.right },
          melee: { ...DEFAULT_GAMEPAD.melee },
          jump: { ...DEFAULT_GAMEPAD.jump },
          shoot: { ...DEFAULT_GAMEPAD.shoot },
          swap: { ...DEFAULT_GAMEPAD.swap },
          pause: { ...DEFAULT_GAMEPAD.pause },
        },
      });
    }
  };

  const applyGamepadPreset = (preset: 'classic' | 'shooter') => {
    soundEngine.playMenuConfirm();
    setListening(null);
    const src = preset === 'shooter' ? GAMEPAD_PRESET_SHOOTER : DEFAULT_GAMEPAD;
    onChange({
      ...bindings,
      gamepad: {
        up: { ...src.up },
        down: { ...src.down },
        left: { ...src.left },
        right: { ...src.right },
        melee: { ...src.melee },
        jump: { ...src.jump },
        shoot: { ...src.shoot },
        swap: { ...src.swap },
        pause: { ...src.pause },
      },
    });
  };

  useGamepadMenuNav({
    enabled: listening === null,
    gamepadBindings: bindings.gamepad,
    cooldownUntil: navCooldownUntil,
    onActivity: () => setGpNavActive(true),
    onPrevTab: () => {
      soundEngine.playMenuMove();
      const order: TabId[] = ['p1', 'p2', 'gamepad'];
      setTab((cur) => order[(order.indexOf(cur) + order.length - 1) % order.length]);
    },
    onNextTab: () => {
      soundEngine.playMenuMove();
      const order: TabId[] = ['p1', 'p2', 'gamepad'];
      setTab((cur) => order[(order.indexOf(cur) + 1) % order.length]);
    },
    onUp: () => {
      soundEngine.playMenuMove();
      setFocusIdx((i) => (i + focusableIds.length - 1) % focusableIds.length);
    },
    onDown: () => {
      soundEngine.playMenuMove();
      setFocusIdx((i) => (i + 1) % focusableIds.length);
    },
    onLeft: () => {
      soundEngine.playMenuMove();
      setFocusIdx((i) => (i + focusableIds.length - 1) % focusableIds.length);
    },
    onRight: () => {
      soundEngine.playMenuMove();
      setFocusIdx((i) => (i + 1) % focusableIds.length);
    },
    onConfirm: () => {
      const id = focusableIds[safeFocusIdx];
      if (!id) return;
      if (id === 'preset:classic') {
        applyGamepadPreset('classic');
      } else if (id === 'preset:shooter') {
        applyGamepadPreset('shooter');
      } else if (id === 'reset') {
        handleResetTab();
      } else if (id === 'done') {
        soundEngine.playMenuConfirm();
        onClose();
      } else if (id.startsWith('act:')) {
        const action = id.slice(4);
        if (tab === 'p1') beginListening({ tab: 'p1', action: action as KeyboardAction });
        else if (tab === 'p2') beginListening({ tab: 'p2', action: action as Player2KeyboardAction });
        else beginListening({ tab: 'gamepad', action: action as GamepadAction });
      }
    },
    onBack: () => {
      soundEngine.playMenuMove();
      onClose();
    },
  });

  return (
    <div className="fixed inset-0 z-50 bg-[#090C11]/90 flex items-center justify-center p-2 sm:p-4 safe-area-inset">
      <div className="w-full max-w-2xl max-h-[94dvh] bg-[#121822] border-2 border-[#39FF14] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between gap-2 px-3 sm:px-5 py-2.5 sm:py-3 border-b border-[#242F40] bg-[#0D121A] shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <Gamepad2 className="w-5 h-5 text-[#39FF14] shrink-0" />
            <h2 className="font-display font-bold text-base sm:text-xl text-[#39FF14] tracking-wider truncate">
              НАЗНАЧЕНИЕ КНОПОК
            </h2>
          </div>
          <button
            type="button"
            onClick={() => {
              soundEngine.playMenuMove();
              onClose();
            }}
            aria-label="Закрыть настройки управления"
            className="p-1.5 text-[#94A3B8] hover:text-white border border-transparent hover:border-[#2B3648] cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Mode Tabs */}
        <div className="flex items-center gap-1.5 px-3 sm:px-5 py-2 border-b border-[#1E293B] bg-[#0F151F] shrink-0 overflow-x-auto">
          <button
            type="button"
            onClick={() => {
              soundEngine.playMenuMove();
              setListening(null);
              setTab('p1');
            }}
            className={`flex items-center gap-1.5 px-3 min-h-[36px] text-xs font-mono-num font-bold border transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
              tab === 'p1'
                ? 'bg-[#1F2D22] text-[#39FF14] border-[#39FF14]'
                : 'bg-[#141A24] text-[#94A3B8] border-[#2B3648] hover:text-white'
            }`}
          >
            <Keyboard className="w-3.5 h-3.5" />
            КЛАВИАТУРА P1
          </button>
          <button
            type="button"
            onClick={() => {
              soundEngine.playMenuMove();
              setListening(null);
              setTab('p2');
            }}
            className={`flex items-center gap-1.5 px-3 min-h-[36px] text-xs font-mono-num font-bold border transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
              tab === 'p2'
                ? 'bg-[#10272E] text-[#00E5FF] border-[#00E5FF]'
                : 'bg-[#141A24] text-[#94A3B8] border-[#2B3648] hover:text-white'
            }`}
          >
            <Keyboard className="w-3.5 h-3.5" />
            КЛАВИАТУРА P2
          </button>
          <button
            type="button"
            onClick={() => {
              soundEngine.playMenuMove();
              setListening(null);
              setTab('gamepad');
            }}
            className={`flex items-center gap-1.5 px-3 min-h-[36px] text-xs font-mono-num font-bold border transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
              tab === 'gamepad'
                ? 'bg-[#2E2410] text-[#FFB000] border-[#FFB000]'
                : 'bg-[#141A24] text-[#94A3B8] border-[#2B3648] hover:text-white'
            }`}
          >
            <Gamepad2 className="w-3.5 h-3.5" />
            ДЖОЙСТИК / ANDROID {padNames.length > 0 ? `(${padNames.length})` : ''}
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="flex-1 min-h-0 overflow-y-auto px-3 sm:px-5 py-3 flex flex-col gap-3">
          {/* Active Listening Banner */}
          {listening && (
            <div className="flex items-center justify-between gap-2 bg-[#2E2410] border border-[#FFB000] px-3 py-2 text-xs font-mono-num text-[#FDE68A]">
              <span>
                {listening.tab === 'gamepad'
                  ? `Нажмите кнопку, триггер или крестовину на геймпаде для «${ACTION_META[listening.action].label}»...`
                  : `Нажмите новую клавишу на клавиатуре для «${ACTION_META[listening.action].label}»...`}
              </span>
              <button
                type="button"
                onClick={() => setListening(null)}
                className="px-2.5 py-1 bg-[#141A24] border border-[#FFB000] text-white text-[11px] font-bold cursor-pointer shrink-0"
              >
                ОТМЕНА
              </button>
            </div>
          )}

          {/* Gamepad Status & Quick Presets */}
          {tab === 'gamepad' && (
            <div className="bg-[#090C11] border border-[#242F40] p-2.5 sm:p-3 flex flex-col gap-2">
              <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] sm:text-xs font-mono-num">
                <div className="text-[#CBD5E1] min-w-0 truncate">
                  {padNames.length > 0 ? (
                    <>
                      <span className="text-[#39FF14] font-bold">ПОДКЛЮЧЁН: </span>
                      <span>{padNames[0]}</span>
                    </>
                  ) : (
                    <span className="text-[#94A3B8]">
                      Подключите Bluetooth/USB-джойстик и нажмите на нём любую кнопку для активации
                    </span>
                  )}
                </div>
                {lastDetectedPadInput && (
                  <span className="px-2 py-0.5 bg-[#10272E] border border-[#00E5FF] text-[#00E5FF] text-[10px] shrink-0">
                    НАЖАТО: {lastDetectedPadInput}
                  </span>
                )}
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 pt-1.5 border-t border-[#1E293B]">
                <span className="text-[11px] text-[#94A3B8] font-mono-num">
                  Левый стик всегда работает · Быстрые пресеты:
                </span>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => applyGamepadPreset('classic')}
                    className={`px-2.5 py-1 bg-[#141A24] border border-[#2B3648] hover:border-[#39FF14] text-[11px] font-mono-num text-[#E6EDF3] cursor-pointer ${focusRing('preset:classic')}`}
                  >
                    SEGA КЛАССИКА (B Огонь)
                  </button>
                  <button
                    type="button"
                    onClick={() => applyGamepadPreset('shooter')}
                    className={`px-2.5 py-1 bg-[#141A24] border border-[#2B3648] hover:border-[#FFB000] text-[11px] font-mono-num text-[#FFB000] cursor-pointer ${focusRing('preset:shooter')}`}
                  >
                    ШУТЕР (RT/R2 Огонь)
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Action Bindings Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 sm:gap-2">
            {tab === 'p1' &&
              P1_ACTIONS.map((action) => {
                const isWaiting = listening?.tab === 'p1' && listening.action === action;
                return (
                  <button
                    key={action}
                    type="button"
                    onClick={() => beginListening({ tab: 'p1', action })}
                    className={`flex items-center justify-between gap-2 px-3 min-h-[42px] py-2 border text-left transition-colors cursor-pointer ${
                      isWaiting
                        ? 'bg-[#2E2410] border-[#FFB000]'
                        : 'bg-[#0D121A] border-[#242F40] hover:border-[#39FF14]'
                    } ${focusRing(`act:${action}`)}`}
                  >
                    <span className="text-xs font-medium text-[#E6EDF3]">
                      {ACTION_META[action].label}
                    </span>
                    <span
                      className={`px-2.5 py-1 text-xs font-mono-num font-bold border ${
                        isWaiting
                          ? 'bg-[#FFB000] text-[#090C11] border-[#FFB000]'
                          : 'bg-[#141A24] text-[#39FF14] border-[#2B3648]'
                      }`}
                    >
                      {isWaiting ? 'НАЖМИТЕ...' : formatKeyCode(bindings.p1Keyboard[action])}
                    </span>
                  </button>
                );
              })}

            {tab === 'p2' &&
              P2_ACTIONS.map((action) => {
                const isWaiting = listening?.tab === 'p2' && listening.action === action;
                return (
                  <button
                    key={action}
                    type="button"
                    onClick={() => beginListening({ tab: 'p2', action })}
                    className={`flex items-center justify-between gap-2 px-3 min-h-[42px] py-2 border text-left transition-colors cursor-pointer ${
                      isWaiting
                        ? 'bg-[#2E2410] border-[#FFB000]'
                        : 'bg-[#0D121A] border-[#242F40] hover:border-[#00E5FF]'
                    } ${focusRing(`act:${action}`)}`}
                  >
                    <span className="text-xs font-medium text-[#E6EDF3]">
                      {ACTION_META[action].label}
                    </span>
                    <span
                      className={`px-2.5 py-1 text-xs font-mono-num font-bold border ${
                        isWaiting
                          ? 'bg-[#FFB000] text-[#090C11] border-[#FFB000]'
                          : 'bg-[#141A24] text-[#00E5FF] border-[#2B3648]'
                      }`}
                    >
                      {isWaiting ? 'НАЖМИТЕ...' : formatKeyCode(bindings.p2Keyboard[action])}
                    </span>
                  </button>
                );
              })}

            {tab === 'gamepad' &&
              GP_ACTIONS.map((action) => {
                const isWaiting = listening?.tab === 'gamepad' && listening.action === action;
                return (
                  <button
                    key={action}
                    type="button"
                    onClick={() => beginListening({ tab: 'gamepad', action })}
                    className={`flex items-center justify-between gap-2 px-3 min-h-[42px] py-2 border text-left transition-colors cursor-pointer ${
                      isWaiting
                        ? 'bg-[#2E2410] border-[#FFB000]'
                        : 'bg-[#0D121A] border-[#242F40] hover:border-[#FFB000]'
                    } ${focusRing(`act:${action}`)}`}
                  >
                    <span className="text-xs font-medium text-[#E6EDF3]">
                      {ACTION_META[action].label}
                    </span>
                    <span
                      className={`px-2.5 py-1 text-xs font-mono-num font-bold border ${
                        isWaiting
                          ? 'bg-[#FFB000] text-[#090C11] border-[#FFB000]'
                          : 'bg-[#141A24] text-[#FFB000] border-[#2B3648]'
                      }`}
                    >
                      {isWaiting ? 'НАЖМИТЕ...' : formatGamepadBinding(bindings.gamepad[action])}
                    </span>
                  </button>
                );
              })}
          </div>

          <p className="text-[11px] font-mono-num text-[#94A3B8]">
            {tab === 'gamepad'
              ? 'Поддерживаются кнопки, триггеры (LT/RT/L2/R2) и крестовины любых Bluetooth/USB-геймпадов на ПК и Android. LB/RB меняют вкладки, B/○ закрывает окно.'
              : 'Нажмите на строку действия, затем нажмите нужную клавишу. Дубликаты внутри одного игрока меняются местами автоматически. ESC всегда открывает паузу.'}
          </p>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-2 px-3 sm:px-5 py-2.5 border-t border-[#242F40] bg-[#0D121A] shrink-0">
          <button
            type="button"
            onClick={handleResetTab}
            className={`flex items-center gap-1.5 px-3 min-h-[40px] bg-[#141A24] border border-[#2B3648] hover:border-[#FF2A85] text-xs font-mono-num text-[#CBD5E1] hover:text-white cursor-pointer ${focusRing('reset')}`}
          >
            <RotateCcw className="w-3.5 h-3.5" />
            СБРОСИТЬ ВКЛАДКУ
          </button>

          <button
            type="button"
            onClick={() => {
              soundEngine.playMenuConfirm();
              onClose();
            }}
            className={`px-6 min-h-[40px] bg-[#39FF14] hover:bg-[#57FF38] text-[#090C11] font-display font-bold text-sm tracking-widest cursor-pointer ${focusRing('done')}`}
          >
            ГОТОВО
          </button>
        </div>
      </div>
    </div>
  );
}
