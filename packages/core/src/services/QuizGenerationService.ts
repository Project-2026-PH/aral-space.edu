import { RawAiQuestion, GeneratedQuizResult, HandoutPage, AiPipelineMode, UserAuthoringProfile } from '@quiz-creator/types';
import { GeminiExtractor } from './ai/GeminiExtractor';
import { GroqReviewer } from './ai/GroqReviewer';
import { VerbatimExtractor } from './ai/VerbatimExtractor';
import { VerbatimQuizBuilder } from './ai/VerbatimQuizBuilder';
import { AiModelConfig } from './ai/AiModelConfig';
import { LocalQuizGenerator } from './LocalQuizGenerator';

export interface GenerateOptions {
  handoutPages: HandoutPage[];
  subjectName?: string;
  pageStart?: number;
  pageEnd?: number;
  targetCount?: number;
  authoringProfile?: UserAuthoringProfile;
  pipelineMode?: AiPipelineMode;
  apiKey?: string;       // Gemini API key
  groqApiKey?: string;   // Groq API key
  onChunk?: (streamChunk: string) => void;
  onStageChange?: (stage: 'extracting' | 'reviewing' | 'fallback' | 'complete', detail: string, model?: string) => void;
}

export class QuizGenerationService {
  private geminiExtractor: GeminiExtractor;
  private groqReviewer: GroqReviewer;
  private verbatimExtractor: VerbatimExtractor;

