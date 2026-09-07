import { describe, it, expect, vi } from 'vitest';
import { UserAuthoringProfileService } from '../UserAuthoringProfileService';
import { IQuizRepository } from '../../../repositories/IQuizRepository';

describe('UserAuthoringProfileService', () => {
  it('defaults to 10 questions and standard style when user has no quizzes', async () => {
    const mockRepo = {
      listQuizzes: vi.fn().mockResolvedValue([])
    } as unknown as IQuizRepository;

    const profile = await UserAuthoringProfileService.buildProfile(mockRepo, 'user-new');

    expect(profile.targetCount).toBe(10);
    expect(profile.sourceType).toBe('default');
    expect(profile.totalReviewersAnalyzed).toBe(0);
  });

  it('adapts to manual reviewers when manual quizzes exist', async () => {
    const mockRepo = {
      listQuizzes: vi.fn().mockResolvedValue([
        { id: 'q1', title: 'Biology Midterm Deck', question_count: 8, source_model: 'manual' },
        { id: 'q2', title: 'Chemistry Reviewer', question_count: 12, source_model: 'manual' },
        { id: 'q3', title: 'Old AI Deck', question_count: 20, source_model: 'gemini-2.5-flash' }
      ]),
      getQuestionsByQuizId: vi.fn().mockImplementation(async (id: string) => {
        if (id === 'q1') {
          return [
            {
              id: '1',
              question_text: 'What is the powerhouse of the eukaryotic cell?',
              options: ['Mitochondria', 'Nucleus', 'Ribosome', 'Golgi Apparatus'],
              correct_answer: 0,
              explanation: 'Mitochondria produce ATP through cellular respiration.'
            },
            {
              id: '2',
              question_text: 'Which organelle contains digestive hydrolytic enzymes?',
              options: ['Lysosome', 'Endoplasmic Reticulum', 'Vacuole', 'Centrosome'],
              correct_answer: 0,
              explanation: 'Lysosomes contain acidic hydrolases to degrade macromolecules.'
            }
          ];
        }
        return [];
      })
    } as unknown as IQuizRepository;

    const profile = await UserAuthoringProfileService.buildProfile(mockRepo, 'user-student');

    // Max between 8 and 12 is 12 (ignoring AI quiz 20 because manual quizzes take precedence)
    expect(profile.targetCount).toBe(12);
    expect(profile.sourceType).toBe('manual');
    expect(profile.totalReviewersAnalyzed).toBe(2);
    expect(profile.sampleQuestions).toHaveLength(2);
    expect(profile.sampleQuestions?.[0].question).toContain('powerhouse');
    expect(profile.styleSummary).toContain('12 questions');
  });

  it('falls back to adjusted AI quizzes when no manual quizzes exist', async () => {
    const mockRepo = {
      listQuizzes: vi.fn().mockResolvedValue([
        { id: 'ai-1', title: 'Physics Deck', question_count: 7, source_model: 'gemini-2.5-flash' },
        { id: 'ai-2', title: 'Calculus Deck', question_count: 15, source_model: 'groq/llama-3.3-70b' }
      ]),
      getQuestionsByQuizId: vi.fn().mockImplementation(async (id: string) => {
        if (id === 'ai-1') {
          return [
            {
              id: '10',
              question_text: 'Calculate the derivative of f(x) = x^3.',
              options: ['3x^2', 'x^2', '3x', 'x^4 / 4'],
              correct_answer: 0,
              explanation: 'By the power rule, d/dx(x^n) = n*x^(n-1).'
            }
          ];
        }
        return [];
      })
    } as unknown as IQuizRepository;

    const profile = await UserAuthoringProfileService.buildProfile(mockRepo, 'user-ai-only');

    // Max between 7 and 15 is 15
    expect(profile.targetCount).toBe(15);
    expect(profile.sourceType).toBe('ai_adjusted');
    expect(profile.totalReviewersAnalyzed).toBe(2);
    expect(profile.sampleQuestions).toHaveLength(1);
    expect(profile.styleSummary).toContain('15 questions');
  });

  it('prioritizes quizzes matching subjectId over unrelated quizzes', async () => {
    const mockRepo = {
      listQuizzes: vi.fn().mockResolvedValue([
        { id: 'bio-1', title: 'Biology Manual', subject_id: 'sub-bio', question_count: 5, source_model: 'manual' },
        { id: 'hist-1', title: 'History Manual', subject_id: 'sub-history', question_count: 22, source_model: 'manual' }
      ]),
      getQuestionsByQuizId: vi.fn().mockImplementation(async (id: string) => {
        if (id === 'bio-1') {
          return [
            {
              id: 'b1',
              question_text: 'Define osmosis in plant cells.',
              options: ['Diffusion of water across a semipermeable membrane', 'Active transport of sodium', 'Protein synthesis', 'Cell division'],
              correct_answer: 0,
              explanation: 'Osmosis is the spontaneous net movement of water molecules.'
            }
          ];
        }
        return [];
      })
    } as unknown as IQuizRepository;

    const profile = await UserAuthoringProfileService.buildProfile(
      mockRepo,
      'user-multisubject',
      undefined,
      'sub-bio'
    );

    // Should prioritize sub-bio quiz with targetCount 5 rather than history quiz with targetCount 22
    expect(profile.targetCount).toBe(5);
    expect(profile.totalReviewersAnalyzed).toBe(1);
    expect(profile.sampleQuestions?.[0].question).toContain('osmosis');
  });
});
