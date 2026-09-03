import { describe, it, expect, vi, beforeEach } from 'vitest';
import { QuizGenerationService } from '../../QuizGenerationService';
import { GeminiExtractor } from '../GeminiExtractor';
import { GroqReviewer } from '../GroqReviewer';
import { VerbatimExtractor } from '../VerbatimExtractor';
import { HandoutPage, RawAiQuestion } from '@quiz-creator/types';

describe('Auto-Routing Pipeline Heuristics', () => {
  let mockGeminiExtractor: GeminiExtractor;
  let mockGroqReviewer: GroqReviewer;
  let mockVerbatimExtractor: VerbatimExtractor;
  let service: QuizGenerationService;

  const mockQuestions: RawAiQuestion[] = [
    {
      question: 'Sample Q',
      options: ['A', 'B', 'C', 'D'],
      correct_answer: 0,
      explanation: 'Explanation',
      source_pages: [1]
    }
  ];

  beforeEach(() => {
    mockGeminiExtractor = {
      extract: vi.fn().mockResolvedValue({
        questions: mockQuestions,
        tokensUsed: 200,
        model: 'gemini-2.5-flash'
      })
    } as any;

    mockGroqReviewer = {
      reviewAndPolish: vi.fn().mockResolvedValue({
        questions: mockQuestions,
        tokensUsed: 150,
        model: 'llama-3.3-70b-versatile'
      }),
      generateDirect: vi.fn().mockResolvedValue({
        questions: mockQuestions,
        tokensUsed: 250,
        model: 'llama-3.3-70b-versatile'
      })
    } as any;

    mockVerbatimExtractor = {
      extract: vi.fn()
    } as any;

    service = new QuizGenerationService(mockGeminiExtractor, mockGroqReviewer, mockVerbatimExtractor);
  });

  describe('resolveAutoPipelineMode', () => {
    const singlePage: HandoutPage[] = [
      { pageNumber: 1, text: 'Short handout text about cellular biology and ATP synthesis.' }
    ];

    it('routes to gemini_direct when only Gemini API key is configured', () => {
      const routing = QuizGenerationService.resolveAutoPipelineMode(
        { handoutPages: singlePage },
        'gemini-api-key',
        undefined
      );
      expect(routing.resolvedMode).toBe('gemini_direct');
      expect(routing.reason).toContain('Gemini provider active');
    });

    it('routes to groq_direct when only Groq API key is configured', () => {
      const routing = QuizGenerationService.resolveAutoPipelineMode(
        { handoutPages: singlePage },
        undefined,
        'groq-api-key'
      );
      expect(routing.resolvedMode).toBe('groq_direct');
      expect(routing.reason).toContain('Groq provider active');
    });

    it('routes standard document with both keys to two_stage for pedagogical distractor hardening', () => {
      const routing = QuizGenerationService.resolveAutoPipelineMode(
        { handoutPages: singlePage },
        'gemini-api-key',
        'groq-api-key'
      );
      expect(routing.resolvedMode).toBe('two_stage');
      expect(routing.reason).toContain('Dual-Stage');
    });

    it('routes multi-chapter document to two_stage for cross-chapter balance', () => {
      const multiChapterPages: HandoutPage[] = [
        { pageNumber: 1, text: 'Chapter 1 text', chapterTitle: 'Ch1.pdf' },
        { pageNumber: 2, text: 'Chapter 2 text', chapterTitle: 'Ch2.pdf' }
      ];
      const routing = QuizGenerationService.resolveAutoPipelineMode(
        { handoutPages: multiChapterPages },
        'gemini-api-key',
        'groq-api-key'
      );
      expect(routing.resolvedMode).toBe('two_stage');
      expect(routing.reason).toContain('Multi-chapter reviewer (2 chapters)');
    });

    it('routes massive text (>15k tokens) to gemini_direct for 1M context processing', () => {
      // 16,000 tokens * 4 chars/token = 64,000 characters
      const massiveText = 'A'.repeat(65000);
      const massivePages: HandoutPage[] = [
        { pageNumber: 1, text: massiveText }
      ];

      const routing = QuizGenerationService.resolveAutoPipelineMode(
        { handoutPages: massivePages },
        'gemini-api-key',
        'groq-api-key'
      );
      expect(routing.resolvedMode).toBe('gemini_direct');
      expect(routing.reason).toContain('routed to Gemini 1M context');
    });
  });

  describe('end-to-end auto routing execution in generateQuiz', () => {
    it('defaults pipelineMode to auto and executes two_stage when both keys present', async () => {
      const stages: string[] = [];
      const result = await service.generateQuiz({
        handoutPages: [{ pageNumber: 1, text: 'General biology notes' }],
        apiKey: 'gemini-key',
        groqApiKey: 'groq-key',
        pipelineMode: 'auto',
        onStageChange: (stage) => stages.push(stage)
      });

      expect(result.pipelineMode).toBe('two_stage');
      expect(mockGeminiExtractor.extract).toHaveBeenCalledTimes(1);
      expect(mockGroqReviewer.reviewAndPolish).toHaveBeenCalledTimes(1);
      expect(stages).toContain('extracting');
      expect(stages).toContain('reviewing');
    });

    it('defaults to auto when pipelineMode is undefined in options', async () => {
      const result = await service.generateQuiz({
        handoutPages: [{ pageNumber: 1, text: 'General biology notes' }],
        apiKey: 'gemini-key',
        groqApiKey: 'groq-key'
      });

      expect(result.pipelineMode).toBe('two_stage');
      expect(mockGeminiExtractor.extract).toHaveBeenCalledTimes(1);
      expect(mockGroqReviewer.reviewAndPolish).toHaveBeenCalledTimes(1);
    });
  });
});
