import { NextResponse } from 'next/server';
import { createApiRoute } from '@/lib/api-handler';
import { getClassroomRepository } from '@/lib/classroom-repository';
import { assertAllowedOrigin } from '@/lib/request-security';

export const DELETE = createApiRoute<{ classroomId: string; inviteId: string }>(async ({ req, params, userId }) => {
  assertAllowedOrigin(req);
  const success = await (await getClassroomRepository()).revokeInvite(params.classroomId, params.inviteId, userId);
  if (!success) return NextResponse.json({ error: 'Invite not found or already revoked.' }, { status: 404 });
  return NextResponse.json({ success: true });
});
