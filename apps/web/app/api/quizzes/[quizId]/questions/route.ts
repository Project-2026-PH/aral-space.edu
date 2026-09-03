import { NextRequest, NextResponse } from 'next/server';
import { QuizCrudController } from '@quiz-creator/controllers';
import { getQuizRepository } from '@/lib/db';

export async function POST(req: NextRequest, { params }: { params: Promise<{ quizId: string }> }) {
  try {
    const { quizId } = await params;
    const body = await req.json();
    const quizRepo = await getQuizRepository();
    const controller = new QuizCrudController(quizRepo);
    const created = await controller.addQuestion(quizId, body);
    return NextResponse.json(created, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ quizId: string }> }) {
  try {
    const { quizId } = await params;
    const { questionIds } = await req.json();
    const quizRepo = await getQuizRepository();
    const controller = new QuizCrudController(quizRepo);
    await controller.reorderQuestions(quizId, questionIds);
    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
}
