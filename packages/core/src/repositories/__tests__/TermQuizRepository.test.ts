import { describe, it, expect, beforeEach } from 'vitest';
import { MemoryQuizRepository } from '../MemoryQuizRepository';
import { LocalFirstQuizRepository } from '../LocalFirstQuizRepository';

describe('Quiz Term Categorization', () => {
  let memoryRepo: MemoryQuizRepository;
  let localFirstRepo: LocalFirstQuizRepository;

  beforeEach(() => {
    memoryRepo = new MemoryQuizRepository();
    localFirstRepo = new LocalFirstQuizRepository();
  });

  it('creates quiz with term in MemoryQuizRepository and retrieves it', async () => {
    const created = await memoryRepo.createQuiz({
      title: 'Operating Systems Reviewer',
      term: 'Prelim',
      questions: [
        {
          question_text: 'What is a process?',
          options: ['Program in execution', 'Hardware chip', 'Compiler pass', 'Thread pool'],
          correct_answer: 0
        }
      ]
    });

    expect(created.term).toBe('Prelim');

    const fetched = await memoryRepo.getQuizById(created.id);
    expect(fetched).not.toBeNull();
    expect(fetched?.term).toBe('Prelim');
  });

  it('updates quiz term in MemoryQuizRepository', async () => {
    const ownerId = 'term-owner';
    const created = await memoryRepo.createQuiz({
      title: 'Discrete Math Reviewer',
      term: 'Prelim',
      questions: [
        {
          question_text: 'What is a set?',
          options: ['Collection of objects', 'Loop', 'Variable', 'Function'],
          correct_answer: 0
        }
      ]
    }, ownerId);

    const updated = await memoryRepo.updateQuiz(created.id, {
      term: 'Midterm'
    }, ownerId);

    expect(updated.term).toBe('Midterm');

    const fetched = await memoryRepo.getQuizById(created.id, ownerId);
    expect(fetched?.term).toBe('Midterm');
  });

  it('defaults term to null when not provided', async () => {
    const created = await memoryRepo.createQuiz({
      title: 'General Reviewer',
      questions: [
        {
          question_text: 'Question without term',
          options: ['A', 'B'],
          correct_answer: 0
        }
      ]
    });

    expect(created.term).toBeNull();
    const fetched = await memoryRepo.getQuizById(created.id);
    expect(fetched?.term).toBeNull();
  });

  it('preserves term when cloning quiz by share token', async () => {
    const created = await memoryRepo.createQuiz({
      title: 'Shared Biology Reviewer',
      term: '1st Grading',
      questions: [
        {
          question_text: 'What is cell?',
          options: ['Basic unit of life', 'Organ', 'Tissue', 'Atom'],
          correct_answer: 0
        }
      ]
    });

    const cloned = await memoryRepo.cloneQuizByShareToken(created.share_token!);
    expect(cloned.term).toBe('1st Grading');
    expect(cloned.title).toBe('Shared Biology Reviewer (Copy)');
  });

  it('handles term correctly in LocalFirstQuizRepository', async () => {
    const ownerId = 'term-owner';
    const created = await localFirstRepo.createQuiz({
      title: 'Local First Network Reviewer',
      term: 'Finals',
      questions: [
        {
          question_text: 'What is IP?',
          options: ['Internet Protocol', 'Internal Port'],
          correct_answer: 0
        }
      ]
    }, ownerId);

    expect(created.term).toBe('Finals');

    const updated = await localFirstRepo.updateQuiz(created.id, {
      term: 'Semi-Final'
    }, ownerId);
    expect(updated.term).toBe('Semi-Final');

    const fetched = await localFirstRepo.getQuizById(created.id, ownerId);
    expect(fetched?.term).toBe('Semi-Final');
  });
});
