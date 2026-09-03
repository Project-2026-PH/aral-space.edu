import { NextRequest, NextResponse } from 'next/server';
import { QuizCrudController } from '@quiz-creator/controllers';
import { getQuizRepository } from '@/lib/db';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ subjectId: string }> }
) {
  try {
    const { subjectId } = await params;
    const repository = await getQuizRepository();
    const controller = new QuizCrudController(repository);
    const config = await controller.getSubjectShareConfig(subjectId);
    return NextResponse.json(config);
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Failed to load subject sharing settings' }, { status: 400 });
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ subjectId: string }> }
) {
  try {
    const { subjectId } = await params;
    const body = await req.json();
    const repository = await getQuizRepository();
    const controller = new QuizCrudController(repository);
    const config = await controller.updateSubjectShareConfig(subjectId, body);
    return NextResponse.json(config);
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Failed to update subject sharing settings' }, { status: 400 });
  }
}
