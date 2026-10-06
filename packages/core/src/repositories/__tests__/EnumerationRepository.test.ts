import { describe, expect, it } from 'vitest';
import { LocalFirstQuizRepository, MemoryQuizRepository } from '../index';

const enumerationQuestion = {
  question_text: 'Name three items',
  question_type: 'enumeration' as const,
  options: [],
  answer_text: '3',
  answer_terms: ['A', 'B', 'C'],
  enumeration_distractors: ['X'],
  correct_answer: 0
};

describe('enumeration answer-key persistence', () => {
  it.each([
    ['memory', () => new MemoryQuizRepository()],
    ['local-first', () => new LocalFirstQuizRepository()]
  ])('round-trips empty options and canonical fields through %s', async (_name, createRepository) => {
    const repository = createRepository();
    const quiz = await repository.createQuiz({
      title: 'Enumeration persistence',
      questions: [enumerationQuestion]
    }, 'owner');

    let [stored] = await repository.getQuestionsByQuizId(quiz.id, 'owner');
    expect(stored.options).toEqual([]);
    expect(stored.answer_text).toBe('3');
    expect(stored.answer_terms).toEqual(['A', 'B', 'C']);
    expect(stored.enumeration_distractors).toEqual(['X']);

    stored = await repository.updateQuestion(quiz.id, stored.id, {
      options: [],
      answer_text: '3',
      answer_terms: [],
      enumeration_distractors: []
    }, 'owner');
    expect(stored.answer_terms).toEqual([]);
    expect(stored.enumeration_distractors).toEqual([]);
  });
});
