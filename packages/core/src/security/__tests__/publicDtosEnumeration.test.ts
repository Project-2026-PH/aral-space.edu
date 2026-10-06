import { describe, expect, it } from 'vitest';
import { toPublicQuizDto } from '../publicDtos';
import type { Quiz, QuizQuestion } from '@quiz-creator/types';

const quiz: Quiz = {
  id: 'quiz-1',
  title: 'Enumeration quiz',
  question_count: 1,
  generated_at: '2024-01-01T00:00:00.000Z',
  source_model: 'manual',
  allow_public_answer_key: false
};

const question: QuizQuestion = {
  id: 'question-1',
  quiz_id: quiz.id,
  question_text: 'Name the items',
  question_type: 'enumeration',
  options: [],
  answer_text: '3',
  answer_terms: ['A', 'B', 'C'],
  enumeration_distractors: ['X'],
  correct_answer: 0,
  explanation: 'private explanation',
  order_index: 0
};

describe('public enumeration answer-key privacy', () => {
  it('omits all answer-key fields when public answer keys are disabled', () => {
    const result = toPublicQuizDto(quiz, [question], null);
    expect(result.questions[0]).not.toHaveProperty('answer_text');
    expect(result.questions[0]).not.toHaveProperty('answer_terms');
    expect(result.questions[0]).not.toHaveProperty('enumeration_distractors');
    expect(result.questions[0]).not.toHaveProperty('correct_answer');
    expect(result.questions[0]).not.toHaveProperty('explanation');
  });

  it('includes canonical terms and distractors only when the answer key is enabled', () => {
    const result = toPublicQuizDto({ ...quiz, allow_public_answer_key: true }, [question], null);
    expect(result.questions[0].answer_terms).toEqual(['A', 'B', 'C']);
    expect(result.questions[0].enumeration_distractors).toEqual(['X']);
    expect(result.questions[0].answer_text).toBe('3');
  });
});
