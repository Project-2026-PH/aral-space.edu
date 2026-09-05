import { NextResponse } from 'next/server';
import { QuizCrudController } from '@quiz-creator/controllers';
import { getQuizRepository } from '@/lib/db';
import { createApiRoute } from '@/lib/api-handler';

export const POST = createApiRoute<{ token: string }>(async ({ params, userId }) => {
  const repository = await getQuizRepository(false);
  const controller = new QuizCrudController(repository);
  const access = await controller.redeemSubjectCollaboratorLink(params.token, userId);
  if (!access) return NextResponse.json({ error: 'This collaborator link is expired or has already been used.' }, { status: 410 });
  return access;
});
