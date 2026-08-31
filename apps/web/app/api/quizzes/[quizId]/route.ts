import { NextRequest, NextResponse } from 'next/server';
import { QuizCrudController } from '@quiz-creator/controllers';
import { getAnonymousUserId } from '@/lib/anonymous';
import { getQuizRepository } from '@/lib/db';

export async function GET(req: NextRequest, { params }: { params: Promise<{ quizId: string }> }) {
  try {
    const { quizId } = await params;
    const userId = await getAnonymousUserId(req);
    const quizRepo = await getQuizRepository();
    const controller = new QuizCrudController(quizRepo);
    const quiz = await controller.getQuiz(quizId, userId);
    if (!quiz) return NextResponse.json({ error: 'Quiz not found' }, { status: 404 });
    return NextResponse.json(quiz);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ quizId: string }> }) {
  try {
    const { quizId } = await params;
    const userId = await getAnonymousUserId(req);
    const body = await req.json();
    const quizRepo = await getQuizRepository();
    const controller = new QuizCrudController(quizRepo);
    const updated = await controller.updateQuiz(quizId, body, userId);
    return NextResponse.json(updated);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ quizId: string }> }) {
  try {
    const { quizId } = await params;
    const userId = await getAnonymousUserId(req);
    const quizRepo = await getQuizRepository();
    const controller = new QuizCrudController(quizRepo);
    const success = await controller.deleteQuiz(quizId, userId);
    return NextResponse.json({ success });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
