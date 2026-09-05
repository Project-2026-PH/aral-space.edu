import { NextResponse } from 'next/server';
import { QuizCrudController } from '@quiz-creator/controllers';
import { getQuizRepository } from '@/lib/db';
import { createApiRoute } from '@/lib/api-handler';

export const GET = createApiRoute(async ({ userId }) => {
  const quizRepo = await getQuizRepository();
  const controller = new QuizCrudController(quizRepo);
  const { quizzes, subjects } = await controller.listQuizzesAndSubjects(userId);
  return { quizzes, subjects, userId };
}, { cache: 'private' });

export const POST = createApiRoute(async ({ req, userId }) => {
  const body = await req.json();
  const quizRepo = await getQuizRepository();
  const controller = new QuizCrudController(quizRepo);
  if (body.subject_id) {
    const access = await controller.getSubjectAccess(body.subject_id, userId);
    if (!access?.can_edit) {
      return NextResponse.json({ error: 'You do not have edit access to this subject.' }, { status: 403 });
    }
  }
  const created = await controller.createQuiz(body, userId);
  return NextResponse.json(created, { status: 201 });
});
