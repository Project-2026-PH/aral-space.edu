import { IQuizRepository } from '../../repositories/IQuizRepository';
import { UserAuthoringProfile } from '@quiz-creator/types';

export class UserAuthoringProfileService {
  static readonly DEFAULT_TARGET_COUNT = 10;

  static async buildProfile(
    quizRepo: IQuizRepository,
    userId?: string
  ): Promise<UserAuthoringProfile> {
    try {
      const allQuizzes = await quizRepo.listQuizzes(userId);

      if (!allQuizzes || allQuizzes.length === 0) {
        return {
          targetCount: UserAuthoringProfileService.DEFAULT_TARGET_COUNT,
          sourceType: 'default',
          styleSummary: 'Standard 4-option conceptual multiple choice questions.',
          totalReviewersAnalyzed: 0
        };
      }

      // Priority 1: Manual quizzes
      const manualQuizzes = allQuizzes.filter((q) => q.source_model === 'manual');
      const useManual = manualQuizzes.length > 0;
      const targetQuizzes = useManual
        ? manualQuizzes
        : allQuizzes.filter((q) => q.source_model !== 'manual');

      if (targetQuizzes.length === 0) {
        return {
          targetCount: UserAuthoringProfileService.DEFAULT_TARGET_COUNT,
          sourceType: 'default',
          styleSummary: 'Standard 4-option conceptual multiple choice questions.',
          totalReviewersAnalyzed: 0
        };
      }

      // Determine maximum number of questions user usually makes
      const questionCounts = targetQuizzes
        .map((q) => q.question_count || 0)
        .filter((c) => c > 0);

      const maxCount = questionCounts.length > 0
        ? Math.max(...questionCounts)
        : UserAuthoringProfileService.DEFAULT_TARGET_COUNT;
      const targetCount = Math.min(25, Math.max(3, maxCount));

      // Fetch questions from the most recent 1 to 3 quizzes to analyze formation and extract exemplars
      const sampleQuizzes = targetQuizzes.slice(0, 3);
      const allQuestions: Array<{ question: string; options: string[]; explanation?: string }> = [];

      for (const quiz of sampleQuizzes) {
        try {
          const qs = await quizRepo.getQuestionsByQuizId(quiz.id);
          if (qs && qs.length > 0) {
            for (const q of qs) {
              allQuestions.push({
                question: q.question_text,
                options: q.options || [],
                explanation: q.explanation || undefined
              });
            }
          }
        } catch {
          // ignore individual fetch errors
        }
      }

      if (allQuestions.length === 0) {
        return {
          targetCount,
          sourceType: useManual ? 'manual' : 'ai_adjusted',
          styleSummary: 'Standard 4-option conceptual multiple choice questions.',
          totalReviewersAnalyzed: targetQuizzes.length
        };
      }

      // Analyze formation
      const avgQuestionLength = Math.round(
        allQuestions.reduce((acc, q) => acc + (q.question ? q.question.split(/\s+/).length : 0), 0) / allQuestions.length
      );

      const avgOptionCount = Math.round(
        allQuestions.reduce((acc, q) => acc + (q.options ? q.options.length : 4), 0) / allQuestions.length
      );

      const phrasingTraits: string[] = [];
      if (avgQuestionLength > 20) {
        phrasingTraits.push('scenario/case-based stems with rich context');
      } else if (avgQuestionLength < 10) {
        phrasingTraits.push('concise, direct factual/definition stems');
      } else {
        phrasingTraits.push('moderately detailed conceptual questions');
      }

      const hasDetailedExplanations = allQuestions.some((q) => q.explanation && q.explanation.length > 40);
      if (hasDetailedExplanations) {
        phrasingTraits.push('thorough pedagogical explanations citing underlying principles');
      } else {
        phrasingTraits.push('succinct explanations');
      }

      const styleSummary = `User prefers ${phrasingTraits.join(' and ')}, targeting ~${targetCount} questions with ~${avgOptionCount} options each.`;

      const sampleQuestions = allQuestions.slice(0, 3);

      return {
        targetCount,
        sourceType: useManual ? 'manual' : 'ai_adjusted',
        sampleQuestions,
        styleSummary,
        avgQuestionLength,
        avgOptionCount,
        totalReviewersAnalyzed: targetQuizzes.length
      };
    } catch (err) {
      console.warn('[UserAuthoringProfileService] failed to compute profile:', err);
      return {
        targetCount: UserAuthoringProfileService.DEFAULT_TARGET_COUNT,
        sourceType: 'default',
        styleSummary: 'Standard 4-option conceptual multiple choice questions.',
        totalReviewersAnalyzed: 0
      };
    }
  }
}
