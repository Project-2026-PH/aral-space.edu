import { QuizCrudController } from '@quiz-creator/controllers/QuizCrudController';
import { getAnonymousUserId } from '@/lib/anonymous';
import { getQuizRepository } from '@/lib/db';

export async function GET() {
  const userId = await getAnonymousUserId();
  const repository = await getQuizRepository();
  const controller = new QuizCrudController(repository);
  const [subjects, quizzes] = await Promise.all([
    controller.listArchivedSubjects(userId),
    controller.listArchivedQuizzes(userId),
  ]);
  return Response.json({ subjects, quizzes });
}
