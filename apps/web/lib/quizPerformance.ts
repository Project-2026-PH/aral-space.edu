import type { QuizMode } from '@quiz-creator/types';

export type QuizPerformanceMode = Extract<QuizMode, 'flashcard' | 'identification' | 'multiple_choice'>;
export type QuizQuestionStatus = 'correct' | 'incorrect' | 'unanswered';

export interface QuizPerformanceSnapshot {
  mode: QuizPerformanceMode;
  hasData: boolean;
  progressPercent: number;
  answeredCount: number;
  correctCount: number;
  averageScore: number;
  completedAttempts: number;
  questionStatuses: QuizQuestionStatus[];
  lastUpdated: string | null;
}

interface PersistedSession {
  answers: Record<string, boolean>;
}

interface PersistedModePerformance {
  questionOrder: string[];
  latestStatuses: Record<string, boolean>;
  activeSessions: Record<string, PersistedSession>;
  completedSessions: Array<{
    sessionId: string;
    score: number;
    answeredCount: number;
    completedAt: string;
  }>;
  lastUpdated: string;
}

type PerformanceStore = Record<string, Partial<Record<QuizPerformanceMode, PersistedModePerformance>>>;

const STORAGE_KEY = 'quizmaster_quiz_performance_v1';
export const QUIZ_PERFORMANCE_UPDATED_EVENT = 'quiz-performance-updated';

function isPerformanceMode(mode: QuizMode): mode is QuizPerformanceMode {
  return mode === 'flashcard' || mode === 'identification' || mode === 'multiple_choice';
}

function createModePerformance(): PersistedModePerformance {
  return {
    questionOrder: [],
    latestStatuses: {},
    activeSessions: {},
    completedSessions: [],
    lastUpdated: new Date().toISOString()
  };
}

function loadStore(): PerformanceStore {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as PerformanceStore;
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function saveStore(store: PerformanceStore): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  } catch {
    // Performance summaries are an enhancement and must never interrupt quiz use.
  }
}

function emitPerformanceUpdate(quizId: string): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(QUIZ_PERFORMANCE_UPDATED_EVENT, { detail: { quizId } }));
}

function getOrCreateMode(
  store: PerformanceStore,
  quizId: string,
  mode: QuizPerformanceMode
): PersistedModePerformance {
  const quizRecord = store[quizId] || {};
  const modeRecord = quizRecord[mode] || createModePerformance();
  store[quizId] = { ...quizRecord, [mode]: modeRecord };
  return modeRecord;
}

function roundPercent(value: number): number {
  return Math.min(100, Math.max(0, Math.round(value)));
}

export function createEmptyQuizPerformanceSnapshot(mode: QuizMode, questionCount: number): QuizPerformanceSnapshot {
  const safeQuestionCount = Math.max(0, questionCount);

  return {
    mode: isPerformanceMode(mode) ? mode : 'flashcard',
    hasData: false,
    progressPercent: 0,
    answeredCount: 0,
    correctCount: 0,
    averageScore: 0,
    completedAttempts: 0,
    questionStatuses: Array.from({ length: safeQuestionCount }, () => 'unanswered'),
    lastUpdated: null
  };
}

export function getQuizPerformanceSnapshot(
  quizId: string,
  mode: QuizMode,
  questionCount: number
): QuizPerformanceSnapshot {
  const safeQuestionCount = Math.max(0, questionCount);
  const empty = createEmptyQuizPerformanceSnapshot(mode, questionCount);

  if (typeof window === 'undefined' || !isPerformanceMode(mode)) return empty;

  const modeRecord = loadStore()[quizId]?.[mode];
  if (!modeRecord) return empty;

  const questionIds = modeRecord.questionOrder.filter((questionId) => questionId in modeRecord.latestStatuses);
  const answeredCount = questionIds.length;
  const correctCount = questionIds.filter((questionId) => modeRecord.latestStatuses[questionId]).length;
  const currentScore = answeredCount > 0 ? roundPercent((correctCount / answeredCount) * 100) : 0;
  const completedAttempts = modeRecord.completedSessions.length;
  const averageScore = completedAttempts > 0
    ? roundPercent(modeRecord.completedSessions.reduce((sum, session) => sum + session.score, 0) / completedAttempts)
    : currentScore;

  const statuses = modeRecord.questionOrder.map((questionId) => {
    if (!(questionId in modeRecord.latestStatuses)) return 'unanswered' as const;
    return modeRecord.latestStatuses[questionId] ? 'correct' as const : 'incorrect' as const;
  });
  while (statuses.length < safeQuestionCount) statuses.push('unanswered');

  return {
    mode,
    hasData: answeredCount > 0 || completedAttempts > 0,
    progressPercent: safeQuestionCount > 0 ? roundPercent((answeredCount / safeQuestionCount) * 100) : 0,
    answeredCount,
    correctCount,
    averageScore,
    completedAttempts,
    questionStatuses: statuses.slice(0, safeQuestionCount),
    lastUpdated: modeRecord.lastUpdated
  };
}

