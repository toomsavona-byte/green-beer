import { onlineClient } from './net';
import { DifficultyId, HeroId } from './types';

function getLeaderboardApiUrl(): string {
  const base = onlineClient.getHttpBaseUrl();
  return base ? `${base}/api/leaderboard` : '/api/leaderboard';
}

export type LeaderboardMode = '1p' | '2p' | 'online';

export interface LeaderboardEntry {
  id: string;
  name: string;
  score: number;
  heroes: HeroId[];
  difficulty: DifficultyId;
  mode: LeaderboardMode;
  createdAt: number;
}

export interface LeaderboardSubmission {
  name: string;
  score: number;
  heroes: HeroId[];
  difficulty: DifficultyId;
  mode: LeaderboardMode;
}

export interface LeaderboardSubmitResult {
  entry: LeaderboardEntry;
  rank: number | null;
  entries: LeaderboardEntry[];
  savedToServer: boolean;
}

const LOCAL_BOARD_KEY = 'green_beer_pizedes_leaderboard_v1';
const LAST_NAME_KEY = 'green_beer_pizedes_last_player_name_v1';

function sortEntries(list: LeaderboardEntry[]): LeaderboardEntry[] {
  return [...list].sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return a.createdAt - b.createdAt;
  });
}

function readLocalBoard(): LeaderboardEntry[] {
  try {
    const raw = window.localStorage.getItem(LOCAL_BOARD_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return sortEntries(
      parsed.filter(
        (item): item is LeaderboardEntry =>
          Boolean(item) &&
          typeof item.id === 'string' &&
          typeof item.name === 'string' &&
          typeof item.score === 'number'
      )
    ).slice(0, 25);
  } catch {
    return [];
  }
}

function writeLocalBoard(entries: LeaderboardEntry[]): void {
  try {
    window.localStorage.setItem(LOCAL_BOARD_KEY, JSON.stringify(sortEntries(entries).slice(0, 25)));
  } catch {
    // Ignore storage quota errors
  }
}

export function loadLastPlayerName(): string {
  try {
    return window.localStorage.getItem(LAST_NAME_KEY) ?? '';
  } catch {
    return '';
  }
}

export function saveLastPlayerName(name: string): void {
  try {
    window.localStorage.setItem(LAST_NAME_KEY, name.trim().slice(0, 18));
  } catch {
    // Ignore storage quota errors
  }
}

export async function fetchLeaderboard(): Promise<{
  entries: LeaderboardEntry[];
  total: number;
  fromServer: boolean;
}> {
  try {
    const res = await fetch(getLeaderboardApiUrl(), {
      method: 'GET',
      headers: { Accept: 'application/json' },
      cache: 'no-store',
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = (await res.json()) as { entries?: LeaderboardEntry[]; total?: number };
    const entries = Array.isArray(data.entries) ? sortEntries(data.entries) : [];
    writeLocalBoard(entries);
    return {
      entries,
      total: typeof data.total === 'number' ? data.total : entries.length,
      fromServer: true,
    };
  } catch {
    const local = readLocalBoard();
    return { entries: local, total: local.length, fromServer: false };
  }
}

export async function submitLeaderboardScore(
  payload: LeaderboardSubmission
): Promise<LeaderboardSubmitResult> {
  const cleanName = payload.name.replace(/[\u0000-\u001F\u007F<>]/g, '').replace(/\s+/g, ' ').trim().slice(0, 18);
  if (!cleanName) {
    throw new Error('Введите имя игрока');
  }
  saveLastPlayerName(cleanName);

  const normalizedScore = Math.max(0, Math.min(99_999_999, Math.floor(payload.score)));
  const normalizedHeroes: HeroId[] = payload.heroes.length > 0 ? payload.heroes.slice(0, 2) : ['vadek'];

  try {
    const res = await fetch(getLeaderboardApiUrl(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        name: cleanName,
        score: normalizedScore,
        heroes: normalizedHeroes,
        difficulty: payload.difficulty,
        mode: payload.mode,
      }),
    });

    const data = (await res.json()) as {
      entry?: LeaderboardEntry;
      rank?: number | null;
      entries?: LeaderboardEntry[];
      error?: string;
    };

    if (!res.ok || !data.entry) {
      throw new Error(data.error || `HTTP ${res.status}`);
    }

    const entries = Array.isArray(data.entries) ? sortEntries(data.entries) : readLocalBoard();
    writeLocalBoard(entries);
    return {
      entry: data.entry,
      rank: typeof data.rank === 'number' ? data.rank : null,
      entries,
      savedToServer: true,
    };
  } catch {
    // Graceful offline fallback so PWA / offline players never lose their record
    const localEntry: LeaderboardEntry = {
      id: `local_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      name: cleanName,
      score: normalizedScore,
      heroes: normalizedHeroes,
      difficulty: payload.difficulty,
      mode: payload.mode,
      createdAt: Date.now(),
    };
    const merged = sortEntries([...readLocalBoard(), localEntry]).slice(0, 25);
    writeLocalBoard(merged);
    const rankIdx = merged.findIndex((e) => e.id === localEntry.id);
    return {
      entry: localEntry,
      rank: rankIdx >= 0 ? rankIdx + 1 : null,
      entries: merged,
      savedToServer: false,
    };
  }
}
