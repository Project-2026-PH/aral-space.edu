import { NextRequest, NextResponse } from 'next/server';
import { RepositoryFactory } from '@quiz-creator/core';
import { QuizCrudController } from '@quiz-creator/controllers';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ quizId: string; questionId: string }> }
) {
  try {
    const { questionId } = await params;
    const body = await req.json();
    const supabase = await createServerSupabaseClient();
    const quizRepo = RepositoryFactory.createQuizRepository(supabase);
    const controller = new QuizCrudController(quizRepo);
    const updated = await controller.updateQuestion(questionId, body);
    return NextResponse.json(updated);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ quizId: string; questionId: string }> }
) {
  try {
    const { questionId } = await params;
    const supabase = await createServerSupabaseClient();
    const quizRepo = RepositoryFactory.createQuizRepository(supabase);
    const controller = new QuizCrudController(quizRepo);
    const success = await controller.deleteQuestion(questionId);
    return NextResponse.json({ success });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
