import { NextResponse } from 'next/server';
import { QuizCrudController } from '@quiz-creator/controllers';
import { getQuizRepository } from '@/lib/db';
import { createApiRoute } from '@/lib/api-handler';

export const GET = createApiRoute<{ shareToken: string }>(async ({ params }) => {
  const quizRepo = await getQuizRepository(true);
  const controller = new QuizCrudController(quizRepo);
  const publicQuiz = await controller.getQuizByShareToken(params.shareToken);

  if (!publicQuiz) {
    return NextResponse.json({ error: 'Study set not found or access is restricted' }, { status: 404 });
  }

  return publicQuiz;
}, { cache: 'public', skipAuth: true });
