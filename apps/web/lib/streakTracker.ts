'use client';

export interface SessionStreakHistory {
  date: string;
  mode: string;
  bestStreak: number;
  finalStreak: number;
  totalQuestions: number;
}

export interface QuizStreakRecord {
  quizId: string;
  allTimeBestStreak: number;
  totalSessions: number;
  sessions: SessionStreakHistory[];
  lastUpdated: string;
}

const STORAGE_KEY = 'quizmaster_streak_records';

function loadAllRecords(): Record<string, QuizStreakRecord> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveAllRecords(records: Record<string, QuizStreakRecord>): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
  } catch (err) {
    console.error('Failed to save streak records:', err);
  }
}

export function getQuizStreakRecord(quizId: string): QuizStreakRecord {
  const records = loadAllRecords();
  return (
    records[quizId] || {
      quizId,
      allTimeBestStreak: 0,
      totalSessions: 0,
      sessions: [],
      lastUpdated: new Date().toISOString()
    }
  );
}

export function recordSessionCompletion(
  quizId: string,
  mode: string,
  bestStreak: number,
  finalStreak: number,
  totalQuestions: number
): QuizStreakRecord {
  const records = loadAllRecords();
  const existing = records[quizId] || {
    quizId,
    allTimeBestStreak: 0,
    totalSessions: 0,
    sessions: [],
    lastUpdated: new Date().toISOString()
  };

  const newBest = Math.max(existing.allTimeBestStreak, bestStreak);
  const sessionEntry: SessionStreakHistory = {
    date: new Date().toISOString(),
    mode,
    bestStreak,
    finalStreak,
    totalQuestions
  };

  const updated: QuizStreakRecord = {
    quizId,
    allTimeBestStreak: newBest,
    totalSessions: existing.totalSessions + 1,
    sessions: [sessionEntry, ...existing.sessions].slice(0, 30), // keep latest 30 sessions
    lastUpdated: new Date().toISOString()
  };

  records[quizId] = updated;
  saveAllRecords(records);
  return updated;
}
