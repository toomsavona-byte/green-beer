import { useEffect, useState } from 'react';
import { TouchControlsMode } from '../game/types';

export interface PlatformInfo {
  isTouchDevice: boolean;
  isCompactViewport: boolean;
  isPortrait: boolean;
  gamepadCount: number;
  showTouchControls: boolean;
  recommendedRenderScale: number;
}

function readIsTouch(): boolean {
  if (typeof window === 'undefined') return false;
  return Boolean(
    window.matchMedia?.('(pointer: coarse)').matches ||
      (typeof navigator !== 'undefined' && navigator.maxTouchPoints > 0) ||
      'ontouchstart' in window
  );
}

function countConnectedGamepads(): number {
  if (typeof navigator === 'undefined' || !navigator.getGamepads) return 0;
  try {
    const pads = navigator.getGamepads();
    let count = 0;
    for (let i = 0; i < pads.length; i++) {
      if (pads[i]?.connected) count++;
    }
    return count;
  } catch {
    return 0;
  }
}

export function usePlatform(touchMode: TouchControlsMode): PlatformInfo {
  const [state, setState] = useState(() => ({
    isTouchDevice: readIsTouch(),
    isCompactViewport: typeof window !== 'undefined' ? window.innerWidth < 900 : false,
    isPortrait: typeof window !== 'undefined' ? window.innerHeight > window.innerWidth : false,
    gamepadCount: countConnectedGamepads(),
  }));

  useEffect(() => {
    const update = () => {
      setState((prev) => ({
        ...prev,
        isTouchDevice: readIsTouch(),
        isCompactViewport: window.innerWidth < 900,
        isPortrait: window.innerHeight > window.innerWidth,
        gamepadCount: countConnectedGamepads(),
      }));
    };

    const onFirstTouch = () => {
      setState((prev) => (prev.isTouchDevice ? prev : { ...prev, isTouchDevice: true }));
    };

    const onGamepadChange = () => {
      setState((prev) => ({ ...prev, gamepadCount: countConnectedGamepads() }));
    };

    window.addEventListener('resize', update);
    window.addEventListener('orientationchange', update);
    window.addEventListener('touchstart', onFirstTouch, { passive: true, once: true });
    window.addEventListener('gamepadconnected', onGamepadChange);
    window.addEventListener('gamepaddisconnected', onGamepadChange);

    return () => {
      window.removeEventListener('resize', update);
      window.removeEventListener('orientationchange', update);
      window.removeEventListener('touchstart', onFirstTouch);
      window.removeEventListener('gamepadconnected', onGamepadChange);
      window.removeEventListener('gamepaddisconnected', onGamepadChange);
    };
  }, []);

  const showTouchControls =
    touchMode === 'on' ? true : touchMode === 'off' ? false : state.isTouchDevice;

  // Use 1.5x HD scale on touch/mobile devices to keep 60 FPS and low thermal load, 2x HD on desktop
  const recommendedRenderScale = state.isTouchDevice || state.isCompactViewport ? 1.5 : 2;

  return {
    ...state,
    showTouchControls,
    recommendedRenderScale,
  };
}
