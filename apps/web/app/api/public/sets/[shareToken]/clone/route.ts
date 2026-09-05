import { NextRequest, NextResponse } from 'next/server';
import { QuizCrudController } from '@quiz-creator/controllers';
import { getQuizRepository } from '@/lib/db';
import { getAnonymousUserId } from '@/lib/anonymous';
import { revalidateUserLists } from '@/lib/cached-queries';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ shareToken: string }> }
) {
  try {
    const { shareToken } = await params;
    const userId = await getAnonymousUserId(req);
    const quizRepo = await getQuizRepository(false);
    const controller = new QuizCrudController(quizRepo);
    const clonedQuiz = await controller.cloneQuizByShareToken(shareToken, userId);
    revalidateUserLists(userId);

    return NextResponse.json(clonedQuiz, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
}
