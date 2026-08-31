import { Quiz } from '@quiz-creator/types';

export class QuizRenamingService {
  static sortQuizzesNaturally(quizzes: Quiz[]): Quiz[] {
    return [...quizzes].sort((a, b) => {
      return a.title.localeCompare(b.title, undefined, {
        numeric: true,
        sensitivity: 'base'
      });
    });
  }

  static formatHandoutTitle(handoutName: string): string {
    return handoutName.replace(/\.[^/.]+$/, "").replace(/[-_]/g, " ");
  }
}
