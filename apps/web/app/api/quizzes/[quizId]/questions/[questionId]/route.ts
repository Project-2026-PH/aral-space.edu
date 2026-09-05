import { NextRequest, NextResponse } from 'next/server';
import { QuizCrudController } from '@quiz-creator/controllers';
import { getQuizRepository } from '@/lib/db';
import { getAnonymousUserId } from '@/lib/anonymous';
import { revalidateQuizTag } from '@/lib/cached-queries';

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ quizId: string; questionId: string }> }) {
  try {
    const { quizId, questionId } = await params;
    const userId = await getAnonymousUserId(req);
    const body = await req.json();
    const quizRepo = await getQuizRepository(false);
    const controller = new QuizCrudController(quizRepo);
    if (!(await controller.getQuiz(quizId, userId))) return NextResponse.json({ error: 'You do not have edit access to this reviewer.' }, { status: 403 });
    const updated = await controller.updateQuestion(questionId, body);
    revalidateQuizTag(quizId, userId);
    return NextResponse.json(updated);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ quizId: string; questionId: string }> }) {
  try {
    const { quizId, questionId } = await params;
    const userId = await getAnonymousUserId(req);
    const quizRepo = await getQuizRepository(false);
    const controller = new QuizCrudController(quizRepo);
    if (!(await controller.getQuiz(quizId, userId))) return NextResponse.json({ error: 'You do not have edit access to this reviewer.' }, { status: 403 });
    const success = await controller.deleteQuestion(questionId);
    revalidateQuizTag(quizId, userId);
    return NextResponse.json({ success });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
