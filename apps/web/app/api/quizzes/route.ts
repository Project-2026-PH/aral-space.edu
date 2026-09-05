import { NextResponse } from 'next/server';
import { QuizCrudController } from '@quiz-creator/controllers';
import { getQuizRepository } from '@/lib/db';
import { createApiRoute } from '@/lib/api-handler';
import { getCachedQuizzesAndSubjects, revalidateUserLists } from '@/lib/cached-queries';

export const GET = createApiRoute(async ({ userId }) => {
  const { quizzes, subjects } = await getCachedQuizzesAndSubjects(userId);
  return { quizzes, subjects, userId };
}, { cache: 'private' });

export const POST = createApiRoute(async ({ req, userId }) => {
  const body = await req.json();
  const quizRepo = await getQuizRepository(false);
  const controller = new QuizCrudController(quizRepo);
  if (body.subject_id) {
    const access = await controller.getSubjectAccess(body.subject_id, userId);
    if (!access?.can_edit) {
      return NextResponse.json({ error: 'You do not have edit access to this subject.' }, { status: 403 });
    }
  }
  const created = await controller.createQuiz(body, userId);
  revalidateUserLists(userId);
  return NextResponse.json(created, { status: 201 });
});
