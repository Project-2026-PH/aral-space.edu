import { NextRequest, NextResponse } from 'next/server';
import { RepositoryFactory } from '@quiz-creator/core';
import { QuizCrudController } from '@quiz-creator/controllers';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export async function GET() {
  try {
    const supabase = await createServerSupabaseClient();
    const quizRepo = RepositoryFactory.createQuizRepository(supabase);
    const controller = new QuizCrudController(quizRepo);
    const quizzes = await controller.listQuizzes();
    const subjects = await controller.listSubjects();
    return NextResponse.json({ quizzes, subjects });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const supabase = await createServerSupabaseClient();
    const quizRepo = RepositoryFactory.createQuizRepository(supabase);
    const controller = new QuizCrudController(quizRepo);
    const created = await controller.createQuiz(body);
    return NextResponse.json(created, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
}
