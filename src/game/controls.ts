export type KeyboardAction =
  | 'up'
  | 'down'
  | 'left'
  | 'right'
  | 'melee'
  | 'jump'
  | 'shoot'
  | 'swap'
  | 'pause';

export type Player2KeyboardAction =
  | 'up'
  | 'down'
  | 'left'
  | 'right'
  | 'melee'
  | 'jump'
  | 'shoot'
  | 'swap';

export type GamepadAction =
  | 'up'
  | 'down'
  | 'left'
  | 'right'
  | 'melee'
  | 'jump'
  | 'shoot'
  | 'swap'
  | 'pause';

export type KeyboardControlMap = Record<KeyboardAction, string>;
export type Player2KeyboardControlMap = Record<Player2KeyboardAction, string>;

export type GamepadBinding =
  | { type: 'button'; index: number }
  | { type: 'axis'; index: number; dir: 1 | -1 };

export type GamepadControlMap = Record<GamepadAction, GamepadBinding>;

export interface ControlBindings {
  p1Keyboard: KeyboardControlMap;
  p2Keyboard: Player2KeyboardControlMap;
  gamepad: GamepadControlMap;
}

export const DEFAULT_P1_KEYBOARD: KeyboardControlMap = {
  up: 'KeyW',
  down: 'KeyS',
  left: 'KeyA',
  right: 'KeyD',
  melee: 'KeyJ',
  jump: 'KeyK',
  shoot: 'KeyL',
  swap: 'KeyI',
  pause: 'KeyP',
};

export const DEFAULT_P2_KEYBOARD: Player2KeyboardControlMap = {
  up: 'ArrowUp',
  down: 'ArrowDown',
  left: 'ArrowLeft',
  right: 'ArrowRight',
  melee: 'Numpad1',
  jump: 'Numpad2',
  shoot: 'Numpad3',
  swap: 'Numpad4',
};

export const DEFAULT_GAMEPAD: GamepadControlMap = {
  up: { type: 'button', index: 12 },
  down: { type: 'button', index: 13 },
  left: { type: 'button', index: 14 },
  right: { type: 'button', index: 15 },
  jump: { type: 'button', index: 0 },
  shoot: { type: 'button', index: 1 },
  melee: { type: 'button', index: 2 },
  swap: { type: 'button', index: 3 },
  pause: { type: 'button', index: 9 },
};

export const GAMEPAD_PRESET_SHOOTER: GamepadControlMap = {
  ...DEFAULT_GAMEPAD,
  jump: { type: 'button', index: 0 }, // A / ✕
  melee: { type: 'button', index: 2 }, // X / □
  shoot: { type: 'button', index: 7 }, // RT / R2
  swap: { type: 'button', index: 3 }, // Y / △
  pause: { type: 'button', index: 9 }, // START
};

export const DEFAULT_CONTROL_BINDINGS: ControlBindings = {
  p1Keyboard: { ...DEFAULT_P1_KEYBOARD },
  p2Keyboard: { ...DEFAULT_P2_KEYBOARD },
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
};

function isValidGamepadBinding(val: unknown): val is GamepadBinding {
  if (!val || typeof val !== 'object') return false;
  const obj = val as Record<string, unknown>;
  if (obj.type === 'button') {
    return typeof obj.index === 'number' && Number.isInteger(obj.index) && obj.index >= 0 && obj.index <= 64;
  }
  if (obj.type === 'axis') {
    return (
      typeof obj.index === 'number' &&
      Number.isInteger(obj.index) &&
      obj.index >= 0 &&
      obj.index <= 16 &&
      (obj.dir === 1 || obj.dir === -1)
    );
  }
  return false;
}

export function normalizeControlBindings(raw: unknown): ControlBindings {
  const src = raw && typeof raw === 'object' ? (raw as Partial<ControlBindings>) : {};
  const p1Raw = src.p1Keyboard && typeof src.p1Keyboard === 'object' ? src.p1Keyboard : {};
  const p2Raw = src.p2Keyboard && typeof src.p2Keyboard === 'object' ? src.p2Keyboard : {};
  const gpRaw = src.gamepad && typeof src.gamepad === 'object' ? src.gamepad : {};

  const p1Keyboard: KeyboardControlMap = { ...DEFAULT_P1_KEYBOARD };
  (Object.keys(DEFAULT_P1_KEYBOARD) as KeyboardAction[]).forEach((k) => {
    const v = (p1Raw as Record<string, unknown>)[k];
    if (typeof v === 'string' && v.length > 0 && v.length <= 32) {
      p1Keyboard[k] = v;
    }
  });

  const p2Keyboard: Player2KeyboardControlMap = { ...DEFAULT_P2_KEYBOARD };
  (Object.keys(DEFAULT_P2_KEYBOARD) as Player2KeyboardAction[]).forEach((k) => {
    const v = (p2Raw as Record<string, unknown>)[k];
    if (typeof v === 'string' && v.length > 0 && v.length <= 32) {
      p2Keyboard[k] = v;
    }
  });

  const gamepad: GamepadControlMap = {
    up: { ...DEFAULT_GAMEPAD.up },
    down: { ...DEFAULT_GAMEPAD.down },
    left: { ...DEFAULT_GAMEPAD.left },
    right: { ...DEFAULT_GAMEPAD.right },
    melee: { ...DEFAULT_GAMEPAD.melee },
    jump: { ...DEFAULT_GAMEPAD.jump },
    shoot: { ...DEFAULT_GAMEPAD.shoot },
    swap: { ...DEFAULT_GAMEPAD.swap },
    pause: { ...DEFAULT_GAMEPAD.pause },
  };
  (Object.keys(DEFAULT_GAMEPAD) as GamepadAction[]).forEach((k) => {
    const v = (gpRaw as Record<string, unknown>)[k];
    if (isValidGamepadBinding(v)) {
      gamepad[k] = { ...v };
    }
  });

  return { p1Keyboard, p2Keyboard, gamepad };
}

