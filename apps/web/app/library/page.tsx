import { Quiz, Subject } from '@quiz-creator/types';
import { QuizCrudController } from '@quiz-creator/controllers/QuizCrudController';
import { getQuizRepository } from '@/lib/db';
import { getAnonymousUserId } from '@/lib/anonymous';
import LibraryClient from '@/components/library/LibraryClient';

export const dynamic = 'force-dynamic';

export default async function LibraryPage() {
  let quizzes: Quiz[] = [];
  let subjects: Subject[] = [];
  let sharedQuizzes: Quiz[] = [];
  let sharedSubjects: Subject[] = [];
  let userId = '';

  try {
    userId = await getAnonymousUserId();
    const quizRepo = await getQuizRepository();
    const controller = new QuizCrudController(quizRepo);
    const data = await controller.listQuizzesAndSubjects(userId);
    quizzes = data.quizzes || [];
    subjects = data.subjects || [];
    sharedQuizzes = data.sharedQuizzes || [];
    sharedSubjects = data.sharedSubjects || [];
  } catch (err) {
    console.error('Failed to load initial quizzes and subjects on library page:', err);
  }

  return (
    <LibraryClient
      initialQuizzes={quizzes}
      initialSubjects={subjects}
      initialSharedQuizzes={sharedQuizzes}
      initialSharedSubjects={sharedSubjects}
      viewerId={userId}
    />
  );
}
