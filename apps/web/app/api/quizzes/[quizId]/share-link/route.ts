import { NextRequest, NextResponse } from 'next/server';
import { QuizCrudController } from '@quiz-creator/controllers';
import { getQuizRepository } from '@/lib/db';
import { revalidateQuizTag } from '@/lib/cached-queries';
import { getAnonymousUserId } from '@/lib/anonymous';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ quizId: string }> }
) {
  try {
    const { quizId } = await params;
    const userId = await getAnonymousUserId(req);
    const quizRepo = await getQuizRepository(true);
    const controller = new QuizCrudController(quizRepo);
    const config = await controller.getShareConfig(quizId, userId);
    return NextResponse.json(config);
  } catch (err: any) {
    console.error('Share link GET error:', err);
    return NextResponse.json({ error: err?.message || String(err) }, { status: 400 });
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ quizId: string }> }
) {
  try {
    const { quizId } = await params;
    const userId = await getAnonymousUserId(req);
    const body = await req.json();
    const quizRepo = await getQuizRepository(false);
    const controller = new QuizCrudController(quizRepo);
    const updated = await controller.updateShareConfig(quizId, body, userId);
    revalidateQuizTag(quizId);
    return NextResponse.json(updated);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
}
