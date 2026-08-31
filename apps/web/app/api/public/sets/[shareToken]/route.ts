import { NextRequest, NextResponse } from 'next/server';
import { RepositoryFactory } from '@quiz-creator/core';
import { QuizCrudController } from '@quiz-creator/controllers';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ shareToken: string }> }
) {
  try {
    const { shareToken } = await params;
    const supabase = await createServerSupabaseClient();
    const quizRepo = RepositoryFactory.createQuizRepository(supabase);
    const controller = new QuizCrudController(quizRepo);
    const publicQuiz = await controller.getQuizByShareToken(shareToken);

    if (!publicQuiz) {
      return NextResponse.json({ error: 'Study set not found or access is restricted' }, { status: 404 });
    }

    return NextResponse.json(publicQuiz);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
