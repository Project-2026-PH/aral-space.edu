import { NextResponse } from 'next/server';
import { QuizCrudController } from '@quiz-creator/controllers';
import { getQuizRepository } from '@/lib/db';
import { createApiRoute } from '@/lib/api-handler';

export const POST = createApiRoute<{ subjectId: string }>(async ({ req, params, userId }) => {
  const body = await req.json().catch(() => ({}));
  const expiresAt = body.expires_at === null || body.expires_at === undefined || body.expires_at === ''
    ? null
    : new Date(body.expires_at).toISOString();
  if (expiresAt && new Date(expiresAt).getTime() <= Date.now()) {
    return NextResponse.json({ error: 'Expiry must be in the future.' }, { status: 400 });
  }

  const repository = await getQuizRepository();
  const controller = new QuizCrudController(repository);
  const link = await controller.createSubjectCollaboratorLink(params.subjectId, expiresAt, userId);
  return NextResponse.json(link, { status: 201 });
});
