import type {
  CardTelemetryRecord,
  PracticeSessionState,
  QuestionProgress,
  SessionType
} from '@quiz-creator/types';

export const QUIZ_PROGRESS_SNAPSHOT_VERSION = 1;
const QUIZ_PROGRESS_SNAPSHOT_PREFIX = 'quiz_creator_quiz_progress_v1';

export interface PersistedPendingAdvance {
  nextQueue: PracticeSessionState;
  progressEntries: Array<[string, QuestionProgress]>;
  recapQuestionIds: string[];
}

export interface PersistedAnswerEvent {
  id: string;
  sessionId: string;
  questionId: string;
  isCorrect: boolean;
  sessionType: SessionType;
  latencyMs: number;
  createdAt: string;
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
    if (
      parsed.version !== QUIZ_PROGRESS_SNAPSHOT_VERSION ||
      parsed.quizId !== quizId ||
      parsed.sessionId !== sessionId ||
      !isPracticeSessionState(parsed.queueState)
    ) {
      return null;
    }

    return {
      ...(parsed as Omit<QuizProgressSnapshot, 'progressEntries' | 'pendingAdvance'>),
      progressEntries: deserializeProgressEntries(parsed.progressEntries),
      pendingAdvance: isPendingAdvance(parsed.pendingAdvance)
        ? {
            ...parsed.pendingAdvance,
            progressEntries: deserializeProgressEntries(parsed.pendingAdvance.progressEntries)
          }
        : null
    };
  } catch {
    return null;
  }
}

export function writeQuizProgressSnapshot(snapshot: QuizProgressSnapshot): void {
  if (!isBrowserStorageAvailable()) return;

  try {
    window.localStorage.setItem(
      getSnapshotStorageKey(snapshot.quizId, snapshot.sessionId),
      JSON.stringify(snapshot)
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
