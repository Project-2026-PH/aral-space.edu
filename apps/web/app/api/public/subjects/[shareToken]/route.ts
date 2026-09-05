import { NextResponse } from 'next/server';
import { QuizCrudController } from '@quiz-creator/controllers';
import { getQuizRepository } from '@/lib/db';
import { createApiRoute } from '@/lib/api-handler';

export const GET = createApiRoute<{ shareToken: string }>(async ({ params }) => {
  const repository = await getQuizRepository(true);
  const controller = new QuizCrudController(repository);
  const subject = await controller.getSubjectByShareToken(params.shareToken);

  if (!subject) {
    return NextResponse.json({ error: 'Subject not found or access is restricted' }, { status: 404 });
  }

  return {
    ...subject,
    quizzes: Array.isArray(subject.quizzes) ? subject.quizzes : []
  };
}, { cache: 'public', skipAuth: true });
