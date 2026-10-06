import { beforeEach, describe, expect, it } from 'vitest';
import {
  readQuizProgressSnapshot,
  type QuizProgressSnapshot
} from '../quizProgressPersistence';

class MemoryStorage {
  private values = new Map<string, string>();
  getItem(key: string): string | null { return this.values.get(key) || null; }
  setItem(key: string, value: string): void { this.values.set(key, value); }
  removeItem(key: string): void { this.values.delete(key); }
}

const storage = new MemoryStorage();
const key = 'quiz_creator_quiz_progress_v1:quiz-1:session-1';

function baseSnapshot(version = 2): QuizProgressSnapshot {
  return {
    version,
    quizId: 'quiz-1',
    sessionId: 'session-1',
    queueState: { activeQueue: ['question-1'], completed: [], strugglePile: [], attemptsByQuestion: {} },
    progressEntries: [],
    accumulatedStruggleIds: [],
    isStruggleReviewMode: false,
    evaluatedCardIds: [],
    pendingAdvance: null,
    isRecapVisible: false,
    isEvaluating: false,
    isCardFlipped: false,
    selectedOptionId: null,
    identificationInput: '',
    identificationSubmitted: false,
    typedAnswerCorrect: null,
    answerResult: null,
    correctAnswerIds: [],
    feedbackMessage: null,
    isHintVisible: false,
    isExplanationVisible: false,
    isCompleted: false,
    cardTelemetry: {},
    pendingAnswerEvents: [],
    enumerationByPresentation: {},
    savedAt: new Date().toISOString()
  };
}

beforeEach(() => {
  storage.removeItem(key);
  (globalThis as { window?: unknown }).window = { localStorage: storage };
});

describe('quiz progress enumeration persistence', () => {
  it('migrates version one snapshots with an empty enumeration map', () => {
    const snapshot = baseSnapshot(1);
    const legacy = { ...snapshot } as Record<string, unknown>;
    delete legacy.enumerationByPresentation;
    storage.setItem(key, JSON.stringify(legacy));

    const loaded = readQuizProgressSnapshot('quiz-1', 'session-1');
    expect(loaded?.version).toBe(2);
    expect(loaded?.enumerationByPresentation).toEqual({});
  });

  it('drops malformed records without discarding valid records', () => {
    const snapshot = baseSnapshot();
    snapshot.enumerationByPresentation = {
      valid: {
        questionId: 'question-1',
        presentationKey: 'valid',
        total: 2,
        canonicalKeys: ['a', 'b'],
        attempts: [],
        attemptedKeys: [],
        correctKeys: [],
        wrongKeys: [],
        status: 'active',
        verdict: null,
        lastFeedback: null
      },
      malformed: { total: 'not-a-number' } as never
    };
    storage.setItem(key, JSON.stringify(snapshot));

    const loaded = readQuizProgressSnapshot('quiz-1', 'session-1');
    expect(Object.keys(loaded?.enumerationByPresentation || {})).toEqual(['valid']);
  });
});
