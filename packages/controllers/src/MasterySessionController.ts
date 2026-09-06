import { IQuizRepository, ISessionRepository, MemorySessionRepository } from '@quiz-creator/core/repositories';
import { MasteryEngineService, SAMPLE_QUIZ_ID, SAMPLE_QUIZ_QUESTIONS } from '@quiz-creator/core/services';
import { SessionType, QuestionProgress, SessionMasterySummary, QuizQuestion } from '@quiz-creator/types';

function isUuid(str?: string | null): boolean {
  return Boolean(str && typeof str === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str));
}

export interface SubmittedAnswer {
  selectedOptionId?: number;
  answerText?: string;
  answerMode?: 'learn' | 'identification';
}

function normalizeSubmittedAnswer(value: string, mode: SubmittedAnswer['answerMode'] = 'learn'): string {
  const normalized = value.trim().toLocaleLowerCase();
  return mode === 'identification' ? normalized : normalized.replace(/\\s+/g, ' ');
}

function resolveSubmittedAnswer(question: QuizQuestion, submittedAnswer: SubmittedAnswer): boolean {
  const isTypedAnswer = question.question_type === 'typed_answer' || !Array.isArray(question.options) || question.options.length === 0;
  if (isTypedAnswer) {
    if (typeof submittedAnswer.answerText !== 'string') {
      throw new Error('A typed answer is required');
    }
    const expected = question.answer_text?.trim() || question.options?.[question.correct_answer]?.trim() || '';
    return normalizeSubmittedAnswer(submittedAnswer.answerText, submittedAnswer.answerMode) ===
      normalizeSubmittedAnswer(expected, submittedAnswer.answerMode);
  }

  if (!Number.isInteger(submittedAnswer.selectedOptionId)) {
    throw new Error('A selected answer option is required');
  }
  return submittedAnswer.selectedOptionId === question.correct_answer;
}

export class MasterySessionController {
  private static sampleSessionRepo: ISessionRepository = new MemorySessionRepository();

  constructor(
    private sessionRepo: ISessionRepository,
    private quizRepo?: IQuizRepository,
    sampleSessionRepo?: ISessionRepository
  ) {
    if (sampleSessionRepo) MasterySessionController.sampleSessionRepo = sampleSessionRepo;
  }

  async getOrStartSession(quizId: string, sessionType: SessionType = 'initial', userId?: string, providedQuestions?: QuizQuestion[]) {
    if (!isUuid(quizId) || quizId === SAMPLE_QUIZ_ID) {
      const sessionPromise = MasterySessionController.sampleSessionRepo.getActiveSession(quizId, userId);
      const questionsPromise = providedQuestions
        ? Promise.resolve(providedQuestions)
        : quizId === SAMPLE_QUIZ_ID
          ? Promise.resolve(SAMPLE_QUIZ_QUESTIONS)
          : this.quizRepo?.getQuestionsByQuizId(quizId, userId);
      if (!questionsPromise) throw new Error('Quiz repository is required to start this session');
      const [existingSession, questions] = await Promise.all([sessionPromise, questionsPromise]);
      let session = existingSession;
      let progressList: QuestionProgress[] = [];
      if (!session) session = await MasterySessionController.sampleSessionRepo.createSession(quizId, sessionType, new Date().toISOString(), userId);
      else progressList = await MasterySessionController.sampleSessionRepo.getProgressForSession(session.id, userId);
      const existingMap = new Map(progressList.map(p => [p.question_id, p]));
      const missing = questions.filter(q => !existingMap.has(q.id));
      if (missing.length > 0) {
        const saved = await MasterySessionController.sampleSessionRepo.batchSaveQuestionProgress(missing.map(q => ({ session_id: session!.id, question_id: q.id, streak_count: 0, has_missed: false, locked: false })), userId);
        progressList = [...progressList, ...saved];
      }
      return { session, questions, progress: progressList };
    }

    if (!this.quizRepo && !providedQuestions) throw new Error('Quiz repository is required to start this session');
    if (!providedQuestions && userId && this.quizRepo?.getQuizById) {
      const accessibleQuiz = await this.quizRepo.getQuizById(quizId, userId);
      if (!accessibleQuiz) throw new Error('Quiz not found or access is restricted');
    }
    const sessionPromise = this.sessionRepo.getActiveSession(quizId, userId);
    const questionsPromise = providedQuestions ? Promise.resolve(providedQuestions) : this.quizRepo!.getQuestionsByQuizId(quizId, userId);
    const [existingSession, questions] = await Promise.all([sessionPromise, questionsPromise]);
    let session = existingSession;
    let progressList: QuestionProgress[] = [];
    if (!session) session = await this.sessionRepo.createSession(quizId, sessionType, new Date().toISOString(), userId);
    else progressList = await this.sessionRepo.getProgressForSession(session.id, userId);
    const existingMap = new Map(progressList.map(p => [p.question_id, p]));
    const missing = questions.filter(q => !existingMap.has(q.id));
    if (missing.length > 0) {
      const saved = await this.sessionRepo.batchSaveQuestionProgress(missing.map(q => ({ session_id: session!.id, question_id: q.id, streak_count: 0, has_missed: false, locked: false })), userId);
      progressList = [...progressList, ...saved];
    }
    return { session, questions, progress: progressList };
  }