export function recordQuizPerformanceAnswer({
  quizId,
  mode,
  sessionId,
  questionId,
  isCorrect
}: {
  quizId: string;
  mode: QuizMode;
  sessionId: string;
  questionId: string;
  isCorrect: boolean;
}): void {
  if (typeof window === 'undefined' || !isPerformanceMode(mode)) return;

  const store = loadStore();
  const modeRecord = getOrCreateMode(store, quizId, mode);
  const existingSession = modeRecord.activeSessions[sessionId];
  const answers = { ...(existingSession?.answers || {}), [questionId]: isCorrect };

  // A new session starts a new question-status run. Reloading the same active session preserves it.
  if (!existingSession) modeRecord.latestStatuses = {};
  if (!modeRecord.questionOrder.includes(questionId)) modeRecord.questionOrder.push(questionId);
  modeRecord.latestStatuses[questionId] = isCorrect;
  modeRecord.activeSessions[sessionId] = { answers };
  modeRecord.lastUpdated = new Date().toISOString();
  store[quizId] = { ...store[quizId], [mode]: modeRecord };
  saveStore(store);
  emitPerformanceUpdate(quizId);
}

export function completeQuizPerformanceSession({
  quizId,
  mode,
  sessionId
}: {
  quizId: string;
  mode: QuizMode;
  sessionId: string;
}): void {
  if (typeof window === 'undefined' || !isPerformanceMode(mode)) return;

  const store = loadStore();
  const modeRecord = store[quizId]?.[mode];
  const session = modeRecord?.activeSessions[sessionId];
  if (!modeRecord || !session) return;

  const answerValues = Object.values(session.answers);
  const answeredCount = answerValues.length;
  const score = answeredCount > 0
    ? roundPercent((answerValues.filter(Boolean).length / answeredCount) * 100)
    : 0;

  modeRecord.completedSessions = [
    ...modeRecord.completedSessions.filter((entry) => entry.sessionId !== sessionId),
    { sessionId, score, answeredCount, completedAt: new Date().toISOString() }
  ].slice(-20);
  delete modeRecord.activeSessions[sessionId];
  modeRecord.lastUpdated = new Date().toISOString();
  saveStore(store);
  emitPerformanceUpdate(quizId);
}

export function resetQuizPerformanceSession({
  quizId,
  mode,
  sessionId
}: {
  quizId: string;
  mode: QuizMode;
  sessionId: string;
}): void {
  if (typeof window === 'undefined' || !isPerformanceMode(mode)) return;

  const store = loadStore();
  const modeRecord = store[quizId]?.[mode];
  if (!modeRecord) return;

  delete modeRecord.activeSessions[sessionId];
  modeRecord.latestStatuses = {};
  modeRecord.lastUpdated = new Date().toISOString();
  saveStore(store);
  emitPerformanceUpdate(quizId);
}

export function subscribeToQuizPerformance(
  quizId: string,
  callback: () => void
): () => void {
  if (typeof window === 'undefined') return () => undefined;

  const handleUpdate = (event: Event) => {
    const detail = (event as CustomEvent<{ quizId?: string }>).detail;
    if (!detail?.quizId || detail.quizId === quizId) callback();
  };
  const handleStorage = (event: StorageEvent) => {
    if (event.key === STORAGE_KEY) callback();
  };

  window.addEventListener(QUIZ_PERFORMANCE_UPDATED_EVENT, handleUpdate);
  window.addEventListener('storage', handleStorage);
  return () => {
    window.removeEventListener(QUIZ_PERFORMANCE_UPDATED_EVENT, handleUpdate);
    window.removeEventListener('storage', handleStorage);
  };
}
