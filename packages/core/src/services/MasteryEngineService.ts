import { QuizQuestion, QuizSession, QuestionProgress, SessionType, ScheduleNextResult, NextSessionPlan } from '@quiz-creator/types';

export const SESSION_INTERVALS: Record<SessionType, number> = {
  initial: 0,
  review_24h: 1,
  review_3d: 3,
  review_7d: 7,
  review_14d: 14,
};

export const NEXT_SESSION_MAP: Record<SessionType, SessionType | null> = {
  initial: 'review_24h',
  review_24h: 'review_3d',
  review_3d: 'review_7d',
  review_7d: 'review_14d',
  review_14d: null,
};

export class MasteryEngineService {
  static isAllQuestionsLocked(questions: QuizQuestion[], progressMap: Map<string, QuestionProgress>): boolean {
    if (questions.length === 0) return false;
    return questions.every((q) => progressMap.get(q.id)?.locked);
  }

  static calculateNextProgress(
    current: QuestionProgress,
    isCorrect: boolean,
    sessionType: SessionType = 'initial'
  ): { streak_count: number; has_missed: boolean; locked: boolean; locked_at: string | null } {
    if (isCorrect) {
      const newStreak = current.streak_count + 1;
      // In initial session, 1 correct answer locks question
      // In review sessions, 1 correct answer locks it if not missed, or 2 if previously missed
      const shouldLock = sessionType === 'initial' ? newStreak >= 1 : (current.has_missed ? newStreak >= 2 : newStreak >= 1);
      return {
        streak_count: newStreak,
        has_missed: current.has_missed,
        locked: shouldLock,
        locked_at: shouldLock ? new Date().toISOString() : current.locked_at || null
      };
    } else {
      return {
        streak_count: 0,
        has_missed: true,
        locked: false,
        locked_at: null
      };
    }
  }

  static planNextSession(completedSession: QuizSession): NextSessionPlan | null {
    const nextType = NEXT_SESSION_MAP[completedSession.session_type];
    if (!nextType) return null;

    const days = SESSION_INTERVALS[nextType];
    const baseDate = completedSession.completed_at ? new Date(completedSession.completed_at) : new Date();
    const availableAt = new Date(baseDate.getTime() + days * 24 * 60 * 60 * 1000).toISOString();

    return {
      sessionType: nextType,
      availableAt,
      daysInterval: days
    };
  }

  static formatSessionTypeLabel(type: SessionType): string {
    switch (type) {
      case 'initial': return 'Initial Mastery';
      case 'review_24h': return '24h Spaced Review';
      case 'review_3d': return '3-Day Retention Check';
      case 'review_7d': return '7-Day Deep Review';
      case 'review_14d': return '14-Day Final Mastery';
      default: return 'Practice Session';
    }
  }
}
