import { NextResponse } from 'next/server';
import { QuizCrudController } from '@quiz-creator/controllers';
import { getQuizRepository } from '@/lib/db';
import { createApiRoute } from '@/lib/api-handler';

export const GET = createApiRoute<{ quizId: string }>(async ({ params, userId }) => {
  const quizRepo = await getQuizRepository();
  const controller = new QuizCrudController(quizRepo);
  const quiz = await controller.getQuiz(params.quizId, userId);
  if (!quiz) return NextResponse.json({ error: 'Quiz not found' }, { status: 404 });
  return quiz;
}, { cache: 'private' });

export const PATCH = createApiRoute<{ quizId: string }>(async ({ req, params, userId }) => {
  const body = await req.json();
  const quizRepo = await getQuizRepository();
  const controller = new QuizCrudController(quizRepo);
  const updated = await controller.updateQuiz(params.quizId, body, userId);
  return NextResponse.json(updated);
});

export const DELETE = createApiRoute<{ quizId: string }>(async ({ params, userId }) => {
  const quizRepo = await getQuizRepository();
  const controller = new QuizCrudController(quizRepo);
  const success = await controller.deleteQuiz(params.quizId, userId);
  return { success };
});
