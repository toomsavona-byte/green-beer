import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Check, Copy, RefreshCw, Users, Wifi, WifiOff } from 'lucide-react';
import { DIFFICULTIES, DIFFICULTY_MAP, HEROES, HERO_MAP, HERO_PORTRAIT_URLS, LEVELS, WEAPON_MAP } from '../game/data';
import { soundEngine } from '../game/audio';
import {
  DifficultyId,
  GameSettings,
  HeroId,
  LevelId,
  OnlineRole,
  OnlineRoomSnapshot,
  PublicRoomInfo,
} from '../game/types';
import { useGamepadMenuNav } from '../hooks/useGamepadMenuNav';

const CYRILLIC_LOOKALIKES: Record<string, string> = {
  А: 'A',
  В: 'B',
  Е: 'E',
  К: 'K',
  М: 'M',
  Н: 'H',
  О: 'O',
  Р: 'P',
  С: 'C',
  Т: 'T',
  У: 'Y',
  Х: 'X',
};

function sanitizeRoomCodeInput(raw: string): string {
  const upper = raw.toUpperCase();
  let out = '';
  for (const ch of upper) {
    const mapped = CYRILLIC_LOOKALIKES[ch] ?? ch;
    if (/[A-Z0-9]/.test(mapped)) {
      out += mapped;
      if (out.length >= 4) break;
    }
  }
  return out;
}

interface OnlineLobbyProps {
  connected: boolean;
  statusDetail: string | null;
  serverUrl: string;
  room: OnlineRoomSnapshot | null;
  role: OnlineRole | null;
  openRooms: PublicRoomInfo[];
  errorMsg: string | null;
  settings: GameSettings;
  onChangeServerUrl: (url: string) => void;
  onReconnect: () => void;
  onBack: () => void;
  onCreateRoom: () => void;
  onJoinRoom: (code: string) => void;
  onLeaveRoom: () => void;
  onRefreshRooms: () => void;
  onSelectHero: (heroId: HeroId) => void;
  onToggleReady: (ready: boolean) => void;
  onUpdateRoomSettings: (partial: {
    difficulty?: DifficultyId;
    levelId?: LevelId;
    friendlyFire?: boolean;
  }) => void;
  onStartOnlineGame: () => void;
}

