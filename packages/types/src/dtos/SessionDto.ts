import { SessionType, QuizSession } from '../models/QuizSession';
import { QuestionProgress } from '../models/QuestionProgress';

export interface StartSessionDto {
  quizId: string;
  sessionType?: SessionType;
}

export interface AnswerQuestionDto {
  sessionId: string;
  questionId: string;
  isCorrect: boolean;
}

export interface NextSessionPlan {
  sessionType: SessionType;
  availableAt: string;
  daysInterval: number;
}

export interface ScheduleNextResult {
  scheduled: boolean;
  reason?: string;
  session?: QuizSession;
  plan?: NextSessionPlan;
}
