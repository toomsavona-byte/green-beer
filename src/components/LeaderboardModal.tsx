import React, { useCallback, useEffect, useState } from 'react';
import { Crown, RefreshCw, Trophy, X } from 'lucide-react';
import { soundEngine } from '../game/audio';
import { GamepadControlMap } from '../game/controls';
import { HEROES } from '../game/data';
import { fetchLeaderboard, LeaderboardEntry } from '../game/leaderboard';
import { DifficultyId, HeroId } from '../game/types';
import { useGamepadMenuNav } from '../hooks/useGamepadMenuNav';

interface LeaderboardModalProps {
  open: boolean;
  personalBest: number;
  highlightEntryId?: string | null;
  gamepadBindings?: GamepadControlMap;
  onClose: () => void;
}

const DIFF_META: Record<DifficultyId, { label: string; cls: string }> = {
  easy: { label: 'EASY', cls: 'text-[#39FF14] border-[#39FF14]/60 bg-[#142818]' },
  normal: { label: 'NORMAL', cls: 'text-[#FFB000] border-[#FFB000]/60 bg-[#2C210C]' },
  hard: { label: 'HARD', cls: 'text-[#FF2A85] border-[#FF2A85]/60 bg-[#35111E]' },
};

const MODE_LABELS: Record<LeaderboardEntry['mode'], string> = {
  '1p': '1P',
  '2p': '2P',
  online: 'ONLINE',
};

const HERO_MAP = new Map(HEROES.map((h) => [h.id, h]));

function formatDateShort(ts: number): string {
  try {
    const d = new Date(ts);
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    return `${day}.${month}`;
  } catch {
    return '--.--';
  }
}

