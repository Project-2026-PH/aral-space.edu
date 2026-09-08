import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  enforceTwoSentences,
  buildFallbackExplanation,
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

    it('injects Think of prefix if model missed it', () => {
      const input = 'WEP is an outdated standard. EAP is an authentication framework.';
      const result = enforceTwoSentences(input, 'WEP', 'EAP');
      expect(result.startsWith('Think of WEP as the correct standard, while EAP serves a different function.')).toBe(true);
    });

    it('cleans assistant tags and markdown code blocks', () => {
      const input = '<|im_start|>assistant\n```text\nThink of WEP as a key, while EAP is a badge. WEP was deprecated due to flaws.\n```<|im_end|>';
      const result = enforceTwoSentences(input, 'WEP', 'EAP');
      expect(result).toBe('Think of WEP as a key, while EAP is a badge. WEP was deprecated due to flaws.');
    });
  });

  describe('buildFallbackExplanation', () => {
    it('builds clear 2-sentence explanation from database strings', () => {
      const fallback = buildFallbackExplanation(
        'WEP',
        'EAP',
        'Wired Equivalent Privacy was designed to provide data confidentiality.',
        'Extensible Authentication Protocol provides key transport.'
      );
      expect(fallback).toContain('Think of WEP as Wired Equivalent Privacy was designed to provide data confidentiality');
      expect(fallback).toContain('while EAP is Extensible Authentication Protocol provides key transport');
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
