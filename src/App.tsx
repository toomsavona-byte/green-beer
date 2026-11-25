import { useCallback, useEffect, useRef, useState } from 'react';
import { RotateCw, X } from 'lucide-react';
import { CharacterSelect } from './components/CharacterSelect';
import { ControlsModal } from './components/ControlsModal';
import { CutsceneView } from './components/CutsceneView';
import { EndlessFinaleView } from './components/EndlessFinaleView';
import { GameHud } from './components/GameHud';
import { GameModals } from './components/GameModals';
import { IosFullscreenModal } from './components/IosFullscreenModal';
import { LeaderboardModal } from './components/LeaderboardModal';
import { OfflineIndicator } from './components/OfflineIndicator';
import { OnlineLobby } from './components/OnlineLobby';
import { TitleScreen } from './components/TitleScreen';
import { TouchControls } from './components/TouchControls';
import { soundEngine } from './game/audio';
import { CUTSCENES, VICTORY_CUTSCENE } from './game/data';
import { GameEngine, VirtualButtonAction } from './game/engine';
import { onlineClient } from './game/net';
import { loadSaveData, saveProgress } from './game/storage';
import {
  DifficultyId,
  GameSettings,
  HeroId,
  HudSnapshot,
  LevelId,
  OnlineRole,
  OnlineRoomSnapshot,
  PublicRoomInfo,
  ScreenState,
  StageClearSummary,
} from './game/types';
import { useFullscreen } from './hooks/useFullscreen';
import { usePlatform } from './hooks/usePlatform';

