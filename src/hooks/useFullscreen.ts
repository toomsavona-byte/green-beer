import { useCallback, useEffect, useState } from 'react';

interface WebkitDocument extends Document {
  webkitFullscreenElement?: Element | null;
  webkitFullscreenEnabled?: boolean;
  webkitExitFullscreen?: () => Promise<void> | void;
}

interface WebkitElement extends HTMLElement {
  webkitRequestFullscreen?: () => Promise<void> | void;
}

interface NavigatorWithStandalone extends Navigator {
  standalone?: boolean;
}

function detectStandaloneApp(): boolean {
  if (typeof window === 'undefined') return false;
  const win = window as unknown as {
    Capacitor?: { isNativePlatform?: () => boolean };
  };
  if (win.Capacitor?.isNativePlatform?.()) return true;
  if (window.matchMedia?.('(display-mode: standalone)').matches) return true;
  if (window.matchMedia?.('(display-mode: fullscreen)').matches) return true;
  if ((navigator as NavigatorWithStandalone).standalone === true) return true;
  return false;
}

function detectIOS(): boolean {
  if (typeof navigator === 'undefined') return false;
  return (
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  );
}

function getFullscreenElement(): Element | null {
  if (typeof document === 'undefined') return null;
  const doc = document as WebkitDocument;
  return doc.fullscreenElement ?? doc.webkitFullscreenElement ?? null;
}

function detectNativeFullscreenSupport(): boolean {
  if (typeof document === 'undefined') return false;
  const doc = document as WebkitDocument;
  const root = document.documentElement as WebkitElement;
  const hasMethod =
    typeof root.requestFullscreen === 'function' ||
    typeof root.webkitRequestFullscreen === 'function';
  if (!hasMethod) return false;
  if (doc.fullscreenEnabled === false && doc.webkitFullscreenEnabled !== true) {
    return false;
  }
  return true;
}

export interface FullscreenController {
  isFullscreen: boolean;
  isStandaloneApp: boolean;
  isIOS: boolean;
  isNativeSupported: boolean;
  canShowButton: boolean;
  iosGuideOpen: boolean;
  toggleFullscreen: () => Promise<void>;
  closeIosGuide: () => void;
}

export function useFullscreen(isTouchDevice: boolean): FullscreenController {
  const [isFullscreen, setIsFullscreen] = useState<boolean>(() => Boolean(getFullscreenElement()));
  const [isStandaloneApp, setIsStandaloneApp] = useState<boolean>(() => detectStandaloneApp());
  const [iosGuideOpen, setIosGuideOpen] = useState<boolean>(false);

  const isIOS = detectIOS();
  const isNativeSupported = detectNativeFullscreenSupport();

  useEffect(() => {
    const sync = () => {
      setIsFullscreen(Boolean(getFullscreenElement()));
    };
    const syncStandalone = () => {
      setIsStandaloneApp(detectStandaloneApp());
    };

    document.addEventListener('fullscreenchange', sync);
    document.addEventListener('webkitfullscreenchange', sync);
    const mqStandalone = window.matchMedia?.('(display-mode: standalone)');
    mqStandalone?.addEventListener?.('change', syncStandalone);

    return () => {
      document.removeEventListener('fullscreenchange', sync);
      document.removeEventListener('webkitfullscreenchange', sync);
      mqStandalone?.removeEventListener?.('change', syncStandalone);
    };
  }, []);

  const toggleFullscreen = useCallback(async () => {
    const doc = document as WebkitDocument;
    const root = document.documentElement as WebkitElement;

    if (getFullscreenElement()) {
      try {
        if (doc.exitFullscreen) {
          await doc.exitFullscreen();
        } else if (doc.webkitExitFullscreen) {
          await doc.webkitExitFullscreen();
        }
      } catch {
        // Ignore browser exit errors
      }
      setIsFullscreen(Boolean(getFullscreenElement()));
      return;
    }

    if (isNativeSupported) {
      try {
        if (root.requestFullscreen) {
          await root.requestFullscreen({ navigationUI: 'hide' } as FullscreenOptions);
        } else if (root.webkitRequestFullscreen) {
          await root.webkitRequestFullscreen();
        }
        setIsFullscreen(true);
        // On mobile browsers, also lock landscape cleanly after entering fullscreen
        if (isTouchDevice) {
          const orientation = window.screen?.orientation as ScreenOrientation & {
            lock?: (o: string) => Promise<void>;
          };
          orientation?.lock?.('landscape').catch(() => {});
        }
        return;
      } catch {
        // Fall through to iOS guide if iOS Safari blocks requestFullscreen
      }
    }

    // iPhone Safari does not allow DOM requestFullscreen(): collapse address bar & show quick PWA fullscreen guide
    if (isIOS) {
      try {
        window.scrollTo(0, 1);
      } catch {
        // Ignore
      }
      setIosGuideOpen(true);
    }
  }, [isIOS, isNativeSupported, isTouchDevice]);

  const closeIosGuide = useCallback(() => {
    setIosGuideOpen(false);
  }, []);

  // Show button in all regular browser tabs (Desktop, Android Chrome, iPad & iPhone Safari), hide in APK / installed PWA
  const canShowButton = !isStandaloneApp && (isNativeSupported || isIOS);

  return {
    isFullscreen,
    isStandaloneApp,
    isIOS,
    isNativeSupported,
    canShowButton,
    iosGuideOpen,
    toggleFullscreen,
    closeIosGuide,
  };
}
