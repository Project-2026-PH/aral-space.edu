import { NextResponse } from 'next/server';
import { createApiRoute } from '@/lib/api-handler';
import { getClassroomRepository } from '@/lib/classroom-repository';
import { revalidateQuizTag } from '@/lib/cached-queries';
import { assertAllowedOrigin, boundedString, enforceRateLimit, readJsonBody, RequestSecurityError } from '@/lib/request-security';
import { SECURITY_LIMITS } from '@/lib/security-config';

export const POST = createApiRoute(async ({ req, userId }) => {
  assertAllowedOrigin(req);
  const rateLimit = await enforceRateLimit(req, 'class-join', userId, 10);
  if (rateLimit) return rateLimit;
  const body = await readJsonBody(req, SECURITY_LIMITS.jsonBodyBytes);
  const code = boundedString(body.code, 'code', 128, true)!;
  if (!/^[A-Za-z0-9_-]{32,128}$/.test(code)) {
    throw new RequestSecurityError(410, 'This class invite is invalid or expired.');
  }
  const repository = await getClassroomRepository();
  const classroomId = await repository.join(code, userId);
  if (!classroomId) return NextResponse.json({ error: 'This class invite is invalid, expired, or revoked.' }, { status: 410 });

  const details = await repository.getDetails(classroomId, userId);
  if (details) {
    for (const subject of details.subjects) {
      for (const studySet of subject.study_sets) revalidateQuizTag(studySet.id, userId);
    }
  }
  return NextResponse.json({ classroom_id: classroomId });
});
