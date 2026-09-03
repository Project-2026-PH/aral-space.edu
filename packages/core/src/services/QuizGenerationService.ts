import { RawAiQuestion, GeneratedQuizResult, HandoutPage, AiPipelineMode } from '@quiz-creator/types';
import { GeminiExtractor } from './ai/GeminiExtractor';
import { GroqReviewer } from './ai/GroqReviewer';

export interface GenerateOptions {
  handoutPages: HandoutPage[];
  subjectName?: string;
  pageStart?: number;
  pageEnd?: number;
  pipelineMode?: AiPipelineMode;
  apiKey?: string;       // Gemini API key
  groqApiKey?: string;   // Groq API key
  onChunk?: (streamChunk: string) => void;
  onStageChange?: (stage: 'extracting' | 'reviewing' | 'fallback' | 'complete', detail: string, model?: string) => void;
}

export class QuizGenerationService {
  private geminiExtractor: GeminiExtractor;
  private groqReviewer: GroqReviewer;

  constructor(
    geminiExtractor: GeminiExtractor = new GeminiExtractor(),
    groqReviewer: GroqReviewer = new GroqReviewer()
  ) {
    this.geminiExtractor = geminiExtractor;
    this.groqReviewer = groqReviewer;
  }

  static validateQuestions(questions: any[]): questions is RawAiQuestion[] {
    if (!Array.isArray(questions) || questions.length === 0) return false;
    return questions.every((q) => {
      return (
        typeof q.question === 'string' &&
        q.question.trim().length > 0 &&
        Array.isArray(q.options) &&
        q.options.length === 4 &&
        q.options.every((opt: any) => typeof opt === 'string' && opt.trim().length > 0) &&
        typeof q.correct_answer === 'number' &&
        q.correct_answer >= 0 &&
        q.correct_answer <= 3 &&
        typeof q.explanation === 'string' &&
        q.explanation.trim().length > 0
      );
    });
  }

  static getMockQuestions(pageStart: number = 1): RawAiQuestion[] {
    return [
      {
        question: "What is the primary role of active recall in spaced-repetition mastery?",
        options: [
          "Strengthens memory neural pathways through retrieval practice",
          "Passive re-reading of textbooks",
          "Highlighting notes with multiple colors",
              "Listening to lectures in background"
        ],
        correct_answer: 0,
        explanation: "Active recall forces retrieval from long-term storage, consolidating neural memory traces.",
        source_pages: [pageStart]
      },
      {
        question: "Why does the Mastery Engine lock questions after consecutive correct streaks?",
        options: [
          "To prevent endless loops once a concept is proven mastered",
          "To delete questions permanently",
          "To disable feedback scoring",
          "To skip remaining study chapters"
        ],
        correct_answer: 0,
        explanation: "Locking prevents repetitive overlearning during a single active session.",
        source_pages: [pageStart]
      },
      {
        question: "What is the optimal spacing between initial practice and the first review session?",
        options: ["24 hours", "10 minutes", "1 month", "Same hour"],
        correct_answer: 0,
        explanation: "24 hours is the optimal interval to consolidate short-term to long-term memory according to the Ebbinghaus forgetting curve.",
        source_pages: [pageStart]
      }
    ];
  }

