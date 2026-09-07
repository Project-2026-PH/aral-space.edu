import type { Quiz, SubjectAccess } from '@quiz-creator/types';
import type { QuizCrudController } from '@quiz-creator/controllers/QuizCrudController';

type SubjectAccessResolver = Pick<QuizCrudController, 'getSubjectAccess'>;

export function isQuizOwner(quiz: Pick<Quiz, 'user_id'>, userId: string): boolean {
  return Boolean(userId && quiz.user_id === userId);
}

export async function hasReviewerEditAccess(
  controller: SubjectAccessResolver,
  quiz: Pick<Quiz, 'user_id' | 'subject_id'>,
  userId: string
): Promise<boolean> {
  if (isQuizOwner(quiz, userId)) return true;
  if (!quiz.subject_id) return false;

  const access: SubjectAccess | null = await controller.getSubjectAccess(quiz.subject_id, userId);
  return Boolean(access?.can_edit_reviewers);
}
