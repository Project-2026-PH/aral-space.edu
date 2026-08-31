import { NextRequest, NextResponse } from 'next/server';
import { RepositoryFactory } from '@quiz-creator/core';
import { QuizCrudController } from '@quiz-creator/controllers';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { getAnonymousUserId } from '@/lib/anonymous';

export async function GET(req: NextRequest) {
  try {
    const userId = await getAnonymousUserId(req);
    const supabase = await createServerSupabaseClient();
    const quizRepo = RepositoryFactory.createQuizRepository(supabase);
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
    const supabase = await createServerSupabaseClient();
    const quizRepo = RepositoryFactory.createQuizRepository(supabase);
    const controller = new QuizCrudController(quizRepo);
    const created = await controller.createQuiz(body, userId);
    return NextResponse.json(created, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
}
