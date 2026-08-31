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
      detail: 'Validating source material...'
    });

    let pages = dto.pdfPages || [];
    if (pages.length === 0 && dto.text) {
      pages = PdfExtractionService.extractTextFromMockOrPlain(dto.text);
    }

    if (pages.length === 0) {
      sendProgress({
        progress: 0,
        message: 'Error',
        detail: 'No text or PDF pages provided for quiz generation.'
      });
      throw new Error('No content provided');
    }

    sendProgress({
      progress: 30,
      message: 'Processing Material',
      detail: `Extracted ${pages.length} pages of source text`
    });

    sendProgress({
      progress: 50,
      message: 'Generating Questions',
      detail: 'Connecting to AI model...'
    });

    let liveTokens = 0;
    const generated = await this.genService.generateQuiz({
      handoutPages: pages,
      pageStart: dto.pageStart,
      pageEnd: dto.pageEnd,
      onChunk: (chunk) => {
        liveTokens += Math.ceil(chunk.length / 4);
        sendProgress({
          progress: Math.min(85, 50 + Math.floor(liveTokens / 20)),
          message: 'Drafting questions',
          detail: `Streamed ${liveTokens} tokens...`,
          tokensCount: liveTokens
        });
      }
    });

    sendProgress({
      progress: 90,
      message: 'Saving Quiz',
      detail: `Saving ${generated.questions.length} questions to library...`
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
      detail: 'Quiz ready for practice!',
      quizId: createdQuiz.id
    });

    return { quizId: createdQuiz.id };
  }
}
