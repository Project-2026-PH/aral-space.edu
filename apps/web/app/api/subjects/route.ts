import { NextResponse } from 'next/server';
import { QuizCrudController } from '@quiz-creator/controllers';
import { getQuizRepository } from '@/lib/db';
import { createApiRoute } from '@/lib/api-handler';

export const GET = createApiRoute(async ({ userId }) => {
  const quizRepo = await getQuizRepository();
  const controller = new QuizCrudController(quizRepo);
  const subjects = await controller.listSubjects(userId);
  return { subjects, userId };
}, { cache: 'private' });

export const POST = createApiRoute(async ({ req, userId }) => {
  const body = await req.json();
  const { name, color } = body;
  if (!name || typeof name !== 'string' || !name.trim()) {
    return NextResponse.json({ error: 'Subject name is required' }, { status: 400 });
  }

  const quizRepo = await getQuizRepository();
  const controller = new QuizCrudController(quizRepo);
  const created = await controller.createSubject(name.trim(), color || '#86EFAC', userId);
  return NextResponse.json(created, { status: 201 });
});
