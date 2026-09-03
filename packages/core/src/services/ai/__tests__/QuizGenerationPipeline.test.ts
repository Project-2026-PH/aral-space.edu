import { describe, it, expect, vi, beforeEach } from 'vitest';
import { QuizGenerationService } from '../../QuizGenerationService';
import { GeminiExtractor } from '../GeminiExtractor';
import { GroqReviewer } from '../GroqReviewer';
import { RawAiQuestion } from '@quiz-creator/types';

describe('Two-Stage Quiz Generation Pipeline', () => {
  let mockGeminiExtractor: GeminiExtractor;
  let mockGroqReviewer: GroqReviewer;
  let service: QuizGenerationService;

  const mockDraftQuestions: RawAiQuestion[] = [
    {
      question: 'What is photosynthesis?',
      options: ['Energy production in plants', 'Respiration in humans', 'Cell division', 'All of the above'],
      correct_answer: 0,
      explanation: 'Photosynthesis converts sunlight to chemical energy.',
      source_pages: [1]
    }
  ];

  const mockPolishedQuestions: RawAiQuestion[] = [
    {
      question: 'What is the primary biochemical outcome of photosynthesis?',
      options: [
        'Conversion of light energy into chemical energy stored in glucose',
        'Direct breakdown of cellular ATP into ADP',
        'Aerobic oxidative phosphorylation inside mitochondria',
        'Anaerobic fermentation yielding lactic acid'
      ],
      correct_answer: 0,
      explanation: 'Photosynthesis captures photon energy to synthesize glucose from CO2 and H2O.',
      source_pages: [1]
    }
  ];

  beforeEach(() => {
    mockGeminiExtractor = {
      extract: vi.fn().mockResolvedValue({
        questions: mockDraftQuestions,
        tokensUsed: 250,
        model: 'gemini-2.5-flash'
      })
    } as any;

    mockGroqReviewer = {
      reviewAndPolish: vi.fn().mockResolvedValue({
        questions: mockPolishedQuestions,
        tokensUsed: 150,
        model: 'llama-3.3-70b-versatile'
      }),
      generateDirect: vi.fn().mockResolvedValue({
        questions: mockPolishedQuestions,
        tokensUsed: 300,
        model: 'llama-3.3-70b-versatile'
      })
    } as any;

    service = new QuizGenerationService(mockGeminiExtractor, mockGroqReviewer);
  });

  it('runs Two-Stage Pipeline (Gemini extraction -> Groq review) when both keys are provided', async () => {
    const stages: string[] = [];
    const result = await service.generateQuiz({
      handoutPages: [{ pageNumber: 1, text: 'Biology chapter 1 content' }],
      apiKey: 'test-gemini-key',
      groqApiKey: 'test-groq-key',
      pipelineMode: 'two_stage',
      onStageChange: (stage) => stages.push(stage)
    });

    expect(mockGeminiExtractor.extract).toHaveBeenCalledTimes(1);
    expect(mockGroqReviewer.reviewAndPolish).toHaveBeenCalledTimes(1);
    expect(result.pipelineMode).toBe('two_stage');
    expect(result.reviewedByGroq).toBe(true);
    expect(result.questions[0].question).toContain('primary biochemical outcome');
    expect(stages).toContain('extracting');
    expect(stages).toContain('reviewing');
  });

  it('falls back gracefully to Gemini Stage 1 output when Groq review fails (e.g. Rate Limit 429)', async () => {
    mockGroqReviewer.reviewAndPolish = vi.fn().mockRejectedValue(new Error('Rate limit exceeded (429)'));

    const stages: string[] = [];
    const result = await service.generateQuiz({
      handoutPages: [{ pageNumber: 1, text: 'Biology chapter 1 content' }],
      apiKey: 'test-gemini-key',
      groqApiKey: 'test-groq-key',
      onStageChange: (stage) => stages.push(stage)
    });

    // Gemini stage 1 succeeded, Groq failed, returned Gemini output
    expect(mockGeminiExtractor.extract).toHaveBeenCalledTimes(1);
    expect(mockGroqReviewer.reviewAndPolish).toHaveBeenCalledTimes(1);
    expect(result.reviewedByGroq).toBe(false);
    expect(result.questions[0].question).toBe('What is photosynthesis?');
    expect(stages).toContain('fallback');
  });

  it('falls back to Groq Direct when Gemini extraction fails', async () => {
    mockGeminiExtractor.extract = vi.fn().mockRejectedValue(new Error('Gemini API quota exceeded'));

    const stages: string[] = [];
    const result = await service.generateQuiz({
      handoutPages: [{ pageNumber: 1, text: 'Biology chapter 1 content' }],
      apiKey: 'test-gemini-key',
      groqApiKey: 'test-groq-key',
      onStageChange: (stage) => stages.push(stage)
    });

    expect(mockGroqReviewer.generateDirect).toHaveBeenCalledTimes(1);
    expect(result.pipelineMode).toBe('groq_fallback');
    expect(stages).toContain('fallback');
  });

  it('executes Groq direct mode when requested', async () => {
    const result = await service.generateQuiz({
      handoutPages: [{ pageNumber: 1, text: 'Biology chapter 1 content' }],
      groqApiKey: 'test-groq-key',
      pipelineMode: 'groq_direct'
    });

    expect(mockGroqReviewer.generateDirect).toHaveBeenCalledTimes(1);
    expect(mockGeminiExtractor.extract).not.toHaveBeenCalled();
    expect(result.pipelineMode).toBe('groq_direct');
  });

  it('executes Gemini direct mode when requested', async () => {
    const result = await service.generateQuiz({
      handoutPages: [{ pageNumber: 1, text: 'Biology chapter 1 content' }],
      apiKey: 'test-gemini-key',
      pipelineMode: 'gemini_direct'
    });

    expect(mockGeminiExtractor.extract).toHaveBeenCalledTimes(1);
    expect(mockGroqReviewer.reviewAndPolish).not.toHaveBeenCalled();
    expect(result.pipelineMode).toBe('gemini_direct');
  });

  it('returns mock questions when no API keys are provided', async () => {
    const result = await service.generateQuiz({
      handoutPages: [{ pageNumber: 1, text: 'Sample text' }]
    });

    expect(result.pipelineMode).toBe('mock');
    expect(result.questions.length).toBeGreaterThan(0);
    expect(mockGeminiExtractor.extract).not.toHaveBeenCalled();
    expect(mockGroqReviewer.reviewAndPolish).not.toHaveBeenCalled();
  });

  it('validates question structures correctly', () => {
    expect(QuizGenerationService.validateQuestions(mockPolishedQuestions)).toBe(true);

    const invalid = [
      {
        question: '',
        options: ['A', 'B'],
        correct_answer: 5,
        explanation: ''
      }
    ];
    expect(QuizGenerationService.validateQuestions(invalid)).toBe(false);
  });
});
