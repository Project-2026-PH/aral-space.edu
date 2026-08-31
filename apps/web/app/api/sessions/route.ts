import { NextRequest, NextResponse } from 'next/server';
import { RepositoryFactory } from '@quiz-creator/core';
import { MasterySessionController } from '@quiz-creator/controllers';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action, quizId, sessionId, questionId, isCorrect, sessionType } = body;
    const supabase = await createServerSupabaseClient();
    const sessionRepo = RepositoryFactory.createSessionRepository(supabase);
    const quizRepo = RepositoryFactory.createQuizRepository(supabase);
    const controller = new MasterySessionController(sessionRepo, quizRepo);

    if (action === 'start') {
      const data = await controller.getOrStartSession(quizId, sessionType);
      return NextResponse.json(data);
    }

    if (action === 'answer') {
      const progress = await controller.recordAnswer(sessionId, questionId, isCorrect, sessionType);
      return NextResponse.json(progress);
    }

    if (action === 'complete') {
      const result = await controller.completeSession(sessionId, quizId);
      return NextResponse.json(result);
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
