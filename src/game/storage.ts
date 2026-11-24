import { DEFAULT_CONTROL_BINDINGS, DEFAULT_GAMEPAD, normalizeControlBindings } from './controls';
import { DifficultyId, LevelId, SaveData, TouchControlsMode } from './types';

const STORAGE_KEY = 'green_beer_pizedes_save_v1';
const GAMEPAD_LAYOUT_VERSION = 2;

type StoredSaveData = SaveData & { gamepadLayoutVersion?: number };

function detectInitialTouchDevice(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    window.matchMedia?.('(pointer: coarse)').matches ||
    (typeof navigator !== 'undefined' && navigator.maxTouchPoints > 0) ||
    'ontouchstart' in window
  );
}

const DEFAULT_SAVE: SaveData = {
  unlockedLevel: 6, // All 6 levels selectable per user preference, tracks progress & high score
  highScore: 0,
  difficulty: 'normal',
  friendlyFire: false,
  crtScanlines: !detectInitialTouchDevice(),
  touchControlsMode: 'auto',
  controls: normalizeControlBindings(DEFAULT_CONTROL_BINDINGS),
};

export function loadSaveData(): SaveData {
  const defaultCrt = !detectInitialTouchDevice();
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return {
        ...DEFAULT_SAVE,
        crtScanlines: defaultCrt,
        controls: normalizeControlBindings(DEFAULT_CONTROL_BINDINGS),
      };
    }
    const parsed = JSON.parse(raw) as Partial<StoredSaveData>;
    const validTouchMode: TouchControlsMode =
      parsed.touchControlsMode === 'on' || parsed.touchControlsMode === 'off' || parsed.touchControlsMode === 'auto'
        ? parsed.touchControlsMode
        : 'auto';
    const validDifficulty: DifficultyId =
      parsed.difficulty === 'easy' || parsed.difficulty === 'normal' || parsed.difficulty === 'hard'
        ? parsed.difficulty
        : 'normal';
    const normalizedControls = normalizeControlBindings(parsed.controls);
    const controls =
      parsed.gamepadLayoutVersion === GAMEPAD_LAYOUT_VERSION
        ? normalizedControls
        : {
            ...normalizedControls,
            gamepad: normalizeControlBindings({ gamepad: DEFAULT_GAMEPAD }).gamepad,
          };
    const loaded: SaveData = {
      unlockedLevel: (parsed.unlockedLevel && parsed.unlockedLevel >= 1 && parsed.unlockedLevel <= 6
        ? parsed.unlockedLevel
        : 6) as LevelId,
      highScore: typeof parsed.highScore === 'number' && parsed.highScore >= 0 ? parsed.highScore : 0,
      difficulty: validDifficulty,
      friendlyFire: Boolean(parsed.friendlyFire),
      crtScanlines: parsed.crtScanlines !== undefined ? Boolean(parsed.crtScanlines) : defaultCrt,
      touchControlsMode: validTouchMode,
      controls,
    };
    if (parsed.gamepadLayoutVersion !== GAMEPAD_LAYOUT_VERSION) {
      try {
        window.localStorage.setItem(
          STORAGE_KEY,
          JSON.stringify({ ...loaded, gamepadLayoutVersion: GAMEPAD_LAYOUT_VERSION })
        );
      } catch {
        // Ignore quota/sandbox errors
      }
    }
    return loaded;
  } catch {
    return {
      ...DEFAULT_SAVE,
      crtScanlines: defaultCrt,
      controls: normalizeControlBindings(DEFAULT_CONTROL_BINDINGS),
    };
  }
}

export function saveProgress(partial: Partial<SaveData>): SaveData {
  const current = loadSaveData();
  const next: SaveData = {
    ...current,
    ...partial,
    controls: partial.controls ? normalizeControlBindings(partial.controls) : current.controls,
    highScore: Math.max(current.highScore, partial.highScore ?? 0),
  };
  try {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ ...next, gamepadLayoutVersion: GAMEPAD_LAYOUT_VERSION })
    );
  } catch {
    // Ignore quota/sandbox errors
  }
  return next;
}
