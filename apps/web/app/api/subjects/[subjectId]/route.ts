import { NextResponse } from 'next/server';
import { QuizCrudController } from '@quiz-creator/controllers';
import { getQuizRepository } from '@/lib/db';
import { createApiRoute } from '@/lib/api-handler';

export const GET = createApiRoute<{ subjectId: string }>(async ({ params, userId }) => {
  const repository = await getQuizRepository();
  const controller = new QuizCrudController(repository);
  const access = await controller.getSubjectAccess(params.subjectId, userId);
  if (!access) return NextResponse.json({ error: 'Subject not found or access is restricted' }, { status: 404 });
  const subjects = await controller.listSubjects(userId);
  const subject = subjects.find((candidate) => candidate.id === params.subjectId);
  if (!subject) return NextResponse.json({ error: 'Subject not found' }, { status: 404 });
  const quizzes = await controller.listQuizzesBySubject(params.subjectId, userId);
  return { subject, quizzes, access };
});

export const PATCH = createApiRoute<{ subjectId: string }>(async ({ req, params, userId }) => {
  const body = await req.json();
  const name = typeof body.name === 'string' ? body.name.trim() : undefined;
  if (name !== undefined && !name) return NextResponse.json({ error: 'Subject name cannot be empty' }, { status: 400 });
  const repository = await getQuizRepository();
  const controller = new QuizCrudController(repository);
  const updated = await controller.updateSubject(params.subjectId, { name, color: body.color }, userId);
  return NextResponse.json(updated);
});

export const DELETE = createApiRoute<{ subjectId: string }>(async ({ req, params, userId }) => {
  const body = await req.json().catch(() => ({}));
  const repository = await getQuizRepository();
  const controller = new QuizCrudController(repository);
  if (body.confirmation_name !== undefined) {
    const subjects = await controller.listSubjects(userId);
    const subject = subjects.find((candidate) => candidate.id === params.subjectId);
    if (!subject || body.confirmation_name !== subject.name) {
      return NextResponse.json({ error: 'The subject name did not match.' }, { status: 400 });
    }
  }
  const deleted = await controller.deleteSubject(params.subjectId, userId);
  if (!deleted) throw new Error('Subject not found');
  return { deleted: true };
});
