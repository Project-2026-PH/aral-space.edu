import { QuizSession, QuestionProgress, SessionType, SessionStatus } from '@quiz-creator/types';

export interface ISessionRepository {
  getActiveSession(quizId: string, userId?: string): Promise<QuizSession | null>;
  getScheduledSession(quizId: string, userId?: string): Promise<QuizSession | null>;
  getLatestCompletedSession(quizId: string, userId?: string): Promise<QuizSession | null>;
  listSessions(quizId: string, userId?: string): Promise<QuizSession[]>;
  createSession(quizId: string, sessionType: SessionType, availableAt?: string, userId?: string): Promise<QuizSession>;
  updateSessionStatus(sessionId: string, status: SessionStatus, completedAt?: string): Promise<QuizSession>;
  
  getProgressForSession(sessionId: string): Promise<QuestionProgress[]>;
  saveQuestionProgress(progress: QuestionProgress): Promise<QuestionProgress>;
  batchSaveQuestionProgress(progressList: QuestionProgress[]): Promise<QuestionProgress[]>;
}
