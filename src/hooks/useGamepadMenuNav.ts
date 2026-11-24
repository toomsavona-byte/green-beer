import { useEffect, useRef } from 'react';
import { DEFAULT_GAMEPAD, GamepadControlMap, isGamepadBindingActive } from '../game/controls';

export interface UseGamepadMenuNavOptions {
  enabled: boolean;
  gamepadBindings?: GamepadControlMap;
  /** Undefined = listen to all connected pads; 0 or 1 = specific connected pad slot */
  padIndex?: number;
  /** Optional extra delay in ms before accepting presses (e.g. after remapping capture) */
  cooldownUntil?: number;
  onUp?: () => void;
  onDown?: () => void;
  onLeft?: () => void;
  onRight?: () => void;
  onConfirm?: () => void;
  onBack?: () => void;
  onStart?: () => void;
  onAlt?: () => void;
  onPrevTab?: () => void;
  onNextTab?: () => void;
  onActivity?: () => void;
}

type DirKey = 'up' | 'down' | 'left' | 'right';
type BtnKey = 'confirm' | 'back' | 'start' | 'alt' | 'prevTab' | 'nextTab';

interface PadSnapshot {
  up: boolean;
  down: boolean;
  left: boolean;
  right: boolean;
  confirm: boolean;
  back: boolean;
  start: boolean;
  alt: boolean;
  prevTab: boolean;
  nextTab: boolean;
}

const INITIAL_REPEAT_MS = 320;
const REPEAT_INTERVAL_MS = 145;
const MOUNT_GRACE_MS = 170;

function isBtnPressed(pad: Gamepad, idx: number): boolean {
  const b = pad.buttons[idx];
  if (!b) return false;
  return Boolean(b.pressed) || b.value > 0.5;
}

function getConnectedPads(): Gamepad[] {
  if (typeof navigator === 'undefined' || !navigator.getGamepads) return [];
  try {
    const raw = navigator.getGamepads();
    const out: Gamepad[] = [];
    for (let i = 0; i < raw.length; i++) {
      const gp = raw[i];
      if (gp && gp.connected) out.push(gp);
    }
    return out;
  } catch {
    return [];
  }
}

function readSnapshot(pads: Gamepad[], gpMap: GamepadControlMap, padIndex?: number): PadSnapshot {
  const snap: PadSnapshot = {
    up: false,
    down: false,
    left: false,
    right: false,
    confirm: false,
    back: false,
    start: false,
    alt: false,
    prevTab: false,
    nextTab: false,
  };

  const targets = padIndex === undefined ? pads : pads[padIndex] ? [pads[padIndex]] : [];

  for (const pad of targets) {
    const ax = Number(pad.axes[0]) || 0;
    const ay = Number(pad.axes[1]) || 0;

    // Support Left Stick + Standard D-Pad (12..15) + Custom mapped D-Pad / Android hat axes
    if (ay < -0.52 || isBtnPressed(pad, 12) || isGamepadBindingActive(pad, gpMap.up)) snap.up = true;
    if (ay > 0.52 || isBtnPressed(pad, 13) || isGamepadBindingActive(pad, gpMap.down)) snap.down = true;
    if (ax < -0.52 || isBtnPressed(pad, 14) || isGamepadBindingActive(pad, gpMap.left)) snap.left = true;
    if (ax > 0.52 || isBtnPressed(pad, 15) || isGamepadBindingActive(pad, gpMap.right)) snap.right = true;

    // Universal console/Android menu buttons:
    // A / ✕ (0) = Confirm, B / ○ (1) = Back, X/□ (2) or Y/△ (3) = Alt, LB (4) / RB (5) = Tabs, START (9) or mapped pause = Start
    if (isBtnPressed(pad, 0)) snap.confirm = true;
    if (isBtnPressed(pad, 1)) snap.back = true;
    if (isBtnPressed(pad, 9) || isGamepadBindingActive(pad, gpMap.pause)) snap.start = true;
    if (isBtnPressed(pad, 2) || isBtnPressed(pad, 3)) snap.alt = true;
    if (isBtnPressed(pad, 4)) snap.prevTab = true;
    if (isBtnPressed(pad, 5)) snap.nextTab = true;
  }

  return snap;
}

/**
 * Reusable Gamepad / Android Bluetooth & USB joystick menu navigation hook.
 * Handles edge-triggered buttons, repeat-delayed directions, and mount grace period
 * so screen transitions never double-trigger actions.
 */
export function useGamepadMenuNav(options: UseGamepadMenuNavOptions): void {
  const optsRef = useRef(options);
  optsRef.current = options;

  useEffect(() => {
    if (!options.enabled) return;

    const gpMap = optsRef.current.gamepadBindings ?? DEFAULT_GAMEPAD;
    const enabledAt = performance.now();

    // Initialize prev snapshot from LIVE pad state so held buttons from previous screen never misfire
    let prev = readSnapshot(getConnectedPads(), gpMap, optsRef.current.padIndex);
    const dirNextRepeat: Record<DirKey, number> = {
      up: 0,
      down: 0,
      left: 0,
      right: 0,
    };

    let rafId = 0;

    const poll = (now: number) => {
      const o = optsRef.current;
      const bindings = o.gamepadBindings ?? DEFAULT_GAMEPAD;
      const cur = readSnapshot(getConnectedPads(), bindings, o.padIndex);

      const inGrace =
        now - enabledAt < MOUNT_GRACE_MS ||
        (o.cooldownUntil !== undefined && now < o.cooldownUntil);

      if (!inGrace) {
        // Directional inputs with initial delay + smooth repeat
        const dirs: Array<{ key: DirKey; cb?: () => void }> = [
          { key: 'up', cb: o.onUp },
          { key: 'down', cb: o.onDown },
          { key: 'left', cb: o.onLeft },
          { key: 'right', cb: o.onRight },
        ];

        for (const d of dirs) {
          const active = cur[d.key];
          const wasActive = prev[d.key];
          if (active && !wasActive) {
            dirNextRepeat[d.key] = now + INITIAL_REPEAT_MS;
            o.onActivity?.();
            d.cb?.();
          } else if (active && wasActive && dirNextRepeat[d.key] > 0 && now >= dirNextRepeat[d.key]) {
            dirNextRepeat[d.key] = now + REPEAT_INTERVAL_MS;
            o.onActivity?.();
            d.cb?.();
          } else if (!active) {
            dirNextRepeat[d.key] = 0;
          }
        }

        // Edge-triggered action buttons
        const btns: Array<{ key: BtnKey; cb?: () => void }> = [
          { key: 'confirm', cb: o.onConfirm },
          { key: 'back', cb: o.onBack },
          { key: 'start', cb: o.onStart },
          { key: 'alt', cb: o.onAlt },
          { key: 'prevTab', cb: o.onPrevTab },
          { key: 'nextTab', cb: o.onNextTab },
        ];

        for (const b of btns) {
          if (cur[b.key] && !prev[b.key]) {
            o.onActivity?.();
            b.cb?.();
            break; // One button action per frame to prevent simultaneous confirm+back collisions
          }
        }
      }

      prev = cur;
      rafId = requestAnimationFrame(poll);
    };

    rafId = requestAnimationFrame(poll);
    return () => cancelAnimationFrame(rafId);
  }, [options.enabled, options.padIndex]);
}
