import { NextResponse } from 'next/server';
import { createApiRoute } from '@/lib/api-handler';
import { getClassroomRepository } from '@/lib/classroom-repository';
import { assertAllowedOrigin, enforceRateLimit } from '@/lib/request-security';

export const POST = createApiRoute<{ classroomId: string }>(async ({ req, params, userId }) => {
  assertAllowedOrigin(req);
  const rateLimit = await enforceRateLimit(req, 'class-invite-create', userId, 10);
  if (rateLimit) return rateLimit;
  const invite = await (await getClassroomRepository()).createInvite(params.classroomId, userId);
  return NextResponse.json(invite, { status: 201, headers: { 'Cache-Control': 'no-store' } });
});
