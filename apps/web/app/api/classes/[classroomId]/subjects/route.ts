import { NextResponse } from 'next/server';
import { createApiRoute } from '@/lib/api-handler';
import { getClassroomRepository } from '@/lib/classroom-repository';
import { revalidateQuizTag } from '@/lib/cached-queries';
import { assertAllowedOrigin, boundedString, enforceRateLimit, readJsonBody, RequestSecurityError } from '@/lib/request-security';
import { SECURITY_LIMITS } from '@/lib/security-config';

export const POST = createApiRoute<{ classroomId: string }>(async ({ req, params, userId }) => {
  assertAllowedOrigin(req);
  const rateLimit = await enforceRateLimit(req, 'class-subject-write', userId, 30);
  if (rateLimit) return rateLimit;
  const body = await readJsonBody(req, SECURITY_LIMITS.jsonBodyBytes);
  const subjectId = boundedString(body.subject_id, 'subject_id', 128, true)!;
  if (!/^[A-Fa-f0-9-]{36}$/.test(subjectId)) throw new RequestSecurityError(400, 'subject_id is invalid.');

  const repository = await getClassroomRepository();
  const success = await repository.addSubject(params.classroomId, subjectId, userId);
  const details = await repository.getDetails(params.classroomId, userId);
  for (const memberId of [userId, ...(details?.members || []).map((member) => member.user_id)]) {
    for (const subject of details?.subjects || []) {
      for (const studySet of subject.study_sets) revalidateQuizTag(studySet.id, memberId);
    }
  }
  return NextResponse.json({ success }, { status: 201 });
});
