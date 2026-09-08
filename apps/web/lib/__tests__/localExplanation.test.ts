import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  enforceTwoSentences,
  buildFallbackExplanation,
  composeExplanation,
  findQuestionSetWrongChoiceExplanation,
} from '../ai/localExplanationEngine';
import {
  getExplanationPreferences,
  recordExplanationFeedback,
  getExplanationPromptModifiers,
} from '../ai/explanationPreferences';

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
    }),
  };
})();

Object.defineProperty(globalThis, 'window', {
  value: { localStorage: mockLocalStorage },
  writable: true,
});

Object.defineProperty(globalThis, 'localStorage', {
  value: mockLocalStorage,
  writable: true,
});

describe('localExplanationEngine', () => {
  describe('enforceTwoSentences', () => {
    it('truncates excess sentences to exactly two', () => {
      const input = 'Think of WEP as an old rusted lock, while EAP is an identity check. WEP encrypts data directly. This is a third sentence that should be removed.';
      const result = enforceTwoSentences(input, 'WEP', 'EAP');
      expect(result).toBe('Think of WEP as an old rusted lock, while EAP is an identity check. WEP encrypts data directly.');
      const sentenceCount = result.match(/[^.!?]+[.!?]+/g)?.length;
      expect(sentenceCount).toBe(2);
    });

    it('preserves clean two sentences when Think of is not at the start', () => {
      const input = 'WEP is an outdated standard. EAP is an authentication framework.';
      const result = enforceTwoSentences(input, 'WEP', 'EAP');
      expect(result).toBe('WEP is an outdated standard. EAP is an authentication framework.');
    });

    it('cleans assistant tags and markdown code blocks', () => {
      const input = '<|im_start|>assistant\n```text\nThink of WEP as a key, while EAP is a badge. WEP was deprecated due to flaws.\n```<|im_end|>';
      const result = enforceTwoSentences(input, 'WEP', 'EAP');
      expect(result).toBe('Think of WEP as a key, while EAP is a badge. WEP was deprecated due to flaws.');
    });
  });

  describe('buildFallbackExplanation', () => {
    it('resolves statement-style stems to the supplied correct answer', () => {
      const fallback = buildFallbackExplanation(
        'AWS Points of Presence',
        'Edge locations',
        null,
        null,
        'This extends selected AWS services closer to end users.'
      );

      expect(fallback).toBe(
        'AWS Points of Presence extends selected AWS services closer to end users. No trusted explanation is stored for why Edge locations is incorrect.'
      );
    });

    it('keeps the correct answer visible for question-style stems without an explanation', () => {
      const fallback = buildFallbackExplanation(
        'Mitochondria',
        'Ribosome',
        null,
        null,
        'Which organelle produces most of the cell chemical energy?'
      );

      expect(fallback).toContain('Mitochondria is the answer for');
      expect(fallback).toContain('no trusted explanation is stored for why Ribosome is incorrect');
    });
    it('states when no trusted wrong-choice explanation is available', () => {
      const explanation = composeExplanation(
        'Amazon CloudFront is a content delivery network.',
        'Amazon CloudFront',
        'Regional edge caches',
        ''
      );

      expect(explanation).toContain('no trusted explanation is stored for why Regional edge caches is incorrect');
    });

    it('finds where a wrong choice is correct in the designated question set', () => {
      const evidence = findQuestionSetWrongChoiceExplanation(
        'Regional edge caches',
        'current-question',
        [
          {
            id: 'current-question',
            question_text: 'This is a content delivery network.',
            options: ['Amazon CloudFront', 'Regional edge caches'],
            correct_answer: 0,
          },
          {
            id: 'other-question',
            question_text: 'Which AWS feature caches content near users?',
            options: ['Regional edge caches', 'Amazon CloudFront'],
            correct_answer: 0,
            correct_explanation: 'Regional edge caches store content closer to users before it reaches edge locations.',
          },
        ]
      );

      expect(evidence).toContain('"Regional edge caches" states "Which AWS feature caches content near users"');
      expect(evidence).toContain('Which AWS feature caches content near users');
      expect(evidence).toContain('Regional edge caches store content closer to users');
    });
  });
});

describe('explanationPreferences', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('records upvotes and downvotes without error', () => {
    const guestId = 'test-guest-1';
    recordExplanationFeedback(guestId, { questionId: 'q1', rating: 'up' });
    let prefs = getExplanationPreferences(guestId);
    expect(prefs.upvotes).toBe(1);
    expect(prefs.downvotes).toBe(0);

    recordExplanationFeedback(guestId, { questionId: 'q2', rating: 'down', reason: 'too_complex' });
    prefs = getExplanationPreferences(guestId);
    expect(prefs.upvotes).toBe(1);
    expect(prefs.downvotes).toBe(1);
    expect(prefs.simplicityBias).toBeGreaterThan(0);
  });

  it('generates simplicity prompt modifiers when downvotes for complexity occur', () => {
    const guestId = 'test-guest-2';
    recordExplanationFeedback(guestId, { questionId: 'q1', rating: 'down', reason: 'too_complex' });
    const modifiers = getExplanationPromptModifiers(guestId);
    expect(modifiers).toContain('ultra-simple');
  });
});
