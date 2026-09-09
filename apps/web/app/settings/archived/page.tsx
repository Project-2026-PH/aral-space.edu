import { Quiz, Subject } from '@quiz-creator/types';
import { QuizCrudController } from '@quiz-creator/controllers/QuizCrudController';
import { getAnonymousUserId } from '@/lib/anonymous';
import { getQuizRepository } from '@/lib/db';
import ArchivedItemsClient from '@/components/settings/ArchivedItemsClient';

export const dynamic = 'force-dynamic';

export default async function ArchivedItemsPage() {
  let subjects: Subject[] = [];
  let quizzes: Quiz[] = [];

  try {
    const userId = await getAnonymousUserId();
    const repository = await getQuizRepository();
    const controller = new QuizCrudController(repository);
    [subjects, quizzes] = await Promise.all([
      controller.listArchivedSubjects(userId),
      controller.listArchivedQuizzes(userId),
    ]);
  } catch (error) {
    console.error('Failed to load archived items:', error);
  }

  return <ArchivedItemsClient initialSubjects={subjects} initialQuizzes={quizzes} />;
}
