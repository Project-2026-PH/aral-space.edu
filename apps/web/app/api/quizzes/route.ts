import { NextResponse } from 'next/server';
import { QuizCrudController } from '@quiz-creator/controllers';
import { getQuizRepository } from '@/lib/db';
import { createApiRoute } from '@/lib/api-handler';

export const GET = createApiRoute(async ({ userId }) => {
  const quizRepo = await getQuizRepository();
  const controller = new QuizCrudController(quizRepo);
  const quizzes = await controller.listQuizzes(userId);
  const subjects = await controller.listSubjects(userId);
  return { quizzes, subjects, userId };
}, { cache: 'private' });

export const POST = createApiRoute(async ({ req, userId }) => {
  const body = await req.json();
  const quizRepo = await getQuizRepository();
  const controller = new QuizCrudController(quizRepo);
  const created = await controller.createQuiz(body, userId);
  return NextResponse.json(created, { status: 201 });
});
