import { QuizCrudController } from '@quiz-creator/controllers';
import { getQuizRepository } from '@/lib/db';
import { createApiRoute } from '@/lib/api-handler';

export const DELETE = createApiRoute<{ subjectId: string }>(async ({ params, userId }) => {
  const repository = await getQuizRepository();
  const controller = new QuizCrudController(repository);
  const deleted = await controller.deleteSubject(params.subjectId, userId);

  if (!deleted) {
    throw new Error('Subject not found');
  }

  return { deleted: true };
});
