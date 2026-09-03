import { describe, it, expect, vi, beforeEach } from 'vitest';
import { QuizGenerationService } from '../../QuizGenerationService';
import { GeminiExtractor } from '../GeminiExtractor';
import { GroqReviewer } from '../GroqReviewer';
import { VerbatimExtractor } from '../VerbatimExtractor';
import { RawAiQuestion, VerbatimTermPair } from '@quiz-creator/types';

describe('Two-Stage Quiz Generation Pipeline', () => {
  let mockGeminiExtractor: GeminiExtractor;
  let mockGroqReviewer: GroqReviewer;
  let mockVerbatimExtractor: VerbatimExtractor;
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

  const mockVerbatimPairs: VerbatimTermPair[] = [
    {
      term: 'Photosynthesis',
      verbatim_definition: 'Photosynthesis converts sunlight to chemical energy.',
      source_page: 1
    },
    {
      term: 'Chlorophyll',
      verbatim_definition: 'Chlorophyll absorbs blue and red light.',
      source_page: 1
    },
    {
      term: 'Thylakoid',
      verbatim_definition: 'Thylakoid membranes contain the electron transport chain.',
      source_page: 1
    },
    {
      term: 'Stroma',
      verbatim_definition: 'Stroma is the fluid-filled space surrounding grana.',
      source_page: 1
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

    mockVerbatimExtractor = {
      extract: vi.fn().mockResolvedValue({
        pairs: mockVerbatimPairs,
        tokensUsed: 120,
        model: 'gemini/gemini-2.5-flash'
      })
    } as any;

    service = new QuizGenerationService(mockGeminiExtractor, mockGroqReviewer, mockVerbatimExtractor);
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
      pipelineMode: 'two_stage',
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

  it('builds multi-chapter balanced extraction prompt in GeminiExtractor', () => {
    const multiChapterPages = [
      { pageNumber: 1, text: 'Cell structure and organelles', chapterTitle: 'Ch1_Cells.pdf' },
      { pageNumber: 2, text: 'Mitosis and cell division', chapterTitle: 'Ch1_Cells.pdf' },
      { pageNumber: 3, text: 'Mendelian inheritance and Punnett squares', chapterTitle: 'Ch2_Genetics.pdf' }
    ];

    const prompt = GeminiExtractor.buildExtractionPrompt(multiChapterPages, 'Biology');

    expect(prompt).toContain('[Chapter / File: Ch1_Cells.pdf]');
    expect(prompt).toContain('[Chapter / File: Ch2_Genetics.pdf]');
    expect(prompt).toContain('Multi-Chapter Balanced Distribution');
    expect(prompt).toContain('distribute questions proportionally and evenly across ALL chapters');
  });

  it('includes chapter property in GeminiExtractor question schema', () => {
    const schema = GeminiExtractor.getQuestionSchema();
    expect(schema.items.properties.chapter).toBeDefined();
  });

  it('runs Verbatim Exact Pipeline with temperature 0.0 extraction and programmatic distractor assembly', async () => {
    const samplePageText = `
      Photosynthesis converts sunlight to chemical energy.
      Chlorophyll absorbs blue and red light.
      Thylakoid membranes contain the electron transport chain.
      Stroma is the fluid-filled space surrounding grana.
    `;

    const stages: string[] = [];
    const result = await service.generateQuiz({
      handoutPages: [{ pageNumber: 1, text: samplePageText }],
      apiKey: 'test-gemini-key',
      pipelineMode: 'verbatim_exact',
      onStageChange: (stage) => stages.push(stage)
    });

    expect(mockVerbatimExtractor.extract).toHaveBeenCalledTimes(1);
    expect(mockGroqReviewer.reviewAndPolish).not.toHaveBeenCalled();
    expect(result.pipelineMode).toBe('verbatim_exact');
    expect(result.sourceModel).toContain('verbatim/gemini/gemini-2.5-flash');
    expect(result.questions.length).toBe(4);
    expect(stages).toContain('extracting');
    expect(stages).toContain('reviewing');

    for (const q of result.questions) {
      expect(q.options.length).toBe(4);
      expect(q.correct_answer).toBeGreaterThanOrEqual(0);
      expect(q.correct_answer).toBeLessThanOrEqual(3);
      expect(q.explanation).toContain(q.options[q.correct_answer]);
    }
  });

  it('builds verbatim extraction prompt with strict constraints', () => {
    const prompt = VerbatimExtractor.buildExtractionPrompt(
      [{ pageNumber: 1, text: 'Sample handout text' }],
      'Cell Biology',
      15
    );

    expect(prompt).toContain('exact term-and-definition pairs directly from the source text');
    expect(prompt).toContain('Do NOT summarize, rephrase, normalize, or paraphrase');
    expect(prompt).toContain('exact character-for-character substring');
    expect(prompt).toContain('skip the term');
  });
});