  async recordAnswer(
    sessionId: string,
    questionId: string,
    isCorrect: boolean,
    sessionType: SessionType = 'initial',
    userId?: string,
    _latencyMs?: number,
    submittedAnswer?: SubmittedAnswer
  ) {
    const repository = isUuid(sessionId) ? this.sessionRepo : MasterySessionController.sampleSessionRepo;
    const session = repository.getSessionById ? await repository.getSessionById(sessionId, userId) : null;
    if (userId && !session) throw new Error('Session not found or access is restricted');

    let resolvedIsCorrect = isCorrect;
    if (session && this.quizRepo) {
      const questions = session.quiz_id === SAMPLE_QUIZ_ID
        ? SAMPLE_QUIZ_QUESTIONS
        : await this.quizRepo.getQuestionsByQuizId(session.quiz_id, userId);
      const question = questions.find((candidate) => candidate.id === questionId);
      if (!question) throw new Error('Question does not belong to this session');
      // New clients submit the answer itself; legacy queued events may omit it and
      // continue using their stored correctness value for compatibility.
      if (submittedAnswer) resolvedIsCorrect = resolveSubmittedAnswer(question, submittedAnswer);
    }

    const progressList = await repository.getProgressForSession(sessionId, userId);
    const current = progressList.find(p => p.question_id === questionId);
    if (userId && !current) throw new Error('Question progress not found');
    const base = current || { session_id: sessionId, question_id: questionId, streak_count: 0, has_missed: false, locked: false };
    const updated = { ...base, ...MasteryEngineService.calculateNextProgress(base, resolvedIsCorrect, sessionType) };
    return repository.saveQuestionProgress(updated, userId);
  }

  async completeSession(sessionId: string, quizId: string, userId?: string, summary?: SessionMasterySummary) {
    const repository = isUuid(sessionId) ? this.sessionRepo : MasterySessionController.sampleSessionRepo;
    const existing = repository.getSessionById ? await repository.getSessionById(sessionId, userId) : null;
    if (userId && (!existing || existing.quiz_id !== quizId)) throw new Error('Session not found or access is restricted');
    const completed = await repository.updateSessionStatus(sessionId, 'completed', new Date().toISOString(), userId);
    const nextPlan = MasteryEngineService.planNextSession(completed);
    let scheduledSession = null;
    if (nextPlan) {
      scheduledSession = await repository.createSession(quizId, nextPlan.sessionType, nextPlan.availableAt, userId);
      await repository.updateSessionStatus(scheduledSession.id, 'scheduled', undefined, userId);
    }
    return { completedSession: completed, scheduledSession, nextPlan, summary: summary || null };
  }
}
