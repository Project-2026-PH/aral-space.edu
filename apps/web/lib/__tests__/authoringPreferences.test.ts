import { describe, expect, it, beforeEach, vi } from 'vitest';
import {
  getAuthoringPreferencesKey,
  loadLocalAuthoringSignals,
  recordLocalAuthoringEvent,
  makeAuthoringQuestionSnapshot,
  setClientUserId
} from '../authoringPreferences';

const mockLocalStorage = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => store[key] ?? null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = String(value);
    }),
    clear: vi.fn(() => {
      store = {};
    }),
    removeItem: vi.fn((key: string) => {
      delete store[key];
    })
  };
})();

Object.defineProperty(globalThis, 'window', {
  value: { localStorage: mockLocalStorage },
  writable: true
});

Object.defineProperty(globalThis, 'localStorage', {
  value: mockLocalStorage,
  writable: true
});

describe('authoringPreferences scoped storage', () => {
  beforeEach(() => {
    mockLocalStorage.clear();
  });

  it('generates correct user and subject scoped keys', () => {
    expect(getAuthoringPreferencesKey('user-123')).toBe(
      'quiz-creator:authoring-preferences:v2:user:user-123'
    );
    expect(getAuthoringPreferencesKey('user-123', 'sub-math')).toBe(
      'quiz-creator:authoring-preferences:v2:user:user-123:subject:sub-math'
    );
    expect(getAuthoringPreferencesKey(null, null)).toBe(
      'quiz-creator:authoring-preferences:v2:global'
    );
  });

  it('migrates legacy v1 preferences on first read', () => {
    const legacy = {
      version: 1,
      observationCount: 4,
      createCount: 4,
      editCount: 0,
      deleteCount: 0,
      averageQuestionLength: 15,
      averageOptionCount: 4,
      averageExplanationLength: 45,
      questionTypeCounts: {
        multiple_choice: 4,
        typed_answer: 0,
        identification: 0,
        true_false: 0,
        enumeration: 0
      }
    };
    window.localStorage.setItem('quiz-creator:authoring-preferences:v1', JSON.stringify(legacy));

    const signals = loadLocalAuthoringSignals({ userId: 'user-legacy' });
    expect(signals.observationCount).toBe(4);
    expect(signals.averageQuestionLength).toBe(15);

    // Verify written to new v2 key
    const v2Raw = window.localStorage.getItem('quiz-creator:authoring-preferences:v2:user:user-legacy');
    expect(v2Raw).not.toBeNull();
  });

  it('records events to both subject and global user buckets, with subject fallback', () => {
    setClientUserId('user-multi');

    // Record 2 questions under Subject A
    for (let i = 0; i < 2; i++) {
      recordLocalAuthoringEvent(
        {
          action: 'create',
          after: makeAuthoringQuestionSnapshot('multiple_choice', 'What is X?', ['A', 'B'], 'Short')
        },
        { userId: 'user-multi', subjectId: 'subject-a' }
      );
    }

    // Subject A only has 2 observations (< 3 threshold), so loadLocalAuthoringSignals should fall back to global
    let signalsForSubjectA = loadLocalAuthoringSignals({ userId: 'user-multi', subjectId: 'subject-a' });
    // Global has 2 observations (also < 3), so observationCount is 2
    expect(signalsForSubjectA.observationCount).toBe(2);

    // Record 3rd question under Subject A with 2 options
    recordLocalAuthoringEvent(
      {
        action: 'create',
        after: makeAuthoringQuestionSnapshot('multiple_choice', 'What is Y?', ['A', 'B'], 'Short')
      },
      { userId: 'user-multi', subjectId: 'subject-a' }
    );

    // Now Subject A has 3 observations (confident threshold met)
    signalsForSubjectA = loadLocalAuthoringSignals({ userId: 'user-multi', subjectId: 'subject-a' });
    expect(signalsForSubjectA.observationCount).toBe(3);
    expect(signalsForSubjectA.averageOptionCount).toBe(2);

    // An unobserved Subject B falls back to global signals
    const signalsForSubjectB = loadLocalAuthoringSignals({ userId: 'user-multi', subjectId: 'subject-b' });
    expect(signalsForSubjectB.observationCount).toBe(3);
  });
});
