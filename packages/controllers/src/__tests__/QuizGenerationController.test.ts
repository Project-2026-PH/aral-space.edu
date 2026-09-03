import { describe, it, expect, vi, beforeEach } from 'vitest';
import { QuizGenerationController } from '../QuizGenerationController';
import { IQuizRepository, QuizGenerationService } from '@quiz-creator/core';
import { GenerateQuizRequestDto, QuizGenerationProgressDto } from '@quiz-creator/types';

describe('QuizGenerationController - pipelineMode', () => {
  let mockRepo: IQuizRepository;
  let mockGenService: QuizGenerationService;
  let controller: QuizGenerationController;

  beforeEach(() => {
    mockRepo = {
      createQuiz: vi.fn().mockResolvedValue({ id: 'quiz-123', title: 'Test Quiz' }),
      getQuizById: vi.fn(),
      listQuizzes: vi.fn(),
      deleteQuiz: vi.fn(),
    } as unknown as IQuizRepository;

    mockGenService = {
      generateQuiz: vi.fn().mockImplementation(async (options) => {
        options.onStageChange?.('extracting', 'Processing concepts...', 'mock-model');
        options.onChunk?.('sample question content');
        return {
          sourceModel: 'mock-model',
          tokensUsed: 100,
          pipelineMode: options.pipelineMode || 'two_stage',
          questions: [
            {
              question: 'Sample Q',
              options: ['A', 'B', 'C', 'D'],
              correct_answer: 0,
              explanation: 'Sample exp',
              source_pages: [1]
            }
          ]
        };
      })
    } as unknown as QuizGenerationService;

    controller = new QuizGenerationController(mockRepo, mockGenService);
  });

  it('passes pipelineMode two_stage and progress events appropriately', async () => {
    const progressEvents: QuizGenerationProgressDto[] = [];
    const dto: GenerateQuizRequestDto = {
      title: 'Biology Quiz',
      text: 'Sample notes for biology',
      pipelineMode: 'two_stage'
    };

    const result = await controller.handleStreamingGeneration(
      dto,
      (p) => progressEvents.push(p),
      'user-1'
    );

    expect(result.quizId).toBe('quiz-123');
    expect(mockGenService.generateQuiz).toHaveBeenCalledWith(
      expect.objectContaining({
        pipelineMode: 'two_stage'
      })
    );
    const extractingEvent = progressEvents.find((p) => p.stage === 'extracting' && p.modelUsed === 'mock-model');
    expect(extractingEvent?.pipelineMode).toBe('two_stage');
    expect(extractingEvent?.message).toBe('Stage 1/2: Extracting Concepts');

    const completeEvent = progressEvents.find((p) => p.progress === 100);
    expect(completeEvent?.pipelineMode).toBe('two_stage');
    expect(completeEvent?.quizId).toBe('quiz-123');
  });

  it('adjusts stage messages for single-stage groq_direct pipeline', async () => {
    const progressEvents: QuizGenerationProgressDto[] = [];
    const dto: GenerateQuizRequestDto = {
      title: 'Fast Quiz',
      text: 'Quick flashcard material',
      pipelineMode: 'groq_direct'
    };

    await controller.handleStreamingGeneration(
      dto,
      (p) => progressEvents.push(p),
      'user-1'
    );

    expect(mockGenService.generateQuiz).toHaveBeenCalledWith(
      expect.objectContaining({
        pipelineMode: 'groq_direct'
      })
    );
    const extractingEvent = progressEvents.find((p) => p.stage === 'extracting' && p.modelUsed === 'mock-model');
    expect(extractingEvent?.pipelineMode).toBe('groq_direct');
    expect(extractingEvent?.message).toBe('Generating Questions');
  });

  it('adjusts stage messages for single-stage gemini_direct pipeline', async () => {
    const progressEvents: QuizGenerationProgressDto[] = [];
    const dto: GenerateQuizRequestDto = {
      title: 'Large Document Quiz',
      text: 'Long textbook excerpt',
      pipelineMode: 'gemini_direct'
    };

    await controller.handleStreamingGeneration(
      dto,
      (p) => progressEvents.push(p),
      'user-1'
    );

    expect(mockGenService.generateQuiz).toHaveBeenCalledWith(
      expect.objectContaining({
        pipelineMode: 'gemini_direct'
      })
    );
    const extractingEvent = progressEvents.find((p) => p.stage === 'extracting' && p.modelUsed === 'mock-model');
    expect(extractingEvent?.pipelineMode).toBe('gemini_direct');
    expect(extractingEvent?.message).toBe('Generating Questions');
  });

  it('handles multi-chapter pdfPages, reports chapter breakdown progress, and generates smart title', async () => {
    const progressEvents: QuizGenerationProgressDto[] = [];
    const dto: GenerateQuizRequestDto = {
      pdfPages: [
        { pageNumber: 1, text: 'Cell biology notes', chapterTitle: 'Ch1_Cells.pdf' },
        { pageNumber: 2, text: 'Cell division notes', chapterTitle: 'Ch1_Cells.pdf' },
        { pageNumber: 3, text: 'Genetics notes', chapterTitle: 'Ch2_Genetics.pdf' },
        { pageNumber: 4, text: 'Ecology notes', chapterTitle: 'Ch3_Ecology.pdf' }
      ],
      pipelineMode: 'gemini_direct'
    };

    const result = await controller.handleStreamingGeneration(
      dto,
      (p) => progressEvents.push(p),
      'user-1'
    );

    expect(result.quizId).toBe('quiz-123');
    const extractingEvent = progressEvents.find((p) => p.message === 'Processing Material');
    expect(extractingEvent?.detail).toContain('4 pages across 3 chapters');
    expect(extractingEvent?.detail).toContain('Ch1_Cells.pdf, Ch2_Genetics.pdf, Ch3_Ecology.pdf');

    expect(mockRepo.createQuiz).toHaveBeenCalledWith(
      expect.objectContaining({
        title: '3 Chapters Comprehensive Review',
        handout_name: 'Ch1_Cells.pdf, Ch2_Genetics.pdf, Ch3_Ecology.pdf'
      }),
      'user-1'
    );
  });

  it('builds and incorporates adaptive authoringProfile from past manual decks', async () => {
    mockRepo.listQuizzes = vi.fn().mockResolvedValue([
      { id: 'm1', title: 'My Flashcard Deck', question_count: 8, source_model: 'manual' }
    ]);
    mockRepo.getQuestionsByQuizId = vi.fn().mockResolvedValue([
      { id: '1', question_text: 'Define osmosis.', options: ['Diffusion of water', 'Active transport', 'Endocytosis', 'Exocytosis'], correct_answer: 0, explanation: 'Water moves down gradient.' }
    ]);

    const progressEvents: QuizGenerationProgressDto[] = [];
    const dto: GenerateQuizRequestDto = {
      title: 'Adaptive Bio Quiz',
      text: 'Osmosis and tonicity notes',
      pipelineMode: 'two_stage'
    };

    const result = await controller.handleStreamingGeneration(
      dto,
      (p) => progressEvents.push(p),
      'user-custom-style'
    );

    expect(result.quizId).toBe('quiz-123');
    expect(mockGenService.generateQuiz).toHaveBeenCalledWith(
      expect.objectContaining({
        authoringProfile: expect.objectContaining({
          targetCount: 8,
          sourceType: 'manual'
        })
      })
    );

    const progressWithProfile = progressEvents.find((p) => p.authoringProfile);
    expect(progressWithProfile?.authoringProfile?.targetCount).toBe(8);
    expect(progressWithProfile?.authoringProfile?.sourceType).toBe('manual');
  });

  it('adjusts stage messages for verbatim_exact pipeline mode', async () => {
    const progressEvents: QuizGenerationProgressDto[] = [];
    const dto: GenerateQuizRequestDto = {
      title: 'Verbatim Quiz',
      text: 'Glossary excerpt',
      pipelineMode: 'verbatim_exact'
    };

    mockGenService.generateQuiz = vi.fn().mockImplementation(async (options) => {
      options.onStageChange?.('extracting', 'Extracting verbatim terms at temp 0.0...', 'gemini-2.5-flash');
      options.onStageChange?.('reviewing', 'Validating quotes & assembling distractors...', 'verbatim-assembler');
      return {
        sourceModel: 'verbatim/gemini/gemini-2.5-flash',
        tokensUsed: 100,
        pipelineMode: 'verbatim_exact',
        questions: [
          {
            question: 'Sample Verbatim Q',
            options: ['A', 'B', 'C', 'D'],
            correct_answer: 0,
            explanation: 'Sample exp',
            source_pages: [1]
          }
        ]
      };
    });

    const result = await controller.handleStreamingGeneration(
      dto,
      (p) => progressEvents.push(p),
      'user-1'
    );

    expect(result.quizId).toBe('quiz-123');
    expect(mockGenService.generateQuiz).toHaveBeenCalledWith(
      expect.objectContaining({
        pipelineMode: 'verbatim_exact'
      })
    );

    const extractingEvent = progressEvents.find((p) => p.stage === 'extracting' && p.modelUsed === 'gemini-2.5-flash');
    expect(extractingEvent?.pipelineMode).toBe('verbatim_exact');
    expect(extractingEvent?.message).toBe('Stage 1/2: Extracting Verbatim Terms');

    const reviewingEvent = progressEvents.find((p) => p.stage === 'reviewing' && p.modelUsed === 'verbatim-assembler');
    expect(reviewingEvent?.pipelineMode).toBe('verbatim_exact');
    expect(reviewingEvent?.message).toBe('Stage 2/2: Validating Quotes & Assembling Distractors');
  });

  it('defaults pipelineMode to auto and emits student-friendly pedagogical milestones', async () => {
    const progressEvents: QuizGenerationProgressDto[] = [];
    const dto: GenerateQuizRequestDto = {
      title: 'Auto Exam Reviewer',
      text: 'Sample notes'
      // pipelineMode intentionally omitted to test default
    };

    mockGenService.generateQuiz = vi.fn().mockImplementation(async (options) => {
      options.onStageChange?.('extracting', 'Processing concepts...', 'gemini-2.5-flash');
      options.onStageChange?.('reviewing', 'Polishing distractors...', 'llama-3.3-70b-versatile');
      return {
        sourceModel: 'gemini-2.5-flash',
        tokensUsed: 150,
        pipelineMode: 'two_stage',
        questions: [
          {
            question: 'Sample Q',
            options: ['A', 'B', 'C', 'D'],
            correct_answer: 0,
            explanation: 'Sample exp',
            source_pages: [1]
          }
        ]
      };
    });

    const result = await controller.handleStreamingGeneration(
      dto,
      (p) => progressEvents.push(p),
      'user-1'
    );

    expect(result.quizId).toBe('quiz-123');
    expect(mockGenService.generateQuiz).toHaveBeenCalledWith(
      expect.objectContaining({
        pipelineMode: 'auto'
      })
    );

    const extractingEvent = progressEvents.find((p) => p.message === 'Drafting High-Yield Questions');
    expect(extractingEvent?.pipelineMode).toBe('auto');
    expect(extractingEvent?.stage).toBe('extracting');

    const reviewingEvent = progressEvents.find((p) => p.stage === 'reviewing');
    expect(reviewingEvent?.pipelineMode).toBe('auto');
    expect(reviewingEvent?.message).toBe('Polishing Distractors & Hardening Pedagogy');
  });
});