export function getGamepadBindingKey(binding: GamepadBinding): string {
  return binding.type === 'button'
    ? `b:${binding.index}`
    : `a:${binding.index}:${binding.dir > 0 ? '+' : '-'}`;
}

export function areGamepadBindingsEqual(a: GamepadBinding, b: GamepadBinding): boolean {
  return getGamepadBindingKey(a) === getGamepadBindingKey(b);
}

export function isGamepadBindingActive(pad: Gamepad | undefined, binding: GamepadBinding): boolean {
  if (!pad) return false;
  if (binding.type === 'button') {
    const btn = pad.buttons[binding.index];
    if (!btn) return false;
    return Boolean(btn.pressed) || btn.value > 0.45;
  }
  const axisVal = pad.axes[binding.index];
  if (typeof axisVal !== 'number') return false;
  return binding.dir === 1 ? axisVal > 0.5 : axisVal < -0.5;
}

const KEY_LABELS: Record<string, string> = {
  ArrowUp: '↑',
  ArrowDown: '↓',
  ArrowLeft: '←',
  ArrowRight: '→',
  Space: 'SPACE',
  Enter: 'ENTER',
  NumpadEnter: 'NUM ENTER',
  Escape: 'ESC',
  ShiftLeft: 'L-SHIFT',
  ShiftRight: 'R-SHIFT',
  ControlLeft: 'L-CTRL',
  ControlRight: 'R-CTRL',
  AltLeft: 'L-ALT',
  AltRight: 'R-ALT',
  Tab: 'TAB',
  Backspace: 'BKSP',
  Semicolon: ';',
  Quote: "'",
  Slash: '/',
  Period: '.',
  Comma: ',',
  BracketLeft: '[',
  BracketRight: ']',
  Backslash: '\\',
  Minus: '-',
  Equal: '=',
  Backquote: '`',
};

export function formatKeyCode(code: string): string {
  if (KEY_LABELS[code]) return KEY_LABELS[code];
  if (code.startsWith('Key') && code.length === 4) return code.slice(3);
  if (code.startsWith('Digit') && code.length === 6) return code.slice(5);
  if (code.startsWith('Numpad')) return `NUM ${code.slice(6)}`;
  return code.toUpperCase();
}

const GAMEPAD_BUTTON_LABELS: Record<number, string> = {
  0: 'A / ✕',
  1: 'B / ○',
  2: 'X / □',
  3: 'Y / △',
  4: 'LB / L1',
  5: 'RB / R1',
  6: 'LT / L2',
  7: 'RT / R2',
  8: 'BACK / SHARE',
  9: 'START / OPT',
  10: 'L3',
  11: 'R3',
  12: 'D-PAD ↑',
  13: 'D-PAD ↓',
  14: 'D-PAD ←',
  15: 'D-PAD →',
  16: 'HOME',
};

export function formatGamepadBinding(binding: GamepadBinding): string {
  if (binding.type === 'button') {
    return GAMEPAD_BUTTON_LABELS[binding.index] ?? `BTN ${binding.index}`;
  }
  return `ОСЬ ${binding.index} ${binding.dir > 0 ? '+' : '−'}`;
}

export const ACTION_META: Record<
  KeyboardAction,
  { label: string; group: 'move' | 'combat' }
> = {
  up: { label: 'Вверх', group: 'move' },
  down: { label: 'Вниз', group: 'move' },
  left: { label: 'Влево', group: 'move' },
  right: { label: 'Вправо', group: 'move' },
  melee: { label: 'Удар (ближний)', group: 'combat' },
  jump: { label: 'Прыжок', group: 'combat' },
  shoot: { label: 'Огонь (стрельба)', group: 'combat' },
  swap: { label: 'Смена оружия', group: 'combat' },
  pause: { label: 'Пауза', group: 'combat' },
};
