import { describe, it, expect } from 'vitest';
import type { QuizQuestion } from '@quiz-creator/types';
import {
  evaluateTypedAnswer,
  getQuestionAnswer,
  getQuestionHint,
  normalizeTypedAnswer
} from '../quizAnswerEvaluation';

function makeQuestion(partial: Partial<QuizQuestion>): QuizQuestion {
  return {
    id: 'q-1',
    quiz_id: 'quiz-1',
    question_text: 'What is photosynthesis?',
    options: ['Process by plants', 'Cell division', 'Respiration', 'Digestion'],
    correct_answer: 0,
    order_index: 0,
    ...partial
  };
}

describe('quizAnswerEvaluation', () => {
  describe('getQuestionAnswer', () => {
    it('uses explicit answer_text when present', () => {
      const q = makeQuestion({ answer_text: 'Explicit Answer' });
      expect(getQuestionAnswer(q)).toBe('Explicit Answer');
    });

    it('falls back to options[correct_answer] when answer_text absent', () => {
      const q = makeQuestion({ answer_text: undefined, correct_answer: 1 });
      expect(getQuestionAnswer(q)).toBe('Cell division');
    });

    it('returns empty string if no answer found', () => {
      const q = makeQuestion({ answer_text: undefined, options: [], correct_answer: 0 });
      expect(getQuestionAnswer(q)).toBe('');
    });
  });

  describe('normalizeTypedAnswer', () => {
    it('trims and lowercases in identification mode', () => {
      expect(normalizeTypedAnswer('  Hello  World  ', 'identification')).toBe('hello  world');
    });

    it('collapses multiple whitespace in learn mode', () => {
      expect(normalizeTypedAnswer('  Hello   World  ', 'learn')).toBe('hello world');
    });
  });

  describe('evaluateTypedAnswer', () => {
    it('matches identical answers', () => {
      expect(evaluateTypedAnswer('Photosynthesis', 'photosynthesis')).toBe(true);
    });

    it('ignores case and whitespace variations in learn mode', () => {
      expect(evaluateTypedAnswer('  light   reaction ', 'Light Reaction', 'learn')).toBe(true);
    });

    it('accepts case, minor typo, singular/plural, and number notation variants', () => {
      expect(evaluateTypedAnswer('SIGAW NG PUGAD LAWIN', 'Sigaw ng Pugad Lawin', 'identification')).toBe(true);
      expect(evaluateTypedAnswer('photosynthesi', 'Photosynthesis', 'identification')).toBe(true);
      expect(evaluateTypedAnswer('World War two', 'World War II', 'identification')).toBe(true);
      expect(evaluateTypedAnswer('theory', 'theories', 'identification')).toBe(true);
    });

    it('rejects incorrect answers', () => {
      expect(evaluateTypedAnswer('Mitochondria', 'Chloroplast')).toBe(false);
      expect(evaluateTypedAnswer('cat', 'dog', 'identification')).toBe(false);
    });
  });

  describe('getQuestionHint', () => {
    it('reveals first 3 alphanumeric characters for answers with >= 5 chars', () => {
      const q = makeQuestion({ answer_text: 'Photosynthesis' });
      const hint = getQuestionHint(q);
      expect(hint.startsWith('Pho')).toBe(true);
      expect(hint.length).toBe('Photosynthesis'.length);
      expect(hint.slice(3)).toBe('_'.repeat('Photosynthesis'.length - 3));
    });

    it('reveals 1 character for short answers (2-4 chars)', () => {
      const q = makeQuestion({ answer_text: 'Atom' });
      const hint = getQuestionHint(q);
      expect(hint).toBe('A___');
    });

    it('masks completely when single character', () => {
      const q = makeQuestion({ answer_text: 'X' });
      expect(getQuestionHint(q)).toBe('_');
    });

    it('preserves spaces and punctuation while masking alphanumeric characters', () => {
      const q = makeQuestion({ answer_text: 'DNA (acid)' });
      const hint = getQuestionHint(q);
      // 'DNA (acid)' has letters D, N, A, a, c, i, d (7 letters >= 5).
      // First 3 letters (D, N, A) revealed. Spaces/parentheses preserved.
      expect(hint).toBe('DNA (____)');
    });
  });
});