export default function App() {
  const initialSave = useRef(loadSaveData());

  const [screen, setScreen] = useState<ScreenState>('TITLE_MENU');
  const [settings, setSettings] = useState<GameSettings>({
    players: 1,
    startLevel: 1,
    difficulty: initialSave.current.difficulty,
    friendlyFire: initialSave.current.friendlyFire,
    crtScanlines: initialSave.current.crtScanlines,
    muted: false,
    touchControlsMode: initialSave.current.touchControlsMode,
    controls: initialSave.current.controls,
  });
  const [controlsModalOpen, setControlsModalOpen] = useState<boolean>(false);
  const [leaderboardOpen, setLeaderboardOpen] = useState<boolean>(false);
  const [lastSavedEntryId, setLastSavedEntryId] = useState<string | null>(null);
  const controlsRef = useRef(settings.controls);
  controlsRef.current = settings.controls;
  const [highScore, setHighScore] = useState<number>(initialSave.current.highScore);
  const [currentLevel, setCurrentLevel] = useState<LevelId>(1);
  const [selectedHeroes, setSelectedHeroes] = useState<HeroId[]>(['vadek']);
  const [continuesLeft, setContinuesLeft] = useState<number>(3);
  const [carryScore, setCarryScore] = useState<number>(0);
  const [hud, setHud] = useState<HudSnapshot | null>(null);
  const [stageSummary, setStageSummary] = useState<StageClearSummary | null>(null);
  const [isVictoryCutscene, setIsVictoryCutscene] = useState<boolean>(false);
  const [dismissRotateHint, setDismissRotateHint] = useState<boolean>(false);

  // Online 2P Co-Op State
  const [onlineConnected, setOnlineConnected] = useState<boolean>(false);
  const [onlineStatusDetail, setOnlineStatusDetail] = useState<string | null>(null);
  const [onlineServerUrl, setOnlineServerUrl] = useState<string>(() => onlineClient.getEffectiveServerDisplay());
  const [onlineRoom, setOnlineRoom] = useState<OnlineRoomSnapshot | null>(null);
  const [onlineRole, setOnlineRole] = useState<OnlineRole | null>(null);
  const [openRooms, setOpenRooms] = useState<PublicRoomInfo[]>([]);
  const [onlineError, setOnlineError] = useState<string | null>(null);
  const [peerNotice, setPeerNotice] = useState<string | null>(null);
  const [guestCutsceneLine, setGuestCutsceneLine] = useState<number>(0);

  const platform = usePlatform(settings.touchControlsMode);
  const platformRef = useRef(platform);
  platformRef.current = platform;
  const fullscreen = useFullscreen(platform.isTouchDevice);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const engineRef = useRef<GameEngine | null>(null);
  const screenRef = useRef<ScreenState>(screen);
  screenRef.current = screen;
  const onlineRoleRef = useRef<OnlineRole | null>(onlineRole);
  onlineRoleRef.current = onlineRole;
  const onlineRoomRef = useRef<OnlineRoomSnapshot | null>(onlineRoom);
  onlineRoomRef.current = onlineRoom;

  const isGameMounted =
    screen === 'PLAYING' ||
    screen === 'PAUSED' ||
    screen === 'CONTINUE' ||
    screen === 'STAGE_CLEAR' ||
    screen === 'GAME_OVER';

  // Keep active engine synced with live platform scale, touch hints & modal input lock
  useEffect(() => {
    engineRef.current?.setTouchHints(platform.showTouchControls);
    engineRef.current?.setRenderScale(platform.recommendedRenderScale);
  }, [platform.showTouchControls, platform.recommendedRenderScale]);

  useEffect(() => {
    engineRef.current?.setInputBlocked(controlsModalOpen || fullscreen.iosGuideOpen || leaderboardOpen);
  }, [controlsModalOpen, fullscreen.iosGuideOpen, leaderboardOpen]);

  // iOS Safari & Mobile Browser Edge-Swipe / Overscroll Guard during active gameplay
  useEffect(() => {
    if (screen !== 'PLAYING' && screen !== 'VICTORY') return;
    if (controlsModalOpen || fullscreen.iosGuideOpen) return;

    const onTouchStart = (e: TouchEvent) => {
      if (!e.cancelable) return;
      const target = e.target;
      const isInteractiveBtn = target instanceof Element && Boolean(target.closest('button, a, input'));
      for (let i = 0; i < e.touches.length; i++) {
        const t = e.touches[i];
        const nearHorizEdge = t.clientX < 32 || t.clientX > window.innerWidth - 32;
        if (nearHorizEdge && !isInteractiveBtn) {
          e.preventDefault();
          return;
        }
      }
      if (!isInteractiveBtn && target instanceof HTMLCanvasElement) {
        e.preventDefault();
      }
    };

    const onTouchMove = (e: TouchEvent) => {
      if (screen === 'PLAYING' && e.cancelable) {
        e.preventDefault();
      }
    };

    window.addEventListener('touchstart', onTouchStart, { passive: false });
    window.addEventListener('touchmove', onTouchMove, { passive: false });
    return () => {
      window.removeEventListener('touchstart', onTouchStart);
      window.removeEventListener('touchmove', onTouchMove);
    };
  }, [screen, controlsModalOpen, fullscreen.iosGuideOpen]);

  // Reset dismiss flag when rotating back to landscape
  useEffect(() => {
    if (!platform.isPortrait) {
      setDismissRotateHint(false);
    }
  }, [platform.isPortrait]);

  const handleUpdateSettings = useCallback((partial: Partial<GameSettings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...partial };
      if (partial.difficulty !== undefined) {
        engineRef.current?.setDifficulty(partial.difficulty);
        saveProgress({ difficulty: partial.difficulty });
      }
      if (partial.friendlyFire !== undefined) {
        engineRef.current?.setFriendlyFire(partial.friendlyFire);
        saveProgress({ friendlyFire: partial.friendlyFire });
      }
      if (partial.crtScanlines !== undefined) {
        saveProgress({ crtScanlines: partial.crtScanlines });
      }
      if (partial.touchControlsMode !== undefined) {
        saveProgress({ touchControlsMode: partial.touchControlsMode });
      }
      if (partial.controls !== undefined) {
        engineRef.current?.setControls(partial.controls);
        saveProgress({ controls: partial.controls });
      }
      if (partial.muted !== undefined) {
        soundEngine.setMuted(partial.muted);
      }
      return next;
    });
  }, []);

  const handleToggleMute = useCallback(() => {
    soundEngine.unlock();
    const nextMuted = !soundEngine.isMuted();
    soundEngine.setMuted(nextMuted);
    setSettings((prev) => ({ ...prev, muted: nextMuted }));
  }, []);

  const handleStickMove = useCallback((x: number, y: number) => {
    engineRef.current?.setVirtualStick(x, y);
  }, []);

  const handleVirtualButton = useCallback((action: VirtualButtonAction, pressed: boolean) => {
    engineRef.current?.setVirtualButton(action, pressed);
  }, []);

  const handleClearVirtualInput = useCallback(() => {
    engineRef.current?.clearVirtualInput();
  }, []);

  // Request landscape orientation on mobile browsers/PWA when triggered by user gesture
  const requestLandscapeLock = useCallback(async () => {
    try {
      const rootEl = document.documentElement as HTMLElement & {
        webkitRequestFullscreen?: () => Promise<void>;
      };
      if (!document.fullscreenElement) {
        if (rootEl.requestFullscreen) {
          await rootEl.requestFullscreen().catch(() => {});
        } else if (rootEl.webkitRequestFullscreen) {
          await rootEl.webkitRequestFullscreen().catch(() => {});
        }
      }
      const orientation = window.screen.orientation as ScreenOrientation & {
        lock?: (o: string) => Promise<void>;
      };
      if (orientation?.lock) {
        await orientation.lock('landscape').catch(() => {});
      }
    } catch {
      // Orientation lock is ignored on unsupported browsers; APK enforces it natively.
    }
  }, []);

  // Immediate audio startup (works right away on Android APK WebView) + gesture/focus fallback for browsers
  useEffect(() => {
    let lockedLandscapeOnce = false;

    const tryUnlockAudio = () => {
      if (!soundEngine.isRunning()) {
        soundEngine.unlock();
      }
    };

    const onUserGesture = () => {
      tryUnlockAudio();
      if (!lockedLandscapeOnce) {
        lockedLandscapeOnce = true;
        const isStandalone =
          window.matchMedia('(display-mode: standalone)').matches ||
          window.matchMedia('(display-mode: fullscreen)').matches;
        if (isStandalone && platformRef.current.isTouchDevice) {
          const orientation = window.screen.orientation as ScreenOrientation & {
            lock?: (o: string) => Promise<void>;
          };
          orientation?.lock?.('landscape').catch(() => {});
        }
      }
    };

    const onVisibilityOrFocus = () => {
      if (!document.hidden) {
        tryUnlockAudio();
      }
    };

    // Attempt immediate autoplay on load + brief retries in case Android WebView finishes initializing a tick later
    tryUnlockAudio();
    const retry1 = window.setTimeout(tryUnlockAudio, 150);
    const retry2 = window.setTimeout(tryUnlockAudio, 600);

    window.addEventListener('pointerdown', onUserGesture, { passive: true });
    window.addEventListener('touchstart', onUserGesture, { passive: true });
    window.addEventListener('keydown', onUserGesture);
    window.addEventListener('focus', onVisibilityOrFocus);
    window.addEventListener('pageshow', onVisibilityOrFocus);
    document.addEventListener('visibilitychange', onVisibilityOrFocus);
    return () => {
      window.clearTimeout(retry1);
      window.clearTimeout(retry2);
      window.removeEventListener('pointerdown', onUserGesture);
      window.removeEventListener('touchstart', onUserGesture);
      window.removeEventListener('keydown', onUserGesture);
      window.removeEventListener('focus', onVisibilityOrFocus);
      window.removeEventListener('pageshow', onVisibilityOrFocus);
      document.removeEventListener('visibilitychange', onVisibilityOrFocus);
    };
  }, []);

  // Title music when returning to title screen & Synthwave on endless finale
  useEffect(() => {
    if (screen === 'TITLE_MENU') {
      soundEngine.playMusic('title');
    } else if (screen === 'VICTORY') {
      soundEngine.playMusic('synthwave');
    }
  }, [screen]);

  // Mount & start GameEngine cleanly when entering PLAYING
  const launchLevel = useCallback(
    (
      levelId: LevelId,
      heroes: HeroId[],
      conts: number,
      scoreCarry: number,
      diff: GameSettings['difficulty'],
      ff: boolean,
      onlineMode?: 'host' | 'guest'
    ) => {
      setCurrentLevel(levelId);
      setStageSummary(null);
      setScreen('PLAYING');

      // Defer one animation frame to ensure isolated canvas is mounted
      requestAnimationFrame(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        if (engineRef.current) {
          engineRef.current.destroy();
          engineRef.current = null;
        }
        const engine = new GameEngine(
          canvas,
          {
            onHudUpdate: (snapshot) => {
              setHud(snapshot);
              setContinuesLeft(snapshot.continuesLeft);
            },
            onStageClear: (summary) => {
              setStageSummary(summary);
              setCarryScore(summary.score);
              setContinuesLeft(summary.continuesLeft);
              const saved = saveProgress({
                highScore: summary.score,
                unlockedLevel: Math.min(7, summary.levelId + 1) as LevelId,
              });
              setHighScore(saved.highScore);
              if (onlineMode === 'host') {
                onlineClient.sendPhase({
                  phase: 'STAGE_CLEAR',
                  levelId: summary.levelId,
                  summary,
                  score: summary.score,
                  continuesLeft: summary.continuesLeft,
                });
              }
              setScreen('STAGE_CLEAR');
            },
            onAllPlayersDead: (remainingContinues, finalScore) => {
              setContinuesLeft(remainingContinues);
              setCarryScore(finalScore);
              const saved = saveProgress({ highScore: finalScore });
              setHighScore(saved.highScore);
              if (remainingContinues > 0) {
                setScreen('CONTINUE');
              } else {
                soundEngine.stopMusic();
                if (onlineMode === 'host') {
                  onlineClient.sendPhase({
                    phase: 'GAME_OVER',
                    levelId,
                    score: finalScore,
                    continuesLeft: 0,
                  });
                }
                setScreen('GAME_OVER');
              }
            },
            onPauseToggle: () => {
              if (onlineMode === 'guest') return;
              if (screenRef.current === 'PLAYING') {
                engine.setPaused(true);
                setScreen('PAUSED');
              } else if (screenRef.current === 'PAUSED') {
                engine.setPaused(false);
                setScreen('PLAYING');
              }
            },
            onNetFrame:
              onlineMode === 'host'
                ? (frame) => {
                    onlineClient.sendFrame(frame);
                  }
                : undefined,
            canSendNetFrame:
              onlineMode === 'host' ? () => onlineClient.canSendFrame() : undefined,
            onLocalGuestInput:
              onlineMode === 'guest'
                ? (input, urgent) => {
                    onlineClient.sendInput(input, urgent);
                  }
                : undefined,
          },
          {
            renderScale: platformRef.current.recommendedRenderScale,
            touchHints: platformRef.current.showTouchControls,
            controls: controlsRef.current,
          }
        );
        engineRef.current = engine;
        engine.startLevel({
          levelId,
          playerHeroes: heroes,
          continuesLeft: conts,
          difficulty: diff,
          friendlyFire: ff,
          carryScore: scoreCarry,
          onlineMode,
        });
      });
    },
    []
  );

  // Wire Online 2P Co-Op WebSocket listeners
  useEffect(() => {
    onlineClient.setListeners({
      onStatus: (connected, detail) => {
        setOnlineConnected(connected);
        setOnlineStatusDetail(detail ?? null);
      },
      onRoomList: (rooms) => {
        setOpenRooms(rooms);
      },
      onRoomState: (room, role) => {
        setOnlineRoom(room);
        setOnlineRole(role);
        setOnlineError(null);
        setSettings((prev) => ({
          ...prev,
          players: 2,
          difficulty: room.difficulty,
          startLevel: room.levelId,
          friendlyFire: room.friendlyFire,
        }));
      },
      onError: (message) => {
        setOnlineError(message);
      },
      onPeerLeft: (reason, hostLeft) => {
        if (hostLeft) {
          engineRef.current?.destroy();
          engineRef.current = null;
          setOnlineRoom(null);
          setOnlineRole(null);
          setOnlineError(reason);
          setPeerNotice(null);
          setScreen('ONLINE_LOBBY');
        } else {
          setPeerNotice(reason);
          window.setTimeout(() => setPeerNotice(null), 4500);
        }
      },
      onRemoteInput: (input) => {
        if (onlineRoleRef.current === 'host') {
          engineRef.current?.setRemoteP2Input(input);
        }
      },
      onFrame: (frame) => {
        if (onlineRoleRef.current === 'guest') {
          engineRef.current?.applyRemoteFrame(frame);
        }
      },
      onCutsceneSync: (lineIndex) => {
        if (onlineRoleRef.current === 'guest') {
          setGuestCutsceneLine(lineIndex);
        }
      },
      onGameMeta: (meta) => {
        if (onlineRoleRef.current !== 'guest') return;
        const room = onlineRoomRef.current;
        setCurrentLevel(meta.levelId);
        setCarryScore(meta.score);
        setContinuesLeft(meta.continuesLeft);
        if (meta.phase === 'CUTSCENE') {
          engineRef.current?.destroy();
          engineRef.current = null;
          setGuestCutsceneLine(0);
          setIsVictoryCutscene(Boolean(meta.isVictoryCutscene));
          setScreen('CUTSCENE');
        } else if (meta.phase === 'PLAYING') {
          const heroes: HeroId[] = room ? [room.hostHero, room.guestHero] : ['vadek', 'sandro'];
          launchLevel(
            meta.levelId,
            heroes,
            meta.continuesLeft,
            meta.score,
            room?.difficulty ?? 'normal',
            room?.friendlyFire ?? false,
            'guest'
          );
        } else if (meta.phase === 'STAGE_CLEAR') {
          setStageSummary(meta.summary);
          setScreen('STAGE_CLEAR');
        } else if (meta.phase === 'GAME_OVER') {
          soundEngine.stopMusic();
          setScreen('GAME_OVER');
        } else if (meta.phase === 'VICTORY') {
          engineRef.current?.destroy();
          engineRef.current = null;
          setIsVictoryCutscene(false);
          setScreen('VICTORY');
        } else if (meta.phase === 'LOBBY') {
          engineRef.current?.destroy();
          engineRef.current = null;
          setScreen('ONLINE_LOBBY');
        }
      },
    });
  }, [launchLevel]);

  // Cleanup engine on unmount or leaving active game screens
  useEffect(() => {
    if (!isGameMounted && engineRef.current) {
      engineRef.current.destroy();
      engineRef.current = null;
    }
  }, [isGameMounted]);

  useEffect(() => {
    return () => {
      engineRef.current?.destroy();
      onlineClient.disconnect();
      soundEngine.stopMusic();
    };
  }, []);

  const handleOpenOnlineLobby = useCallback(() => {
    setOnlineError(null);
    setPeerNotice(null);
    setOnlineServerUrl(onlineClient.getEffectiveServerDisplay());
    onlineClient.connect();
    setOnlineConnected(onlineClient.isConnected());
    onlineClient.requestRoomList();
    setScreen('ONLINE_LOBBY');
  }, []);

  const handleChangeOnlineServerUrl = useCallback((url: string) => {
    setOnlineError(null);
    const effective = onlineClient.setCustomServerUrl(url);
    setOnlineServerUrl(effective);
    onlineClient.forceReconnect();
  }, []);

  const handleReconnectOnline = useCallback(() => {
    setOnlineError(null);
    onlineClient.forceReconnect();
  }, []);

  const handleCreateRoom = useCallback(() => {
    setOnlineError(null);
    onlineClient.createRoom({
      heroId: 'vadek',
      difficulty: settings.difficulty,
      levelId: settings.startLevel,
      friendlyFire: settings.friendlyFire,
    });
  }, [settings.difficulty, settings.startLevel, settings.friendlyFire]);

  const handleJoinRoom = useCallback((code: string) => {
    setOnlineError(null);
    onlineClient.joinRoom(code);
  }, []);

  const handleLeaveRoom = useCallback(() => {
    onlineClient.leaveRoom();
    setOnlineRoom(null);
    setOnlineRole(null);
    setOnlineError(null);
    onlineClient.requestRoomList();
  }, []);

  const handleStartOnlineGame = useCallback(() => {
    if (!onlineRoom || onlineRole !== 'host' || !onlineRoom.guestConnected) return;
    const heroes: HeroId[] = [onlineRoom.hostHero, onlineRoom.guestHero];
    setSelectedHeroes(heroes);
    setCurrentLevel(onlineRoom.levelId);
    setContinuesLeft(3);
    setCarryScore(0);
    setIsVictoryCutscene(false);
    onlineClient.sendPhase({
      phase: 'CUTSCENE',
      levelId: onlineRoom.levelId,
      isVictoryCutscene: false,
      score: 0,
      continuesLeft: 3,
    });
    setScreen('CUTSCENE');
  }, [onlineRoom, onlineRole]);

  const handleConfirmHeroes = useCallback(
    (heroes: HeroId[]) => {
      setOnlineRoom(null);
      setOnlineRole(null);
      setSelectedHeroes(heroes);
      setCurrentLevel(settings.startLevel);
      setContinuesLeft(3);
      setCarryScore(0);
      setIsVictoryCutscene(false);
      setScreen('CUTSCENE');
    },
    [settings.startLevel]
  );

  const handleCutsceneComplete = useCallback(() => {
    const mode = onlineRole === 'host' ? 'host' : undefined;
    if (isVictoryCutscene) {
      setIsVictoryCutscene(false);
      if (mode === 'host') {
        onlineClient.sendPhase({
          phase: 'VICTORY',
          levelId: currentLevel,
          score: carryScore,
          continuesLeft,
        });
      }
      setScreen('VICTORY');
      return;
    }
    if (mode === 'host') {
      onlineClient.sendPhase({
        phase: 'PLAYING',
        levelId: currentLevel,
        score: carryScore,
        continuesLeft,
      });
    }
    launchLevel(
      currentLevel,
      selectedHeroes,
      continuesLeft,
      carryScore,
      settings.difficulty,
      settings.friendlyFire,
      mode
    );
  }, [
    onlineRole,
    isVictoryCutscene,
    currentLevel,
    selectedHeroes,
    continuesLeft,
    carryScore,
    settings.difficulty,
    settings.friendlyFire,
    launchLevel,
  ]);

  const handleResume = useCallback(() => {
    engineRef.current?.setPaused(false);
    setScreen('PLAYING');
  }, []);

  const handlePauseButton = useCallback(() => {
    if (onlineRole === 'guest') return;
    if (screen === 'PLAYING') {
      engineRef.current?.setPaused(true);
      setScreen('PAUSED');
    }
  }, [screen, onlineRole]);

  const handleRestartLevel = useCallback(() => {
    const freshContinues = screen === 'GAME_OVER' ? 3 : continuesLeft;
    const freshScore = screen === 'GAME_OVER' ? 0 : carryScore;
    setContinuesLeft(freshContinues);
    setCarryScore(freshScore);
    const mode = onlineRole === 'host' ? 'host' : undefined;
    if (mode === 'host') {
      onlineClient.sendPhase({
        phase: 'PLAYING',
        levelId: currentLevel,
        score: freshScore,
        continuesLeft: freshContinues,
      });
    }
    launchLevel(
      currentLevel,
      selectedHeroes,
      freshContinues,
      freshScore,
      settings.difficulty,
      settings.friendlyFire,
      mode
    );
  }, [
    onlineRole,
    screen,
    continuesLeft,
    carryScore,
    currentLevel,
    selectedHeroes,
    settings.difficulty,
    settings.friendlyFire,
    launchLevel,
  ]);

  const handleUseContinue = useCallback(() => {
    engineRef.current?.useContinue();
    setScreen('PLAYING');
  }, []);

  const handleGiveUpContinue = useCallback(() => {
    soundEngine.stopMusic();
    if (onlineRole === 'host') {
      onlineClient.sendPhase({
        phase: 'GAME_OVER',
        levelId: currentLevel,
        score: carryScore,
        continuesLeft: 0,
      });
    }
    setScreen('GAME_OVER');
  }, [onlineRole, currentLevel, carryScore]);

  const handleNextStage = useCallback(() => {
    if (currentLevel < 7) {
      const nextLvl = (currentLevel + 1) as LevelId;
      setCurrentLevel(nextLvl);
      setIsVictoryCutscene(false);
      if (onlineRole === 'host') {
        onlineClient.sendPhase({
          phase: 'CUTSCENE',
          levelId: nextLvl,
          isVictoryCutscene: false,
          score: carryScore,
          continuesLeft,
        });
      }
      setScreen('CUTSCENE');
    } else {
      setIsVictoryCutscene(true);
      if (onlineRole === 'host') {
        onlineClient.sendPhase({
          phase: 'CUTSCENE',
          levelId: currentLevel,
          isVictoryCutscene: true,
          score: carryScore,
          continuesLeft,
        });
      }
      setScreen('CUTSCENE');
    }
  }, [currentLevel, onlineRole, carryScore, continuesLeft]);

  const handleReturnTitle = useCallback(() => {
    engineRef.current?.destroy();
    engineRef.current = null;
    if (onlineRoom || onlineRole) {
      onlineClient.leaveRoom();
      onlineClient.disconnect();
      setOnlineRoom(null);
      setOnlineRole(null);
    }
    setHud(null);
    setStageSummary(null);
    setIsVictoryCutscene(false);
    setPeerNotice(null);
    setScreen('TITLE_MENU');
  }, [onlineRoom, onlineRole]);

  const controlsModal = controlsModalOpen ? (
    <ControlsModal
      bindings={settings.controls}
      isTouchDevice={platform.isTouchDevice}
      gamepadCount={platform.gamepadCount}
      onChange={(nextControls) => handleUpdateSettings({ controls: nextControls })}
      onClose={() => setControlsModalOpen(false)}
    />
  ) : null;

  const iosFullscreenModal = (
    <IosFullscreenModal
      open={fullscreen.iosGuideOpen}
      onClose={fullscreen.closeIosGuide}
    />
  );

  const leaderboardModal = (
    <LeaderboardModal
      open={leaderboardOpen}
      personalBest={highScore}
      highlightEntryId={lastSavedEntryId}
      gamepadBindings={settings.controls.gamepad}
      onClose={() => setLeaderboardOpen(false)}
    />
  );

  if (screen === 'TITLE_MENU') {
    return (
      <>
        <TitleScreen
          settings={settings}
          highScore={highScore}
          showTouchControls={platform.showTouchControls}
          isTouchDevice={platform.isTouchDevice}
          gamepadCount={platform.gamepadCount}
          controlsModalOpen={controlsModalOpen}
          iosGuideOpen={fullscreen.iosGuideOpen}
          leaderboardOpen={leaderboardOpen}
          canShowFullscreen={fullscreen.canShowButton}
          isFullscreen={fullscreen.isFullscreen}
          onToggleFullscreen={fullscreen.toggleFullscreen}
          onUpdateSettings={handleUpdateSettings}
          onOpenControls={() => setControlsModalOpen(true)}
          onOpenLeaderboard={() => setLeaderboardOpen(true)}
          onStart={() => setScreen('CHAR_SELECT')}
          onOpenOnlineLobby={handleOpenOnlineLobby}
        />
        {controlsModal}
        {iosFullscreenModal}
        {leaderboardModal}
        <OfflineIndicator />
      </>
    );
  }

  if (screen === 'ONLINE_LOBBY') {
    return (
      <>
        <OnlineLobby
          connected={onlineConnected}
          statusDetail={onlineStatusDetail}
          serverUrl={onlineServerUrl}
          room={onlineRoom}
          role={onlineRole}
          openRooms={openRooms}
          errorMsg={onlineError}
          settings={settings}
          onChangeServerUrl={handleChangeOnlineServerUrl}
          onReconnect={handleReconnectOnline}
          onBack={() => {
            onlineClient.disconnect();
            setOnlineRoom(null);
            setOnlineRole(null);
            setScreen('TITLE_MENU');
          }}
          onCreateRoom={handleCreateRoom}
          onJoinRoom={handleJoinRoom}
          onLeaveRoom={handleLeaveRoom}
          onRefreshRooms={() => onlineClient.requestRoomList()}
          onSelectHero={(heroId: HeroId) => onlineClient.selectHero(heroId)}
          onToggleReady={(ready: boolean) => onlineClient.setReady(ready)}
          onUpdateRoomSettings={(partial: {
            difficulty?: DifficultyId;
            levelId?: LevelId;
            friendlyFire?: boolean;
          }) => onlineClient.updateLobbySettings(partial)}
          onStartOnlineGame={handleStartOnlineGame}
        />
        <OfflineIndicator />
      </>
    );
  }

  if (screen === 'CHAR_SELECT') {
    return (
      <>
        <CharacterSelect
          players={settings.players}
          startLevel={settings.startLevel}
          isTouchDevice={platform.isTouchDevice}
          isPortrait={platform.isPortrait}
          gamepadBindings={settings.controls.gamepad}
          gamepadCount={platform.gamepadCount}
          onRequestLandscape={requestLandscapeLock}
          onBack={() => setScreen('TITLE_MENU')}
          onConfirm={handleConfirmHeroes}
        />
        <OfflineIndicator />
      </>
    );
  }

  if (screen === 'CUTSCENE') {
    const activeCutscene = isVictoryCutscene ? VICTORY_CUTSCENE : CUTSCENES[currentLevel];
    return (
      <>
        <CutsceneView
          cutscene={activeCutscene}
          crtScanlines={settings.crtScanlines}
          isTouchDevice={platform.isTouchDevice}
          renderScale={platform.recommendedRenderScale}
          gamepadBindings={settings.controls.gamepad}
          isOnlineGuest={onlineRole === 'guest'}
          syncLineIndex={onlineRole === 'guest' ? guestCutsceneLine : undefined}
          onLineChange={
            onlineRole === 'host' ? (idx) => onlineClient.sendCutsceneSync(idx) : undefined
          }
          onComplete={handleCutsceneComplete}
        />
        <OfflineIndicator />
      </>
    );
  }

  if (screen === 'VICTORY') {
    const finaleMode = onlineRoom ? 'online' : settings.players === 2 ? '2p' : '1p';
    return (
      <>
        <EndlessFinaleView
          score={carryScore}
          highScore={highScore}
          heroes={selectedHeroes}
          difficulty={settings.difficulty}
          gameMode={finaleMode}
          crtScanlines={settings.crtScanlines}
          muted={settings.muted}
          isTouchDevice={platform.isTouchDevice}
          renderScale={platform.recommendedRenderScale}
          gamepadBindings={settings.controls.gamepad}
          leaderboardOpen={leaderboardOpen}
          canShowFullscreen={fullscreen.canShowButton}
          isFullscreen={fullscreen.isFullscreen}
          onToggleFullscreen={fullscreen.toggleFullscreen}
          onToggleMute={handleToggleMute}
          onScoreSaved={(entryId) => setLastSavedEntryId(entryId)}
          onOpenLeaderboard={() => setLeaderboardOpen(true)}
          onReturnTitle={handleReturnTitle}
        />
        {iosFullscreenModal}
        {leaderboardModal}
        <OfflineIndicator />
      </>
    );
  }

  return (
    <div className="relative w-screen h-[100dvh] bg-[#05070B] overflow-hidden flex items-center justify-center touch-control-surface">
      {/* Isolated HD Hand-Inked Arcade Canvas Viewport */}
      <canvas
        ref={canvasRef}
        className="w-full h-full object-contain block"
      />

      {/* Optional CRT scanlines */}
      {settings.crtScanlines && (
        <div className="pointer-events-none fixed inset-0 z-10 crt-scanlines opacity-55" />
      )}

      {/* Low-occlusion HUD */}
      <GameHud
        hud={hud}
        muted={settings.muted}
        showTouchControls={platform.showTouchControls}
        canShowFullscreen={fullscreen.canShowButton}
        isFullscreen={fullscreen.isFullscreen}
        onToggleFullscreen={fullscreen.toggleFullscreen}
        onToggleMute={handleToggleMute}
        onPause={handlePauseButton}
      />

      {/* Online Peer Disconnect Notice */}
      {peerNotice && (
        <div className="fixed top-20 inset-x-4 z-30 flex justify-center pointer-events-none">
          <div className="bg-[#3B1520]/95 border border-[#FF2A85] px-4 py-1.5 text-xs font-mono-num text-[#FECDD3]">
            {peerNotice}
          </div>
        </div>
      )}

      {/* Non-blocking Portrait Orientation Suggestion on Mobile */}
      {platform.isTouchDevice && platform.isPortrait && screen === 'PLAYING' && !dismissRotateHint && (
        <div className="fixed top-24 inset-x-4 z-25 flex justify-center pointer-events-none">
          <div className="pointer-events-auto flex items-center gap-2.5 bg-[#0D121A]/92 border border-[#FFB000] px-3 py-1.5 text-xs font-mono-num text-[#FDE68A]">
            <RotateCw className="w-4 h-4 text-[#FFB000] shrink-0" />
            <span>Поверните экран горизонтально для полного обзора 16:9</span>
            <button
              type="button"
              onClick={() => setDismissRotateHint(true)}
              aria-label="Скрыть подсказку"
              className="p-1 text-[#94A3B8] hover:text-white cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Multi-Touch Virtual Arcade Controls (Auto-shown on touch devices or when enabled) */}
      {platform.showTouchControls && screen === 'PLAYING' && (
        <TouchControls
          onStickMove={handleStickMove}
          onButtonChange={handleVirtualButton}
          onClearAll={handleClearVirtualInput}
        />
      )}

      {/* Pause / Continue / Stage Clear / Game Over Modals */}
      <GameModals
        screen={screen}
        settings={settings}
        showTouchControls={platform.showTouchControls}
        continuesLeft={continuesLeft}
        score={hud?.totalScore ?? carryScore}
        highScore={highScore}
        stageSummary={stageSummary}
        controlsModalOpen={controlsModalOpen}
        iosGuideOpen={fullscreen.iosGuideOpen}
        canShowFullscreen={fullscreen.canShowButton}
        isFullscreen={fullscreen.isFullscreen}
        onToggleFullscreen={fullscreen.toggleFullscreen}
        isOnlineGuest={onlineRole === 'guest'}
        onResume={handleResume}
        onRestartLevel={handleRestartLevel}
        onUseContinue={handleUseContinue}
        onGiveUpContinue={handleGiveUpContinue}
        onNextStage={handleNextStage}
        onReturnTitle={handleReturnTitle}
        onUpdateSettings={handleUpdateSettings}
        onOpenControls={() => setControlsModalOpen(true)}
      />
      {controlsModal}
      {iosFullscreenModal}
      <OfflineIndicator />
    </div>
  );
}
