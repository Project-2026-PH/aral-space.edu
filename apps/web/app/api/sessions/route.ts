import { NextRequest, NextResponse } from 'next/server';
import { MasterySessionController } from '@quiz-creator/controllers';
import { getAnonymousUserId } from '@/lib/anonymous';
import { getQuizRepository, getSessionRepository } from '@/lib/db';

export async function POST(req: NextRequest) {
  try {
    const userId = await getAnonymousUserId(req);
    const body = await req.json();
    const { action, quizId, sessionId, questionId, isCorrect, sessionType, latencyMs, summary } = body;
    
    if (action === 'start') {
      const [sessionRepo, quizRepo] = await Promise.all([
        getSessionRepository(),
        getQuizRepository()
      ]);
      const controller = new MasterySessionController(sessionRepo, quizRepo);
      const data = await controller.getOrStartSession(quizId, sessionType, userId);
      return NextResponse.json(data);
    }

    const sessionRepo = await getSessionRepository();
    const controller = new MasterySessionController(sessionRepo);

    if (action === 'answer') {
      const progress = await controller.recordAnswer(sessionId, questionId, isCorrect, sessionType, latencyMs);
      return NextResponse.json(progress);
    }

    if (action === 'complete') {
      const result = await controller.completeSession(sessionId, quizId, userId, summary);
      return NextResponse.json(result);
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (err: any) {
    console.error('[API /api/sessions ERROR]:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