  async generateQuiz(options: GenerateOptions): Promise<GeneratedQuizResult> {
    const geminiKey = options.apiKey || process.env.GEMINI_API_KEY || process.env.GOOGLE_GENAI_API_KEY;
    const groqKey = options.groqApiKey || process.env.GROQ_API_KEY;
    const mode = options.pipelineMode || 'two_stage';

    // Mock fallback when no keys are provided
    if (!geminiKey && !groqKey) {
      options.onStageChange?.('fallback', 'No API keys detected; generating demo quiz data...', 'mock');
      return {
        sourceModel: 'mock-demo-generator',
        tokensUsed: 450,
        pipelineMode: 'mock',
        questions: QuizGenerationService.getMockQuestions(options.pageStart || 1)
      };
    }

    // 1. Direct Groq Mode
    if (mode === 'groq_direct' && groqKey) {
      options.onStageChange?.('extracting', 'Generating questions with Groq Llama-3.3-70b...', 'llama-3.3-70b-versatile');
      const result = await this.groqReviewer.generateDirect({
        apiKey: groqKey,
        handoutPages: options.handoutPages,
        subjectName: options.subjectName,
        onChunk: options.onChunk
      });
      return {
        questions: result.questions,
        sourceModel: `groq/${result.model}`,
        tokensUsed: result.tokensUsed,
        pipelineMode: 'groq_direct'
      };
    }

    // 2. Direct Gemini Mode
    if (mode === 'gemini_direct' && geminiKey) {
      options.onStageChange?.('extracting', 'Generating questions with Gemini 3.7 Flash...', 'gemini-2.5-flash');
      const result = await this.geminiExtractor.extract({
        apiKey: geminiKey,
        handoutPages: options.handoutPages,
        subjectName: options.subjectName,
        onChunk: options.onChunk
      });
      return {
        questions: result.questions,
        sourceModel: `gemini/${result.model}`,
        tokensUsed: result.tokensUsed,
        pipelineMode: 'gemini_direct'
      };
    }

    // 3. Two-Stage Pipeline (Gemini Stage 1 Extraction -> Groq Stage 2 Polish)
    if (geminiKey) {
      // Stage 1: Extraction & Grounding with Gemini
      options.onStageChange?.('extracting', 'Stage 1/2: Extracting core concepts & drafting with Gemini 3.7 Flash...', 'gemini-2.5-flash');
      let stage1Result: { questions: RawAiQuestion[]; tokensUsed: number; model: string };

      try {
        stage1Result = await this.geminiExtractor.extract({
          apiKey: geminiKey,
          handoutPages: options.handoutPages,
          subjectName: options.subjectName,
          onChunk: options.onChunk
        });
      } catch (geminiErr: any) {
        // Fallback to Groq direct if Gemini fails and Groq is available
        if (groqKey) {
          options.onStageChange?.('fallback', `Gemini extraction failed (${geminiErr.message}). Falling back to Groq Llama 3.3...`, 'llama-3.3-70b-versatile');
          const groqDirect = await this.groqReviewer.generateDirect({
            apiKey: groqKey,
            handoutPages: options.handoutPages,
            subjectName: options.subjectName,
            onChunk: options.onChunk
          });
          return {
            questions: groqDirect.questions,
            sourceModel: `groq/${groqDirect.model}`,
            tokensUsed: groqDirect.tokensUsed,
            pipelineMode: 'groq_fallback'
          };
        }
        throw geminiErr;
      }

      // Stage 2: Distractor Hardening & Pedagogy Review with Groq
      if (groqKey) {
        options.onStageChange?.('reviewing', 'Stage 2/2: Polishing distractors & verifying pedagogy with Groq Llama 3.3 70B...', 'llama-3.3-70b-versatile');
        try {
          const stage2Result = await this.groqReviewer.reviewAndPolish({
            apiKey: groqKey,
            candidateQuestions: stage1Result.questions,
            subjectName: options.subjectName,
            onChunk: options.onChunk
          });

          if (QuizGenerationService.validateQuestions(stage2Result.questions)) {
            return {
              questions: stage2Result.questions,
              sourceModel: `gemini+groq/two-stage (${stage1Result.model} -> ${stage2Result.model})`,
              tokensUsed: stage1Result.tokensUsed + stage2Result.tokensUsed,
              pipelineMode: 'two_stage',
              stage1Model: stage1Result.model,
              stage2Model: stage2Result.model,
              reviewedByGroq: true
            };
          }
        } catch (groqErr: any) {
          // Graceful fallback to Stage 1 output if Groq review encounters rate limit or network error
          options.onStageChange?.('fallback', `Groq review bypassed (${groqErr.message}). Using validated Gemini questions.`, stage1Result.model);
        }
      }

      // Return Gemini Stage 1 output if Groq key wasn't present or was bypassed
      return {
        questions: stage1Result.questions,
        sourceModel: `gemini/${stage1Result.model}`,
        tokensUsed: stage1Result.tokensUsed,
        pipelineMode: 'gemini_direct',
        stage1Model: stage1Result.model,
        reviewedByGroq: false
      };
    }

    // 4. Fallback to Groq direct if only Groq key is present
    if (groqKey) {
      options.onStageChange?.('extracting', 'Generating questions with Groq Llama-3.3-70b...', 'llama-3.3-70b-versatile');
      const result = await this.groqReviewer.generateDirect({
        apiKey: groqKey,
        handoutPages: options.handoutPages,
        subjectName: options.subjectName,
        onChunk: options.onChunk
      });
      return {
        questions: result.questions,
        sourceModel: `groq/${result.model}`,
        tokensUsed: result.tokensUsed,
        pipelineMode: 'groq_direct'
      };
    }

    throw new Error('No supported AI provider configured.');
  }
}
