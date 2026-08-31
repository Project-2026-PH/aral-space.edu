import { NextRequest, NextResponse } from 'next/server';
import { QuizCrudController } from '@quiz-creator/controllers';
import { getAnonymousUserId } from '@/lib/anonymous';
import { getQuizRepository } from '@/lib/db';

export async function GET(req: NextRequest) {
  try {
    const userId = await getAnonymousUserId(req);
    const quizRepo = await getQuizRepository();
    const controller = new QuizCrudController(quizRepo);
    const quizzes = await controller.listQuizzes(userId);
    const subjects = await controller.listSubjects(userId);
    return NextResponse.json({ quizzes, subjects, userId });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const userId = await getAnonymousUserId(req);
    const body = await req.json();
    const quizRepo = await getQuizRepository();
    const controller = new QuizCrudController(quizRepo);
    const created = await controller.createQuiz(body, userId);
    return NextResponse.json(created, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
}
