import type {
  CardTelemetryRecord,
  PracticeSessionState,
  QuestionProgress,
  SessionType
} from '@quiz-creator/types';

export const QUIZ_PROGRESS_SNAPSHOT_VERSION = 2;
const QUIZ_PROGRESS_SNAPSHOT_PREFIX = 'quiz_creator_quiz_progress_v1';
const QUIZ_PROGRESS_RETENTION_MS = 24 * 60 * 60 * 1000;

export interface PersistedPendingAdvance {
  nextQueue: PracticeSessionState;
  progressEntries: Array<[string, QuestionProgress]>;
  recapQuestionIds: string[];
}

export interface PersistedAnswerEvent {
  id: string;
  sessionId: string;
  questionId: string;
  /** Legacy events may only contain isCorrect; new events carry the submitted answer. */
  isCorrect: boolean;
  selectedOptionId?: number;
  answerText?: string;
  answerMode?: 'learn' | 'identification';
  sessionType: SessionType;
  latencyMs: number;
  createdAt: string;
}

export interface PersistedEnumerationAttempt {
  key: string;
  rawValue: string;
  isCorrect: boolean;
  sequence: number;
  feedback: 'correct' | 'incorrect';
}

export interface PersistedEnumerationRecord {
  questionId: string;
  presentationKey: string;
  total: number;
  canonicalKeys: string[];
  attempts: PersistedEnumerationAttempt[];
  attemptedKeys: string[];
  correctKeys: string[];
  wrongKeys: string[];
  status: 'active' | 'complete' | 'unavailable';
  verdict: boolean | null;
  lastFeedback: 'correct' | 'incorrect' | null;
}

export interface QuizProgressSnapshot {
  version: number;
  quizId: string;
  sessionId: string;
  queueState: PracticeSessionState;
  progressEntries: Array<[string, QuestionProgress]>;
  accumulatedStruggleIds: string[];
  isStruggleReviewMode: boolean;
  evaluatedCardIds: string[];
  pendingAdvance: PersistedPendingAdvance | null;
  isRecapVisible: boolean;
  isEvaluating: boolean;
  isCardFlipped: boolean;
  selectedOptionId: number | null;
  identificationInput: string;
  identificationSubmitted: boolean;
  typedAnswerCorrect: boolean | null;
  answerResult: boolean | null;
  correctAnswerIds: string[];
  feedbackMessage: string | null;
  isHintVisible: boolean;
  isExplanationVisible: boolean;
  isCompleted: boolean;
  cardTelemetry: Record<string, CardTelemetryRecord>;
  pendingAnswerEvents: PersistedAnswerEvent[];
  enumerationByPresentation: Record<string, PersistedEnumerationRecord>;
  savedAt: string;
}

function getSnapshotStorageKey(quizId: string, sessionId: string): string {
  return `${QUIZ_PROGRESS_SNAPSHOT_PREFIX}:${encodeURIComponent(quizId)}:${encodeURIComponent(sessionId)}`;
}