export function OnlineLobby({
  connected,
  statusDetail,
  serverUrl,
  room,
  role,
  openRooms,
  errorMsg,
  settings,
  onChangeServerUrl,
  onReconnect,
  onBack,
  onCreateRoom,
  onJoinRoom,
  onLeaveRoom,
  onRefreshRooms,
  onSelectHero,
  onToggleReady,
  onUpdateRoomSettings,
  onStartOnlineGame,
}: OnlineLobbyProps) {
  const [joinCode, setJoinCode] = useState('');
  const [serverPanelOpen, setServerPanelOpen] = useState(false);
  const [serverDraft, setServerDraft] = useState(serverUrl);
  const [copied, setCopied] = useState(false);
  const [gpNavActive, setGpNavActive] = useState(false);
  const [lobbyFocusIdx, setLobbyFocusIdx] = useState(0);
  const [roomHeroCursor, setRoomHeroCursor] = useState(0);

  useEffect(() => {
    setServerDraft(serverUrl);
  }, [serverUrl]);

  const handleCopyCode = () => {
    if (!room) return;
    navigator.clipboard?.writeText(room.code).catch(() => {});
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  };

  const myHeroId: HeroId = room
    ? role === 'host'
      ? room.hostHero
      : room.guestHero
    : 'vadek';
  const partnerHeroId: HeroId | null = room
    ? role === 'host'
      ? (room.guestConnected ? room.guestHero : null)
      : room.hostHero
    : null;

  useEffect(() => {
    const clearGp = () => setGpNavActive(false);
    window.addEventListener('pointerdown', clearGp, { passive: true });
    return () => window.removeEventListener('pointerdown', clearGp);
  }, []);

  // Sync room hero cursor to player's currently selected hero upon entering room
  useEffect(() => {
    if (!room) return;
    const idx = HEROES.findIndex((h) => h.id === myHeroId);
    if (idx >= 0) setRoomHeroCursor(idx);
  }, [room?.code, myHeroId]);

  const entryItems = useMemo<string[]>(
    () => ['create', 'refresh', ...openRooms.map((r) => `join:${r.code}`), 'back'],
    [openRooms]
  );

  const safeEntryIdx = Math.min(lobbyFocusIdx, Math.max(0, entryItems.length - 1));
  const focusedEntry = !room && gpNavActive ? entryItems[safeEntryIdx] : null;
  const entryRing = (id: string) => (focusedEntry === id ? 'gp-focus-ring' : '');

  useGamepadMenuNav({
    enabled: true,
    gamepadBindings: settings.controls.gamepad,
    onActivity: () => setGpNavActive(true),
    onUp: () => {
      soundEngine.unlock();
      soundEngine.playMenuMove();
      if (!room) {
        setLobbyFocusIdx((i) => (i + entryItems.length - 1) % entryItems.length);
      } else {
        setRoomHeroCursor((i) => (i + HEROES.length - 4) % HEROES.length);
      }
    },
    onDown: () => {
      soundEngine.unlock();
      soundEngine.playMenuMove();
      if (!room) {
        setLobbyFocusIdx((i) => (i + 1) % entryItems.length);
      } else {
        setRoomHeroCursor((i) => (i + 4) % HEROES.length);
      }
    },
    onLeft: () => {
      soundEngine.unlock();
      soundEngine.playMenuMove();
      if (!room) {
        setLobbyFocusIdx((i) => (i + entryItems.length - 1) % entryItems.length);
      } else {
        setRoomHeroCursor((i) => (i + HEROES.length - 1) % HEROES.length);
      }
    },
    onRight: () => {
      soundEngine.unlock();
      soundEngine.playMenuMove();
      if (!room) {
        setLobbyFocusIdx((i) => (i + 1) % entryItems.length);
      } else {
        setRoomHeroCursor((i) => (i + 1) % HEROES.length);
      }
    },
    onConfirm: () => {
      soundEngine.unlock();
      if (!room) {
        const key = entryItems[safeEntryIdx];
        if (key === 'create' && connected) {
          soundEngine.playMenuConfirm();
          onCreateRoom();
        } else if (key === 'refresh') {
          soundEngine.playMenuMove();
          onRefreshRooms();
        } else if (key?.startsWith('join:') && connected) {
          soundEngine.playMenuConfirm();
          onJoinRoom(key.slice(5));
        } else if (key === 'back') {
          soundEngine.playMenuMove();
          onBack();
        }
      } else {
        const picked = HEROES[roomHeroCursor];
        if (picked && picked.id !== partnerHeroId) {
          soundEngine.playMenuConfirm();
          onSelectHero(picked.id);
        }
      }
    },
    onStart: () => {
      if (!room) return;
      soundEngine.unlock();
      if (role === 'host' && room.guestConnected) {
        soundEngine.playMenuConfirm();
        onStartOnlineGame();
      } else if (role === 'guest') {
        soundEngine.playMenuConfirm();
        onToggleReady(!room.guestReady);
      }
    },
    onAlt: () => {
      if (!room) return;
      soundEngine.unlock();
      if (role === 'guest') {
        soundEngine.playMenuConfirm();
        onToggleReady(!room.guestReady);
      } else if (role === 'host') {
        soundEngine.playMenuMove();
        const order: DifficultyId[] = ['easy', 'normal', 'hard'];
        const next = order[(order.indexOf(room.difficulty) + 1) % order.length];
        onUpdateRoomSettings({ difficulty: next });
      }
    },
    onBack: () => {
      soundEngine.unlock();
      soundEngine.playMenuMove();
      if (room) {
        onLeaveRoom();
      } else {
        onBack();
      }
    },
  });

  return (
    <div className="w-screen h-[100dvh] bg-[#090C11] text-[#E6EDF3] flex flex-col overflow-hidden safe-area-inset">
      {/* Top Header */}
      <div className="flex items-center justify-between gap-2 px-3 sm:px-6 py-2.5 sm:py-3 bg-[#0D121A] border-b border-[#242F40] shrink-0">
        <button
          type="button"
          onClick={() => {
            soundEngine.playMenuMove();
            if (room) {
              onLeaveRoom();
            } else {
              onBack();
            }
          }}
          className={`flex items-center gap-1.5 px-3 min-h-[38px] bg-[#141A24] border border-[#2B3648] hover:border-[#39FF14] text-xs font-mono-num text-[#E6EDF3] cursor-pointer ${entryRing('back')}`}
        >
          <ArrowLeft className="w-4 h-4 text-[#39FF14]" />
          <span>{room ? 'ПОКИНУТЬ КОМНАТУ' : 'В МЕНЮ'}</span>
        </button>

        <div className="flex items-center gap-2 min-w-0">
          <Users className="w-4 h-4 sm:w-5 sm:h-5 text-[#00E5FF] shrink-0" />
          <h1 className="font-display font-bold text-base sm:text-xl tracking-wider text-white truncate">
            ОНЛАЙН 2P CO-OP
          </h1>
        </div>

        <button
          type="button"
          onClick={() => {
            soundEngine.playMenuMove();
            setServerPanelOpen((v) => !v);
          }}
          title="Настройка сервера подключения"
          className="flex items-center gap-1.5 px-2.5 py-1 bg-[#141A24] border border-[#2B3648] hover:border-[#00E5FF] font-mono-num text-[11px] shrink-0 cursor-pointer"
        >
          {connected ? (
            <>
              <Wifi className="w-3.5 h-3.5 text-[#39FF14]" />
              <span className="text-[#39FF14] hidden sm:inline">ОНЛАЙН</span>
            </>
          ) : (
            <>
              <WifiOff className="w-3.5 h-3.5 text-[#FF2A85]" />
              <span className="text-[#FF2A85] hidden sm:inline">НЕТ СЕТИ · СЕРВЕР</span>
            </>
          )}
        </button>
      </div>

      {/* Body */}
      <div className="flex-1 min-h-0 overflow-y-auto px-3 sm:px-6 py-4">
        <div className="max-w-5xl mx-auto flex flex-col gap-4">
          {(!connected || serverPanelOpen) && (
            <div
              className={`border px-3.5 py-3 flex flex-col gap-2.5 ${
                connected
                  ? 'bg-[#0F1520] border-[#2B3648]'
                  : 'bg-[#26111B] border-[#FF2A85]'
              }`}
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="text-xs font-mono-num text-[#FECDD3] flex items-center gap-2">
                  {connected ? (
                    <Wifi className="w-4 h-4 text-[#39FF14] shrink-0" />
                  ) : (
                    <WifiOff className="w-4 h-4 text-[#FF2A85] shrink-0" />
                  )}
                  <span className={connected ? 'text-[#39FF14]' : 'text-[#FECDD3]'}>
                    {connected
                      ? `ПОДКЛЮЧЕНО К СЕРВЕРУ: ${serverUrl}`
                      : statusDetail || `ПОДКЛЮЧЕНИЕ К ${serverUrl}...`}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    soundEngine.playMenuMove();
                    onReconnect();
                  }}
                  className="flex items-center gap-1.5 px-2.5 py-1 bg-[#141A24] border border-[#FFB000] text-[#FFB000] hover:bg-[#2E2410] text-[11px] font-mono-num cursor-pointer"
                >
                  <RefreshCw className="w-3 h-3" />
                  <span>ПЕРЕПОДКЛЮЧИТЬ</span>
                </button>
              </div>

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  soundEngine.playMenuConfirm();
                  onChangeServerUrl(serverDraft);
                }}
                className="flex flex-wrap sm:flex-nowrap items-stretch gap-2"
              >
                <input
                  type="text"
                  value={serverDraft}
                  onChange={(e) => setServerDraft(e.target.value)}
                  placeholder="http://137.22.149.135:3002"
                  autoCapitalize="off"
                  autoCorrect="off"
                  spellCheck={false}
                  className="flex-1 min-w-[180px] bg-[#090C11] border border-[#2B3648] focus:border-[#00E5FF] outline-none px-3 py-1.5 font-mono-num text-xs text-white"
                />
                <button
                  type="submit"
                  className="px-3.5 py-1.5 bg-[#00E5FF] hover:bg-[#38EEFF] text-[#090C11] font-display font-bold text-xs tracking-wider cursor-pointer"
                >
                  ПОДКЛЮЧИТЬ
                </button>
                <button
                  type="button"
                  onClick={() => {
                    soundEngine.playMenuMove();
                    onChangeServerUrl('');
                  }}
                  className="px-3 py-1.5 bg-[#141A24] border border-[#2B3648] hover:border-[#94A3B8] text-[#94A3B8] hover:text-white font-mono-num text-xs cursor-pointer"
                >
                  АВТО
                </button>
              </form>
            </div>
          )}

          {errorMsg && (
            <div className="bg-[#3B1520] border border-[#FF2A85] px-4 py-2.5 text-xs sm:text-sm font-mono-num text-[#FECDD3]">
              {errorMsg}
            </div>
          )}

          {!room ? (
            <>
              {/* Entry State: Create or Join */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Create Room */}
                <div className="bg-[#0F1520] border-2 border-[#39FF14] p-4 sm:p-5 flex flex-col justify-between gap-4">
                  <div>
                    <div className="font-mono-num text-xs text-[#39FF14] tracking-wider">
                      ИГРОК 1 · ХОСТ КОМНАТЫ
                    </div>
                    <h2 className="font-display font-bold text-xl sm:text-2xl text-white mt-1">
                      СОЗДАТЬ КОМНАТУ И ЖДАТЬ ДРУГА
                    </h2>
                    <p className="text-xs sm:text-sm text-[#94A3B8] mt-2 leading-relaxed">
                      Получите короткий 4-значный код для друга — либо любой игрок сможет зайти к вам
                      прямо из списка открытых комнат ниже.
                    </p>
                    <div className="mt-3 text-[11px] font-mono-num text-[#CBD5E1] bg-[#090C11] border border-[#242F40] p-2.5">
                      Старт: Уровень {settings.startLevel} · Сложность: {DIFFICULTY_MAP[settings.difficulty].label} · FF:{' '}
                      {settings.friendlyFire ? 'ВКЛ' : 'ВЫКЛ'}
                    </div>
                  </div>
                  <button
                    type="button"
                    disabled={!connected}
                    onClick={() => {
                      soundEngine.unlock();
                      soundEngine.playMenuConfirm();
                      onCreateRoom();
                    }}
                    className={`w-full min-h-[46px] py-3 bg-[#39FF14] hover:bg-[#5BFF3B] disabled:opacity-45 text-[#090C11] font-display font-bold text-sm sm:text-base tracking-widest cursor-pointer ${entryRing('create')}`}
                  >
                    СОЗДАТЬ КОМНАТУ
                  </button>
                </div>

                {/* Join By Code */}
                <div className="bg-[#0F1520] border-2 border-[#00E5FF] p-4 sm:p-5 flex flex-col justify-between gap-4">
                  <div>
                    <div className="font-mono-num text-xs text-[#00E5FF] tracking-wider">
                      ИГРОК 2 · ПОДКЛЮЧЕНИЕ ПО КОДУ
                    </div>
                    <h2 className="font-display font-bold text-xl sm:text-2xl text-white mt-1">
                      ВОЙТИ В КОМНАТУ ДРУГА
                    </h2>
                    <p className="text-xs sm:text-sm text-[#94A3B8] mt-2 leading-relaxed">
                      Введите 4-значный код комнаты. Управлять Игроком 2 можно привычными клавишами
                      WASD + J/K/L/I, с телефона или с геймпада.
                    </p>
                  </div>

                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      const clean = sanitizeRoomCodeInput(joinCode);
                      if (clean.length === 4) {
                        soundEngine.unlock();
                        soundEngine.playMenuConfirm();
                        if (!connected) {
                          onReconnect();
                        }
                        onJoinRoom(clean);
                      }
                    }}
                    className="flex items-stretch gap-2"
                  >
                    <input
                      type="text"
                      value={joinCode}
                      maxLength={4}
                      autoCapitalize="characters"
                      autoCorrect="off"
                      spellCheck={false}
                      onChange={(e) => setJoinCode(sanitizeRoomCodeInput(e.target.value))}
                      placeholder="КОД (напр. K7M2)"
                      className="flex-1 bg-[#090C11] border border-[#2B3648] focus:border-[#00E5FF] outline-none px-3 py-2.5 font-mono-num text-base sm:text-lg tracking-[0.28em] text-center text-white uppercase"
                    />
                    <button
                      type="submit"
                      disabled={joinCode.trim().length !== 4}
                      className="px-5 min-h-[46px] bg-[#00E5FF] hover:bg-[#38EEFF] disabled:opacity-40 text-[#090C11] font-display font-bold text-sm sm:text-base tracking-wider cursor-pointer"
                    >
                      ВОЙТИ
                    </button>
                  </form>
                </div>
              </div>

              {/* Open Waiting Rooms Directory */}
              <div className="bg-[#0F1520] border border-[#2B3648] p-4 sm:p-5 flex flex-col gap-3">
                <div className="flex items-center justify-between gap-2 border-b border-[#1E293B] pb-2.5">
                  <div>
                    <h3 className="font-display font-bold text-base sm:text-lg text-[#FFB000] tracking-wider">
                      ОТКРЫТЫЕ КОМНАТЫ (ОЖИДАЮТ ИГРОКА 2)
                    </h3>
                    <div className="text-[11px] font-mono-num text-[#94A3B8]">
                      Нажмите на комнату, чтобы сразу подключиться к ожидающему бойцу
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      soundEngine.playMenuMove();
                      onRefreshRooms();
                    }}
                    className={`flex items-center gap-1.5 px-3 py-1.5 bg-[#141A24] border border-[#2B3648] hover:border-[#FFB000] text-xs font-mono-num text-[#CBD5E1] cursor-pointer ${entryRing('refresh')}`}
                  >
                    <RefreshCw className="w-3.5 h-3.5 text-[#FFB000]" />
                    <span>ОБНОВИТЬ</span>
                  </button>
                </div>

                {openRooms.length === 0 ? (
                  <div className="py-6 text-center font-mono-num text-xs sm:text-sm text-[#64748B]">
                    Сейчас нет открытых комнат. Создайте свою — и ждите напарника!
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {openRooms.map((r) => (
                      <div
                        key={r.code}
                        className="flex items-center justify-between gap-3 bg-[#090C11] border border-[#242F40] hover:border-[#00E5FF] px-3.5 py-2.5"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <img
                            src={HERO_PORTRAIT_URLS[r.hostHero]}
                            alt={HERO_MAP[r.hostHero].name}
                            className="w-10 h-11 object-cover object-top border border-[#39FF14] shrink-0"
                          />
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 font-mono-num">
                              <span className="text-sm font-bold text-[#39FF14] tracking-widest">{r.code}</span>
                              <span className="text-xs text-white truncate">{HERO_MAP[r.hostHero].name}</span>
                            </div>
                            <div className="text-[11px] font-mono-num text-[#94A3B8] truncate">
                              Ур. {r.levelId} · {DIFFICULTY_MAP[r.difficulty].shortLabel}
                            </div>
                          </div>
                        </div>
                        <button
                          type="button"
                          disabled={!connected}
                          onClick={() => {
                            soundEngine.unlock();
                            soundEngine.playMenuConfirm();
                            onJoinRoom(r.code);
                          }}
                          className={`px-3.5 py-2 bg-[#00E5FF] text-[#090C11] font-display font-bold text-xs tracking-wider cursor-pointer shrink-0 ${entryRing(`join:${r.code}`)}`}
                        >
                          ВОЙТИ
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* 2P Co-Op Scaling Info */}
              <div className="bg-[#0D121A] border border-[#242F40] px-4 py-3 text-xs font-mono-num text-[#94A3B8] flex flex-wrap items-center justify-between gap-2">
                <span className="text-[#FFB000] font-bold">БАЛАНС ДЛЯ 2 ИГРОКОВ:</span>
                <span>+35% врагов в волнах (поверх сложности) · HP врагов ×1.45 · Боссы ×1.55 · +6% шанс дропа пива</span>
              </div>
            </>
          ) : (
            <>
              {/* Inside Waiting Room */}
              <div className="bg-[#0F1520] border-2 border-[#39FF14] p-4 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3 flex-wrap">
                  <div className="bg-[#090C11] border border-[#39FF14] px-3.5 py-2 flex items-center gap-3">
                    <div>
                      <div className="text-[10px] font-mono-num text-[#94A3B8]">КОД КОМНАТЫ</div>
                      <div className="font-mono-num text-2xl font-bold tracking-[0.25em] text-[#39FF14]">
                        {room.code}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={handleCopyCode}
                      className="flex items-center gap-1 px-2.5 py-1.5 bg-[#141A24] border border-[#2B3648] hover:border-[#39FF14] text-xs font-mono-num text-white cursor-pointer"
                    >
                      {copied ? <Check className="w-3.5 h-3.5 text-[#39FF14]" /> : <Copy className="w-3.5 h-3.5 text-[#39FF14]" />}
                      <span>{copied ? 'СКОПИРОВАНО' : 'КОПИРОВАТЬ'}</span>
                    </button>
                  </div>

                  <div>
                    <div className="font-display font-bold text-base sm:text-lg text-white">
                      {room.guestConnected
                        ? room.guestReady
                          ? 'ОБА БОЙЦА ГОТОВЫ — МОЖНО СТАРТОВАТЬ!'
                          : 'ИГРОК 2 ПОДКЛЮЧЁН! ВЫБИРАЙТЕ ГЕРОЕВ'
                        : 'ОЖИДАНИЕ ИГРОКА 2...'}
                    </div>
                    <div className="text-xs font-mono-num text-[#94A3B8]">
                      {room.guestConnected
                        ? 'Передайте привет напарнику и жмите старт.'
                        : 'Отправьте код другу или дождитесь игрока из списка открытых комнат.'}
                    </div>
                  </div>
                </div>

                {/* Primary Room Action CTA */}
                {role === 'host' ? (
                  <button
                    type="button"
                    disabled={!room.guestConnected}
                    onClick={() => {
                      soundEngine.unlock();
                      soundEngine.playMenuConfirm();
                      onStartOnlineGame();
                    }}
                    className="px-6 min-h-[46px] py-2.5 bg-[#FF2A85] hover:bg-[#FF4696] disabled:opacity-40 text-white font-display font-bold text-sm sm:text-base tracking-widest border border-[#FF85B8] cursor-pointer"
                  >
                    {room.guestConnected ? 'НАЧАТЬ ИГРУ ВДВОЁМ' : 'ЖДЁМ ИГРОКА 2...'}
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      soundEngine.unlock();
                      soundEngine.playMenuConfirm();
                      onToggleReady(!room.guestReady);
                    }}
                    className={`px-6 min-h-[46px] py-2.5 font-display font-bold text-sm sm:text-base tracking-widest border cursor-pointer ${
                      room.guestReady
                        ? 'bg-[#39FF14] text-[#090C11] border-[#39FF14]'
                        : 'bg-[#00E5FF] text-[#090C11] border-[#00E5FF]'
                    }`}
                  >
                    {room.guestReady ? '✓ ГОТОВ · ЖДЁМ ХОСТА' : 'НАЖМИ: ГОТОВ К БОЮ'}
                  </button>
                )}
              </div>

              {/* P1 & P2 Live Squad Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* P1 Host */}
                <div className="bg-[#0F1520] border border-[#39FF14] p-3 flex items-center gap-3">
                  <img
                    src={HERO_PORTRAIT_URLS[room.hostHero]}
                    alt={HERO_MAP[room.hostHero].name}
                    className="w-14 h-16 object-cover object-top border-2 border-[#39FF14] shrink-0"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono-num text-xs font-bold text-[#39FF14]">
                        P1 · ХОСТ {role === 'host' ? '(ВЫ)' : ''}
                      </span>
                      <span className="font-mono-num text-[11px] text-[#39FF14]">В СЕТИ</span>
                    </div>
                    <div className="font-display font-bold text-lg text-white truncate">
                      {HERO_MAP[room.hostHero].name}
                    </div>
                    <div className="text-xs font-mono-num text-[#94A3B8] truncate">
                      {WEAPON_MAP[HERO_MAP[room.hostHero].nativeWeaponId].name} (+10%)
                    </div>
                  </div>
                </div>

                {/* P2 Guest */}
                <div
                  className={`bg-[#0F1520] border p-3 flex items-center gap-3 ${
                    room.guestConnected ? 'border-[#00E5FF]' : 'border-dashed border-[#334155]'
                  }`}
                >
                  {room.guestConnected ? (
                    <>
                      <img
                        src={HERO_PORTRAIT_URLS[room.guestHero]}
                        alt={HERO_MAP[room.guestHero].name}
                        className="w-14 h-16 object-cover object-top border-2 border-[#00E5FF] shrink-0"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-mono-num text-xs font-bold text-[#00E5FF]">
                            P2 · НАПАРНИК {role === 'guest' ? '(ВЫ)' : ''}
                          </span>
                          <span
                            className={`font-mono-num text-[11px] font-bold ${
                              room.guestReady ? 'text-[#39FF14]' : 'text-[#FFB000]'
                            }`}
                          >
                            {room.guestReady ? 'ГОТОВ' : 'ВЫБИРАЕТ...'}
                          </span>
                        </div>
                        <div className="font-display font-bold text-lg text-white truncate">
                          {HERO_MAP[room.guestHero].name}
                        </div>
                        <div className="text-xs font-mono-num text-[#94A3B8] truncate">
                          {WEAPON_MAP[HERO_MAP[room.guestHero].nativeWeaponId].name} (+10%)
                        </div>
                      </div>
                    </>
                  ) : (
                    <div className="w-full py-3 text-center font-mono-num text-xs text-[#94A3B8]">
                      СЛОТ P2 СВОБОДЕН · ОЖИДАНИЕ ПОДКЛЮЧЕНИЯ НАПАРНИКА...
                    </div>
                  )}
                </div>
              </div>

              {/* Room Settings Strip (Host edits, Guest sees live) */}
              <div className="bg-[#0F1520] border border-[#242F40] p-3.5 flex flex-col gap-2.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-xs font-mono-num text-[#94A3B8]">СЛОЖНОСТЬ:</span>
                    {DIFFICULTIES.map((d) => {
                      const active = room.difficulty === d.id;
                      return (
                        <button
                          key={d.id}
                          type="button"
                          disabled={role !== 'host'}
                          onClick={() => {
                            soundEngine.playMenuMove();
                            onUpdateRoomSettings({ difficulty: d.id });
                          }}
                          className={`px-2.5 py-1 text-xs font-mono-num font-bold border ${
                            active
                              ? 'bg-[#2E2410] text-[#FFB000] border-[#FFB000]'
                              : 'bg-[#141A24] text-[#94A3B8] border-[#2B3648]'
                          } ${role === 'host' ? 'cursor-pointer hover:text-white' : 'cursor-default opacity-85'}`}
                        >
                          {d.label}
                        </button>
                      );
                    })}
                  </div>

                  <button
                    type="button"
                    disabled={role !== 'host'}
                    onClick={() => {
                      soundEngine.playMenuMove();
                      onUpdateRoomSettings({ friendlyFire: !room.friendlyFire });
                    }}
                    className={`px-2.5 py-1 text-xs font-mono-num border ${
                      room.friendlyFire
                        ? 'bg-[#3B1520] text-[#FF2A85] border-[#FF2A85]'
                        : 'bg-[#141A24] text-[#94A3B8] border-[#2B3648]'
                    } ${role === 'host' ? 'cursor-pointer' : 'cursor-default opacity-85'}`}
                  >
                    FRIENDLY FIRE: {room.friendlyFire ? 'ВКЛ' : 'ВЫКЛ'}
                  </button>
                </div>

                <div className="flex items-center gap-1.5 flex-wrap pt-2 border-t border-[#1E293B]">
                  <span className="text-xs font-mono-num text-[#94A3B8]">СТАРТОВЫЙ УРОВЕНЬ:</span>
                  {LEVELS.map((lvl) => (
                    <button
                      key={lvl.id}
                      type="button"
                      disabled={role !== 'host'}
                      onClick={() => {
                        soundEngine.playMenuMove();
                        onUpdateRoomSettings({ levelId: lvl.id });
                      }}
                      className={`px-2 py-1 text-xs font-mono-num border ${
                        room.levelId === lvl.id
                          ? 'bg-[#1F2D22] text-[#39FF14] border-[#39FF14]'
                          : 'bg-[#141A24] text-[#94A3B8] border-[#2B3648]'
                      } ${role === 'host' ? 'cursor-pointer hover:text-white' : 'cursor-default opacity-85'}`}
                    >
                      {lvl.shortName}
                    </button>
                  ))}
                </div>
              </div>

              {/* 8-Hero Picker Grid */}
              <div className="bg-[#0F1520] border border-[#242F40] p-3.5">
                <div className="text-xs font-mono-num text-[#94A3B8] mb-2.5">
                  ВЫБЕРИТЕ СВОЕГО БОЙЦА ({role === 'host' ? 'P1' : 'P2'}):
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  {HEROES.map((hero, heroIdx) => {
                    const isMine = myHeroId === hero.id;
                    const isPartner = partnerHeroId === hero.id;
                    const isGpFocused = gpNavActive && roomHeroCursor === heroIdx;
                    const borderClass = isMine
                      ? role === 'host'
                        ? 'border-[#39FF14] bg-[#16271C]'
                        : 'border-[#00E5FF] bg-[#102630]'
                      : isPartner
                        ? 'border-[#475569] bg-[#0B0F16] opacity-55'
                        : 'border-[#242F40] bg-[#090C11] hover:border-[#FFB000]';
                    return (
                      <button
                        key={hero.id}
                        type="button"
                        disabled={isPartner}
                        onClick={() => {
                          soundEngine.playMenuMove();
                          onSelectHero(hero.id);
                        }}
                        className={`border-2 p-2 flex items-center gap-2.5 text-left transition-colors ${borderClass} ${
                          isPartner ? 'cursor-not-allowed' : 'cursor-pointer'
                        } ${isGpFocused ? 'gp-focus-ring' : ''}`}
                      >
                        <img
                          src={HERO_PORTRAIT_URLS[hero.id]}
                          alt={hero.name}
                          className="w-11 h-13 object-cover object-top border border-[#2B3648] shrink-0"
                        />
                        <div className="min-w-0">
                          <div className="font-display font-bold text-sm text-white truncate">
                            {hero.name}
                          </div>
                          <div className="text-[10px] font-mono-num text-[#94A3B8] truncate">
                            {WEAPON_MAP[hero.nativeWeaponId].shortTag}
                          </div>
                          {isMine && (
                            <div className="text-[10px] font-mono-num font-bold text-[#39FF14]">
                              ВЫБРАН
                            </div>
                          )}
                          {isPartner && (
                            <div className="text-[10px] font-mono-num font-bold text-[#FFB000]">
                              ЗАНЯТ
                            </div>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