export const LeaderboardModal: React.FC<LeaderboardModalProps> = ({
  open,
  personalBest,
  highlightEntryId = null,
  gamepadBindings,
  onClose,
}) => {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [total, setTotal] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(false);
  const [fromServer, setFromServer] = useState<boolean>(true);

  const loadBoard = useCallback(async () => {
    setLoading(true);
    const result = await fetchLeaderboard();
    setEntries(result.entries);
    setTotal(result.total);
    setFromServer(result.fromServer);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!open) return;
    loadBoard();
  }, [open, loadBoard]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Escape') {
        e.preventDefault();
        soundEngine.playMenuMove();
        onClose();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  useGamepadMenuNav({
    enabled: open,
    gamepadBindings,
    onBack: () => {
      soundEngine.playMenuMove();
      onClose();
    },
    onStart: () => {
      soundEngine.playMenuMove();
      onClose();
    },
  });

  if (!open) return null;

  const topChampion = entries[0] ?? null;

  return (
    <div
      className="fixed inset-0 z-50 bg-[#05070B]/85 backdrop-blur-xs flex items-center justify-center p-2.5 sm:p-5"
      role="dialog"
      aria-modal="true"
      aria-label="Топ игроков по очкам"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          soundEngine.playMenuMove();
          onClose();
        }
      }}
    >
      <div className="w-full max-w-3xl max-h-[90dvh] bg-[#0B1018] border-2 border-[#39FF14] shadow-[0_0_40px_rgba(57,255,20,0.18)] flex flex-col overflow-hidden">
        {/* Top Arcade Hall of Fame Header */}
        <div className="flex items-center justify-between gap-3 px-4 sm:px-5 py-3 bg-[#101826] border-b border-[#243247]">
          <div className="flex items-center gap-2.5 min-w-0">
            <Trophy className="w-5 h-5 text-[#FDE047] shrink-0" />
            <div className="min-w-0">
              <h2 className="font-display font-bold text-base sm:text-lg tracking-[0.14em] text-[#39FF14] uppercase truncate">
                ЗАЛ СЛАВЫ · ТОП ИГРОКОВ
              </h2>
              <p className="text-[11px] font-mono-num text-[#94A3B8] truncate">
                {fromServer
                  ? 'ОБЩАЯ ТАБЛИЦА РЕКОРДОВ СЕРВЕРА'
                  : 'ЛОКАЛЬНАЯ ТАБЛИЦА РЕКОРДОВ (ОФЛАЙН)'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => {
                soundEngine.playMenuMove();
                loadBoard();
              }}
              disabled={loading}
              aria-label="Обновить таблицу"
              className="flex items-center gap-1.5 px-2.5 py-1.5 bg-[#141E2E] border border-[#2B3B52] hover:border-[#00E5FF] text-[#CBD5E1] hover:text-[#00E5FF] text-xs font-mono-num transition-colors cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">ОБНОВИТЬ</span>
            </button>
            <button
              type="button"
              onClick={() => {
                soundEngine.playMenuMove();
                onClose();
              }}
              aria-label="Закрыть таблицу рекордов"
              className="p-1.5 bg-[#1B1320] border border-[#FF2A85]/70 text-[#FDA4AF] hover:bg-[#FF2A85] hover:text-white transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Arcade KPI Summary Strip */}
        <div className="grid grid-cols-3 border-b border-[#1E293B] bg-[#0D1420] font-mono-num">
          <div className="px-3 sm:px-5 py-2.5 border-r border-[#1E293B]">
            <div className="text-[10px] tracking-[0.14em] text-[#94A3B8] uppercase">
              ЧЕМПИОН #1
            </div>
            <div className="text-sm sm:text-base font-bold text-[#FDE047] truncate flex items-center gap-1.5 mt-0.5">
              {topChampion ? (
                <>
                  <Crown className="w-3.5 h-3.5 shrink-0 text-[#FDE047]" />
                  <span className="truncate">{topChampion.name}</span>
                </>
              ) : (
                <span className="text-[#64748B]">—</span>
              )}
            </div>
          </div>

          <div className="px-3 sm:px-5 py-2.5 border-r border-[#1E293B]">
            <div className="text-[10px] tracking-[0.14em] text-[#94A3B8] uppercase">
              МАКС. СЧЁТ
            </div>
            <div className="text-sm sm:text-base font-bold text-[#39FF14] tabular-nums mt-0.5">
              {topChampion ? topChampion.score.toLocaleString('ru-RU') : '0'}
            </div>
          </div>

          <div className="px-3 sm:px-5 py-2.5">
            <div className="text-[10px] tracking-[0.14em] text-[#94A3B8] uppercase">
              ТВОЙ РЕКОРД · ЗАПИСЕЙ
            </div>
            <div className="text-sm sm:text-base font-bold text-[#00E5FF] tabular-nums mt-0.5">
              {personalBest.toLocaleString('ru-RU')}{' '}
              <span className="text-xs text-[#64748B] font-normal">/ {total}</span>
            </div>
          </div>
        </div>

        {/* Scrollable Ranked Table */}
        <div className="flex-1 overflow-y-auto px-3 sm:px-5 py-3">
          {loading && entries.length === 0 ? (
            <div className="py-12 text-center font-mono-num text-xs text-[#94A3B8] tracking-widest">
              ЗАГРУЗКА ЗАЛА СЛАВЫ...
            </div>
          ) : entries.length === 0 ? (
            <div className="py-12 text-center flex flex-col items-center gap-2">
              <Trophy className="w-8 h-8 text-[#334155]" />
              <div className="font-display text-sm tracking-[0.14em] text-[#CBD5E1]">
                ТАБЛИЦА ПОКА ПУСТА
              </div>
              <p className="font-mono-num text-xs text-[#64748B] max-w-md">
                Пройди игру и впиши своё имя прямо на финальной заставке — стань первым чемпионом!
              </p>
            </div>
          ) : (
            <table className="w-full border-collapse font-mono-num text-xs sm:text-sm">
              <thead>
                <tr className="border-b border-[#243247] text-[10px] sm:text-[11px] text-[#64748B] tracking-[0.14em] uppercase text-left">
                  <th className="py-2 pr-2 w-12">РАНГ</th>
                  <th className="py-2 pr-2">ИГРОК</th>
                  <th className="py-2 pr-2 hidden sm:table-cell">БОЙЦЫ</th>
                  <th className="py-2 pr-2 hidden md:table-cell">РЕЖИМ</th>
                  <th className="py-2 pr-2 text-right">ОЧКИ</th>
                  <th className="py-2 text-right w-14 hidden sm:table-cell">ДАТА</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((entry, idx) => {
                  const rank = idx + 1;
                  const isHighlighted = highlightEntryId === entry.id;
                  const rankColor =
                    rank === 1
                      ? 'text-[#FDE047]'
                      : rank === 2
                        ? 'text-[#E2E8F0]'
                        : rank === 3
                          ? 'text-[#FB923C]'
                          : 'text-[#64748B]';
                  const diffInfo = DIFF_META[entry.difficulty] ?? DIFF_META.normal;
                  return (
                    <tr
                      key={entry.id}
                      className={`border-b border-[#162030] transition-colors ${
                        isHighlighted
                          ? 'bg-[#173222]/85'
                          : rank === 1
                            ? 'bg-[#211C0D]/55'
                            : 'hover:bg-[#121B2B]/65'
                      }`}
                    >
                      <td className={`py-2.5 pr-2 font-bold tabular-nums ${rankColor}`}>
                        #{rank}
                      </td>
                      <td className="py-2.5 pr-2">
                        <div className="font-display font-bold tracking-wider text-[#F8FAFC] flex items-center gap-1.5">
                          <span className="truncate max-w-[140px] sm:max-w-[200px]">
                            {entry.name}
                          </span>
                          {isHighlighted && (
                            <span className="text-[10px] font-mono-num px-1.5 py-0.5 bg-[#39FF14] text-[#090C11] font-bold">
                              ВЫ
                            </span>
                          )}
                        </div>
                        <div className="sm:hidden text-[10px] text-[#94A3B8] mt-0.5 flex items-center gap-1.5">
                          <span>
                            {entry.heroes
                              .map((hId) => HERO_MAP.get(hId as HeroId)?.name ?? hId.toUpperCase())
                              .join(' + ')}
                          </span>
                          <span>·</span>
                          <span className="uppercase">{entry.difficulty}</span>
                        </div>
                      </td>
                      <td className="py-2.5 pr-2 hidden sm:table-cell">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {entry.heroes.map((hId) => {
                            const hero = HERO_MAP.get(hId as HeroId);
                            return (
                              <span
                                key={hId}
                                className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-[#111927] border border-[#243247] text-[11px] text-[#CBD5E1]"
                              >
                                <span
                                  className="w-2 h-2 inline-block shrink-0"
                                  style={{ backgroundColor: hero?.palette.accent ?? '#39FF14' }}
                                />
                                {hero?.name ?? hId.toUpperCase()}
                              </span>
                            );
                          })}
                        </div>
                      </td>
                      <td className="py-2.5 pr-2 hidden md:table-cell">
                        <div className="flex items-center gap-1.5">
                          <span className={`px-1.5 py-0.5 text-[10px] font-bold border ${diffInfo.cls}`}>
                            {diffInfo.label}
                          </span>
                          <span className="text-[11px] text-[#94A3B8]">
                            {MODE_LABELS[entry.mode] ?? '1P'}
                          </span>
                        </div>
                      </td>
                      <td className="py-2.5 pr-2 text-right font-bold tabular-nums text-[#39FF14]">
                        {entry.score.toLocaleString('ru-RU')}
                      </td>
                      <td className="py-2.5 text-right text-[11px] text-[#64748B] tabular-nums hidden sm:table-cell">
                        {formatDateShort(entry.createdAt)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Footer */}
        <div className="px-4 sm:px-5 py-2.5 bg-[#0D1420] border-t border-[#1E293B] flex items-center justify-between gap-2 text-[11px] font-mono-num text-[#64748B]">
          <span>ESC / B — ЗАКРЫТЬ</span>
          <button
            type="button"
            onClick={() => {
              soundEngine.playMenuMove();
              onClose();
            }}
            className="px-3.5 py-1 bg-[#141E2E] border border-[#39FF14]/70 text-[#39FF14] hover:bg-[#39FF14] hover:text-[#090C11] font-bold transition-colors cursor-pointer"
          >
            ЗАКРЫТЬ
          </button>
        </div>
      </div>
    </div>
  );
};
