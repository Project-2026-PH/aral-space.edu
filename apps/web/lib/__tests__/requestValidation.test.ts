import { describe, expect, it } from 'vitest';
import {
  parseCreateQuestion,
  parseSessionAnswer,
  parseUpdateQuestion
} from '../request-validation';

describe('request validation boundaries', () => {
  it('parses a create-question DTO without exposing raw request data', () => {
    expect(parseCreateQuestion({
      question_text: 'What is ATP?',
      options: ['Energy', 'Protein'],
      correct_answer: 0
    })).toEqual({
      question_text: 'What is ATP?',
      options: ['Energy', 'Protein'],
      correct_answer: 0
    });
  });

  it('accepts enumeration questions for create and update requests', () => {
    const question = {
      question_text: 'Name the stages',
      question_type: 'enumeration',
      options: [],
      answer_text: '3',
      correct_answer: 0
    };

    expect(parseCreateQuestion(question)).toEqual(question);
    expect(parseUpdateQuestion(question)).toEqual(question);
  });

  it('rejects an empty question update', () => {
    expect(() => parseUpdateQuestion({})).toThrow('At least one question field is required');
  });

  it('allows answer submissions to omit the client-derived correctness value', () => {
    expect(parseSessionAnswer({
      questionId: 'question-1',
      selectedOptionId: 2
    })).toMatchObject({
      questionId: 'question-1',
      selectedOptionId: 2,
      isCorrect: false
    });
  });

  it('preserves legacy correctness-only session events', () => {
    expect(parseSessionAnswer({
      questionId: 'question-1',
      isCorrect: true
    })).toEqual({
      questionId: 'question-1',
      isCorrect: true,
      selectedOptionId: undefined,
      answerText: undefined,
      answerMode: undefined
    });
  });

  it('allows -1 selectedOptionId for surrendered answers', () => {
    expect(parseSessionAnswer({
      questionId: 'question-1',
      selectedOptionId: -1
    })).toMatchObject({
      questionId: 'question-1',
      selectedOptionId: -1,
      isCorrect: false
    });
  });

  it('rejects selectedOptionId below -1 or above 100', () => {
    expect(() => parseSessionAnswer({ questionId: 'question-1', selectedOptionId: -2 })).toThrow();
    expect(() => parseSessionAnswer({ questionId: 'question-1', selectedOptionId: 101 })).toThrow();
  });

  it('requires either a submitted answer or the legacy correctness value', () => {
    expect(() => parseSessionAnswer({ questionId: 'question-1' })).toThrow(
      'Either an answer or isCorrect is required'
    );
  });
});
