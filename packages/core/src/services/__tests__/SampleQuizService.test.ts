import { describe, it, expect } from 'vitest';
import {
  SampleQuizService,
  SAMPLE_QUIZ,
  SAMPLE_SUBJECT,
  SAMPLE_QUIZ_ID,
  SAMPLE_SUBJECT_ID,
  SAMPLE_QUIZ_QUESTIONS
} from '../SampleQuizService';
import { MemoryQuizRepository } from '../../repositories/MemoryQuizRepository';
import { LocalFirstQuizRepository } from '../../repositories/LocalFirstQuizRepository';

describe('SampleQuizService & Default Loading', () => {
  it('provides a complete 8-question Cognitive Mastery sample quiz dataset', () => {
    const data = SampleQuizService.getSampleData();
    expect(data.quiz.id).toBe(SAMPLE_QUIZ_ID);
    expect(data.quiz.question_count).toBe(8);
    expect(data.subject.id).toBe(SAMPLE_SUBJECT_ID);
    expect(data.questions.length).toBe(8);
    expect(data.quizQuestions.length).toBe(8);
  });

  it('guarantees elaborative feedback fields on all sample questions', () => {
    SAMPLE_QUIZ_QUESTIONS.forEach((q, idx) => {
      expect(q.id).toBe(`q-cognitive-mastery-${idx + 1}`);
      expect(q.correct_explanation).toBeTruthy();
      expect(typeof q.correct_explanation).toBe('string');
      expect(q.distractor_explanations).toBeDefined();
      expect(Object.keys(q.distractor_explanations || {}).length).toBeGreaterThan(0);
      expect(Array.isArray(q.discriminatory_keywords)).toBe(true);
      expect(q.discriminatory_keywords?.length).toBeGreaterThanOrEqual(2);
      expect(q.options.length).toBe(4);
      expect(q.correct_answer).toBeGreaterThanOrEqual(0);
      expect(q.correct_answer).toBeLessThan(4);
    });
  });

  it('MemoryQuizRepository seeds sample quiz and subject by default', async () => {
    const repo = new MemoryQuizRepository();
    const quizzes = await repo.listQuizzes();
    const sampleQuiz = quizzes.find(q => q.id === SAMPLE_QUIZ_ID);
    expect(sampleQuiz).toBeDefined();
    expect(sampleQuiz?.title).toContain('Cognitive Mastery Loop');

    const questions = await repo.getQuestionsByQuizId(SAMPLE_QUIZ_ID);
    expect(questions.length).toBe(8);
    expect(questions[0].correct_explanation).toBeTruthy();

    const subjects = await repo.listSubjects();
    const sampleSubject = subjects.find(s => s.id === SAMPLE_SUBJECT_ID);
    expect(sampleSubject).toBeDefined();
  });

  it('LocalFirstQuizRepository seeds sample quiz by default', async () => {
    const repo = new LocalFirstQuizRepository();
    const quizzes = await repo.listQuizzes();
    const sampleQuiz = quizzes.find(q => q.id === SAMPLE_QUIZ_ID);
    expect(sampleQuiz).toBeDefined();

    const questions = await repo.getQuestionsByQuizId(SAMPLE_QUIZ_ID);
    expect(questions.length).toBe(8);
  });
});