  constructor(
    geminiExtractor: GeminiExtractor = new GeminiExtractor(),
    groqReviewer: GroqReviewer = new GroqReviewer(),
    verbatimExtractor: VerbatimExtractor = new VerbatimExtractor()
  ) {
    this.geminiExtractor = geminiExtractor;
    this.groqReviewer = groqReviewer;
    this.verbatimExtractor = verbatimExtractor;
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

  /**
   * Intelligently selects the optimal pipeline mode based on material size,
   * chapter distribution, and available AI provider keys.
   */
  static resolveAutoPipelineMode(
    options: GenerateOptions,
    geminiKey?: string,
    groqKey?: string
  ): { resolvedMode: 'two_stage' | 'groq_direct' | 'gemini_direct'; reason: string } {
    const totalChars = options.handoutPages.reduce((acc, p) => acc + (p.text?.length || 0), 0);
    const estimatedTokens = Math.ceil(totalChars / 4);
    const uniqueChapters = new Set(
      options.handoutPages.map((p) => p.chapterTitle).filter((c): c is string => Boolean(c && c.trim()))
    );
    const isMultiChapter = uniqueChapters.size > 1;

    // Single provider available
    if (geminiKey && !groqKey) {
      return {
        resolvedMode: 'gemini_direct',
        reason: 'Gemini provider active (1M context high-yield single pass).'
      };
    }
    if (!geminiKey && groqKey) {
      return {
        resolvedMode: 'groq_direct',
        reason: 'Groq provider active (high-speed LPU).'
      };
    }

    // Both providers available: Gemini Flash is primary free workhorse (1M context + resilient single-pass)
    return {
      resolvedMode: 'gemini_direct',
      reason: isMultiChapter
        ? `Multi-chapter reviewer (${uniqueChapters.size} chapters); routed to Gemini Flash for unified cross-chapter grounding.`
        : 'Gemini Flash active as primary high-yield engine with Groq fallback.'
    };
  }

  async generateQuiz(options: GenerateOptions): Promise<GeneratedQuizResult> {
    const pipelineStartTime = Date.now();
    const geminiKey = options.apiKey || process.env.GEMINI_API_KEY || process.env.GOOGLE_GENAI_API_KEY;
    const groqKey = options.groqApiKey || process.env.GROQ_API_KEY;
    let mode = options.pipelineMode || 'auto';
    let autoReason: string | undefined;

    if (mode === 'auto') {
      const autoRouting = QuizGenerationService.resolveAutoPipelineMode(options, geminiKey, groqKey);
      mode = autoRouting.resolvedMode;
      autoReason = autoRouting.reason;
    }

    const totalChars = options.handoutPages.reduce((acc, p) => acc + (p.text?.length || 0), 0);
    const estimatedTokens = Math.ceil(totalChars / 4);

    console.log(`\n[QuizGenerationService] === GENERATION PIPELINE START ===`);
    console.log(`[QuizGenerationService] Mode: "${mode}" (${autoReason || 'explicit selection'})`);
    console.log(`[QuizGenerationService] Provider Keys: [Gemini: ${Boolean(geminiKey)}, Groq: ${Boolean(groqKey)}]`);
    console.log(`[QuizGenerationService] Material: ${options.handoutPages.length} pages | ${totalChars} chars | ~${estimatedTokens} tokens`);

    const targetCount = options.targetCount || options.authoringProfile?.targetCount || 10;

    // Deterministic local fallback when no provider keys are available.
    if (!geminiKey && !groqKey) {
      console.warn(`[QuizGenerationService] No API keys configured. Generating quiz locally from source material.`);
      options.onStageChange?.('fallback', 'No API keys detected; generating questions locally from the source material...', 'local');
      const questions = LocalQuizGenerator.generate({
        handoutPages: options.handoutPages,
        subjectName: options.subjectName,
        targetCount
      });
      return {
        sourceModel: 'local/deterministic-generator',
        tokensUsed: 0,
        pipelineMode: 'local',
        questions
      };
    }

    // 0. Verbatim Exact Mode (Zero-variance extraction + programmatic distractor assembly)
    if (mode === 'verbatim_exact') {
      const verbatimModel = geminiKey
        ? AiModelConfig.getGeminiModel()
        : AiModelConfig.getGroqModel();

      console.log(`[QuizGenerationService] Executing verbatim_exact with model "${verbatimModel}"...`);
      options.onStageChange?.(
        'extracting',
        'Stage 1/2: Extracting verbatim definitions at temperature 0.0...',
        verbatimModel
      );

      const extractResult = await this.verbatimExtractor.extract({
        apiKey: geminiKey,
        groqApiKey: groqKey,
        handoutPages: options.handoutPages,
        subjectName: options.subjectName,
        targetCount,
        onChunk: options.onChunk
      });

      options.onStageChange?.(
        'reviewing',
        'Stage 2/2: Validating verbatim quotes & assembling distractors...',
        'verbatim-assembler'
      );

      const fullSourceText = options.handoutPages.map((p) => p.text).join('\n');
      const questions = VerbatimQuizBuilder.assembleVerbatimQuiz(
        extractResult.pairs,
        fullSourceText,
        targetCount
      );

      console.log(`[QuizGenerationService] verbatim_exact finished in ${Date.now() - pipelineStartTime}ms with ${questions.length} questions.`);
      return {
        questions,
        sourceModel: `verbatim/${extractResult.model}`,
        tokensUsed: extractResult.tokensUsed,
        pipelineMode: 'verbatim_exact'
      };
    }

    // 1. Direct Groq Mode
    if (mode === 'groq_direct' && groqKey) {
      const groqModel = AiModelConfig.getGroqModel();
      console.log(`[QuizGenerationService] Executing groq_direct with model "${groqModel}"...`);
      options.onStageChange?.('extracting', `Generating questions with Groq (${groqModel})...`, groqModel);
      const result = await this.groqReviewer.generateDirect({
        apiKey: groqKey,
        modelName: groqModel,
        handoutPages: options.handoutPages,
        subjectName: options.subjectName,
        targetCount,
        authoringProfile: options.authoringProfile,
        onChunk: options.onChunk
      });
      console.log(`[QuizGenerationService] groq_direct completed in ${Date.now() - pipelineStartTime}ms with ${result.questions.length} questions.`);
      return {
        questions: result.questions,
        sourceModel: `groq/${result.model}`,
        tokensUsed: result.tokensUsed,
        pipelineMode: 'groq_direct'
      };
    }

    // 2. Direct Gemini Mode
    if (mode === 'gemini_direct' && geminiKey) {
      const geminiModel = AiModelConfig.getGeminiModel();
      console.log(`[QuizGenerationService] Executing gemini_direct with model "${geminiModel}"...`);
      options.onStageChange?.('extracting', `Generating questions with Gemini (${geminiModel})...`, geminiModel);
      try {
        const result = await this.geminiExtractor.extract({
          apiKey: geminiKey,
          modelName: geminiModel,
          handoutPages: options.handoutPages,
          subjectName: options.subjectName,
          targetCount,
          authoringProfile: options.authoringProfile,
          onChunk: options.onChunk
        });
        console.log(`[QuizGenerationService] gemini_direct completed in ${Date.now() - pipelineStartTime}ms with ${result.questions.length} questions.`);
        return {
          questions: result.questions,
          sourceModel: `gemini/${result.model}`,
          tokensUsed: result.tokensUsed,
          pipelineMode: 'gemini_direct'
        };
      } catch (geminiErr: any) {
        console.error(`[QuizGenerationService] Direct Gemini extraction failed: ${geminiErr.message}`);
        if (groqKey) {
          const fallbackGroqModel = AiModelConfig.getGroqModel();
          console.log(`[QuizGenerationService] Falling back to Groq with "${fallbackGroqModel}"...`);
          options.onStageChange?.('fallback', `Gemini unavailable (${geminiErr.message}). Falling back to Groq (${fallbackGroqModel})...`, fallbackGroqModel);
          const groqDirect = await this.groqReviewer.generateDirect({
            apiKey: groqKey,
            modelName: fallbackGroqModel,
            handoutPages: options.handoutPages,
            subjectName: options.subjectName,
            targetCount,
            authoringProfile: options.authoringProfile,
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
    }

    // 3. Two-Stage Pipeline (Gemini Draft -> Groq Polish)
    if (geminiKey) {
      const geminiModel = AiModelConfig.getGeminiModel();
      const stage1Start = Date.now();
      console.log(`[QuizGenerationService] Stage 1/2 starting: Gemini draft with "${geminiModel}"...`);
      // Stage 1: Extraction & Grounding with Gemini
      options.onStageChange?.('extracting', `Stage 1/2: Extracting core concepts & drafting with Gemini (${geminiModel})...`, geminiModel);
      let stage1Result: { questions: RawAiQuestion[]; tokensUsed: number; model: string };

      try {
        stage1Result = await this.geminiExtractor.extract({
          apiKey: geminiKey,
          modelName: geminiModel,
          handoutPages: options.handoutPages,
          subjectName: options.subjectName,
          targetCount,
          authoringProfile: options.authoringProfile,
          onChunk: options.onChunk
        });
        console.log(`[QuizGenerationService] Stage 1/2 Gemini draft succeeded in ${Date.now() - stage1Start}ms (${stage1Result.questions.length} candidate questions)`);
      } catch (geminiErr: any) {
        console.error(`[QuizGenerationService] Stage 1/2 Gemini extraction failed after ${Date.now() - stage1Start}ms:`, geminiErr.message);
        // Fallback to Groq direct if Gemini fails and Groq is available
        if (groqKey) {
          const fallbackGroqModel = AiModelConfig.getGroqModel();
          console.log(`[QuizGenerationService] Falling back to direct Groq with "${fallbackGroqModel}"...`);
          options.onStageChange?.('fallback', `Gemini extraction failed (${geminiErr.message}). Falling back to Groq (${fallbackGroqModel})...`, fallbackGroqModel);
          const groqDirect = await this.groqReviewer.generateDirect({
            apiKey: groqKey,
            modelName: fallbackGroqModel,
            handoutPages: options.handoutPages,
            subjectName: options.subjectName,
            targetCount,
            authoringProfile: options.authoringProfile,
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
        const groqReviewModel = AiModelConfig.getGroqModel();
        const stage2Start = Date.now();
        console.log(`[QuizGenerationService] Stage 2/2 starting: Groq audit with "${groqReviewModel}"...`);
        options.onStageChange?.('reviewing', `Stage 2/2: Polishing distractors & verifying pedagogy with Groq (${groqReviewModel})...`, groqReviewModel);
        try {
          const stage2Result = await this.groqReviewer.reviewAndPolish({
            apiKey: groqKey,
            modelName: groqReviewModel,
            candidateQuestions: stage1Result.questions,
            subjectName: options.subjectName,
            authoringProfile: options.authoringProfile,
            onChunk: options.onChunk
          });
          console.log(`[QuizGenerationService] Stage 2/2 Groq audit succeeded in ${Date.now() - stage2Start}ms`);

          if (QuizGenerationService.validateQuestions(stage2Result.questions)) {
            console.log(`[QuizGenerationService] Two-stage pipeline fully complete in ${Date.now() - pipelineStartTime}ms.`);
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
          console.warn(`[QuizGenerationService] Stage 2/2 Groq review bypassed (${groqErr.message}). Using Stage 1 questions.`);
          options.onStageChange?.('fallback', `Groq review bypassed (${groqErr.message}). Using validated Gemini questions.`, stage1Result.model);
        }
      }

      console.log(`[QuizGenerationService] Direct Gemini pipeline complete in ${Date.now() - pipelineStartTime}ms.`);
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
      const groqModel = AiModelConfig.getGroqModel();
      options.onStageChange?.('extracting', `Generating questions with Groq (${groqModel})...`, groqModel);
      const result = await this.groqReviewer.generateDirect({
        apiKey: groqKey,
        modelName: groqModel,
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
