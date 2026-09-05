import { NextResponse } from 'next/server';
import { createApiRoute } from '@/lib/api-handler';
import { getCachedPublicSubject } from '@/lib/cached-queries';

export const GET = createApiRoute<{ shareToken: string }>(async ({ params }) => {
  const subject = await getCachedPublicSubject(params.shareToken);

  if (!subject) {
    return NextResponse.json({ error: 'Subject not found or access is restricted' }, { status: 404 });
  }

  return {
    ...subject,
    quizzes: Array.isArray(subject.quizzes) ? subject.quizzes : []
  };
}, { cache: 'public', skipAuth: true });
