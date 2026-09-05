import { QuizCrudController } from '@quiz-creator/controllers';
import { getQuizRepository } from '@/lib/db';
import { createApiRoute } from '@/lib/api-handler';

export const GET = createApiRoute<{ subjectId: string }>(async ({ params, userId }) => {
  const repository = await getQuizRepository();
  const controller = new QuizCrudController(repository);
  return controller.getSubjectShareConfig(params.subjectId, userId);
});

export const POST = createApiRoute<{ subjectId: string }>(async ({ req, params, userId }) => {
  const body = await req.json();
  const repository = await getQuizRepository();
  const controller = new QuizCrudController(repository);
  return controller.updateSubjectShareConfig(params.subjectId, body, userId);
});
