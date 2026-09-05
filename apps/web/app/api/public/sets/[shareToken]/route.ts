import { NextResponse } from 'next/server';
import { createApiRoute } from '@/lib/api-handler';
import { getCachedPublicQuiz } from '@/lib/cached-queries';

export const GET = createApiRoute<{ shareToken: string }>(async ({ params }) => {
  const publicQuiz = await getCachedPublicQuiz(params.shareToken);

  if (!publicQuiz) {
    return NextResponse.json({ error: 'Study set not found or access is restricted' }, { status: 404 });
  }

  return publicQuiz;
}, { cache: 'public', skipAuth: true });