function isBrowserStorageAvailable(): boolean {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isPracticeSessionState(value: unknown): value is PracticeSessionState {
  if (!isRecord(value)) return false;
  return (
    Array.isArray(value.activeQueue) &&
    Array.isArray(value.completed) &&
    Array.isArray(value.strugglePile) &&
    isRecord(value.attemptsByQuestion) &&
    (value.unservedQueue === undefined || Array.isArray(value.unservedQueue))
  );
}

function isQuestionProgress(value: unknown): value is QuestionProgress {
  return isRecord(value) && typeof value.question_id === 'string' && typeof value.session_id === 'string';
}

function deserializeProgressEntries(value: unknown): Array<[string, QuestionProgress]> {
  if (!Array.isArray(value)) return [];

  return value.filter((entry): entry is [string, QuestionProgress] => (
    Array.isArray(entry) &&
    typeof entry[0] === 'string' &&
    isQuestionProgress(entry[1])
  ));
}

function isPendingAdvance(value: unknown): value is PersistedPendingAdvance {
  return (
    isRecord(value) &&
    isPracticeSessionState(value.nextQueue) &&
    Array.isArray(value.recapQuestionIds) &&
    value.recapQuestionIds.every((id) => typeof id === 'string')
  );
}

function isEnumerationAttempt(value: unknown): value is PersistedEnumerationAttempt {
  return isRecord(value)
    && typeof value.key === 'string'
    && typeof value.rawValue === 'string'
    && typeof value.isCorrect === 'boolean'
    && Number.isInteger(value.sequence)
    && (value.feedback === 'correct' || value.feedback === 'incorrect');
}

function isEnumerationRecord(value: unknown): value is PersistedEnumerationRecord {
  return isRecord(value)
    && typeof value.questionId === 'string'
    && typeof value.presentationKey === 'string'
    && typeof value.total === 'number'
    && Number.isSafeInteger(value.total)
    && value.total > 0
    && Array.isArray(value.canonicalKeys)
    && value.canonicalKeys.every((key) => typeof key === 'string')
    && Array.isArray(value.attempts)
    && value.attempts.every(isEnumerationAttempt)
    && Array.isArray(value.attemptedKeys)
    && value.attemptedKeys.every((key) => typeof key === 'string')
    && Array.isArray(value.correctKeys)
    && value.correctKeys.every((key) => typeof key === 'string')
    && Array.isArray(value.wrongKeys)
    && value.wrongKeys.every((key) => typeof key === 'string')
    && (value.status === 'active' || value.status === 'complete' || value.status === 'unavailable')
    && (value.verdict === null || typeof value.verdict === 'boolean')
    && (value.lastFeedback === null || value.lastFeedback === 'correct' || value.lastFeedback === 'incorrect');
}

function deserializeEnumerationRecords(value: unknown): Record<string, PersistedEnumerationRecord> {
  if (!isRecord(value)) return {};
  return Object.fromEntries(
    Object.entries(value).filter(([, record]) => isEnumerationRecord(record))
  ) as Record<string, PersistedEnumerationRecord>;
}

export function readQuizProgressSnapshot(
  quizId: string,
  sessionId: string
): QuizProgressSnapshot | null {
  if (!isBrowserStorageAvailable()) return null;

  try {
    const raw = window.localStorage.getItem(getSnapshotStorageKey(quizId, sessionId));
    if (!raw) return null;

    const parsed: unknown = JSON.parse(raw);
    if (!isRecord(parsed)) return null;
    const isCurrentVersion = parsed.version === QUIZ_PROGRESS_SNAPSHOT_VERSION;
    const isMigratableVersion = parsed.version === 1;
    if (
      (!isCurrentVersion && !isMigratableVersion) ||
      parsed.quizId !== quizId ||
      parsed.sessionId !== sessionId ||
      !isPracticeSessionState(parsed.queueState)
    ) {
      return null;
    }
    const savedAt = typeof parsed.savedAt === 'string' ? Date.parse(parsed.savedAt) : NaN;
    if (!Number.isFinite(savedAt) || Date.now() - savedAt > QUIZ_PROGRESS_RETENTION_MS) {
      window.localStorage.removeItem(getSnapshotStorageKey(quizId, sessionId));
      return null;
    }

    return {
      ...(parsed as Omit<QuizProgressSnapshot, 'progressEntries' | 'pendingAdvance' | 'enumerationByPresentation' | 'version'>),
      version: QUIZ_PROGRESS_SNAPSHOT_VERSION,
      progressEntries: deserializeProgressEntries(parsed.progressEntries),
      pendingAdvance: isPendingAdvance(parsed.pendingAdvance)
        ? {
            ...parsed.pendingAdvance,
            progressEntries: deserializeProgressEntries(parsed.pendingAdvance.progressEntries)
          }
        : null,
      // Version 1 did not persist this state. Invalid records are isolated to
      // their presentation instead of invalidating the ordinary session.
      enumerationByPresentation: isCurrentVersion
        ? deserializeEnumerationRecords(parsed.enumerationByPresentation)
        : {}
    };
  } catch {
    return null;
  }
}

export function writeQuizProgressSnapshot(snapshot: QuizProgressSnapshot): void {
  if (!isBrowserStorageAvailable()) return;

  try {
    const safeSnapshot: QuizProgressSnapshot = {
      ...snapshot,
      version: QUIZ_PROGRESS_SNAPSHOT_VERSION,
      // Do not retain a user's free-form answer after the session snapshot is written.
      identificationInput: '',
      pendingAnswerEvents: snapshot.pendingAnswerEvents.slice(-50).map(({ answerText: _answerText, ...event }) => event),
      savedAt: new Date().toISOString()
    };
    window.localStorage.setItem(
      getSnapshotStorageKey(snapshot.quizId, snapshot.sessionId),
      JSON.stringify(safeSnapshot)
    );
  } catch (error) {
    console.warn('[QuizRunner] Failed to save local quiz progress:', error);
  }
}

export function removeQuizProgressSnapshot(quizId: string, sessionId: string): void {
  if (!isBrowserStorageAvailable()) return;

  try {
    window.localStorage.removeItem(getSnapshotStorageKey(quizId, sessionId));
  } catch (error) {
    console.warn('[QuizRunner] Failed to clear local quiz progress:', error);
  }
}

export function createAnswerEventId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }

  return `answer-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}
