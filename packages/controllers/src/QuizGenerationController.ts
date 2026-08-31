import { IQuizRepository, QuizGenerationService, PdfExtractionService } from '@quiz-creator/core';
import { GenerateQuizRequestDto, QuizGenerationProgressDto } from '@quiz-creator/types';

export class QuizGenerationController {
  constructor(
    private quizRepo: IQuizRepository,
    private genService: QuizGenerationService = new QuizGenerationService()
  ) {}

  async handleStreamingGeneration(
    dto: GenerateQuizRequestDto,
    sendProgress: (data: QuizGenerationProgressDto) => void,
    userId?: string
  ): Promise<{ quizId: string }> {
    sendProgress({
      progress: 5,
      message: 'Initializing',
      detail: 'Validating source material...',
      stage: 'extracting'
    });

    let pages = dto.pdfPages || [];
    if (pages.length === 0 && dto.text) {
      pages = PdfExtractionService.extractTextFromMockOrPlain(dto.text);
    }

    if (pages.length === 0) {
      sendProgress({
        progress: 0,
        message: 'Error',
        detail: 'No text or PDF pages provided for quiz generation.',
        stage: 'error'
      });
      throw new Error('No content provided');
    }

    sendProgress({
      progress: 25,
      message: 'Processing Material',
      detail: `Extracted ${pages.length} pages of source text`,
      stage: 'extracting'
    });

    let liveTokens = 0;
    const generated = await this.genService.generateQuiz({
      handoutPages: pages,
      pageStart: dto.pageStart,
      pageEnd: dto.pageEnd,
      pipelineMode: dto.pipelineMode,
      apiKey: dto.apiKey,
      groqApiKey: dto.groqApiKey,
      onStageChange: (stage, detail, model) => {
        const progressMap = {
          extracting: 40,
          reviewing: 75,
          fallback: 60,
          complete: 95
        };
        sendProgress({
          progress: progressMap[stage] || 50,
          message: stage === 'reviewing' ? 'Stage 2/2: Reviewing Pedagogy' : 'Stage 1/2: Extracting Concepts',
          detail,
          stage,
          modelUsed: model
        });
      },
      onChunk: (chunk) => {
        liveTokens += Math.ceil(chunk.length / 4);
        sendProgress({
          progress: Math.min(90, 45 + Math.floor(liveTokens / 30)),
          message: 'Drafting & Polishing questions',
          detail: `Streaming output (${liveTokens} tokens)...`,
          tokensCount: liveTokens
        });
      }
    });

    sendProgress({
      progress: 95,
      message: 'Saving Quiz',
      detail: `Saving ${generated.questions.length} questions (${generated.sourceModel}) to library...`,
      stage: 'complete'
    });

    const title = dto.title || dto.handoutName || 'Generated Handout Quiz';
    const createdQuiz = await this.quizRepo.createQuiz({
      title,
      subject_id: dto.subjectId || null,
      handout_name: dto.handoutName || null,
      source_model: generated.sourceModel,
      questions: generated.questions.map((q, idx) => ({
        question_text: q.question,
        options: q.options,
        correct_answer: q.correct_answer,
        explanation: q.explanation,
        source_pages: q.source_pages || [],
        order_index: idx
      }))
    }, userId);

    sendProgress({
      progress: 100,
      message: 'Complete',
      detail: `Quiz ready! (Powered by ${generated.sourceModel})`,
      quizId: createdQuiz.id,
      stage: 'complete',
      modelUsed: generated.sourceModel
    });

    return { quizId: createdQuiz.id };
  }
}
