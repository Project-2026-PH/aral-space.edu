import { NextResponse } from 'next/server';
import { createApiRoute } from '@/lib/api-handler';
import { getClassroomRepository } from '@/lib/classroom-repository';
import { revalidateQuizTag } from '@/lib/cached-queries';
import { assertAllowedOrigin, boundedBoolean, boundedString, enforceRateLimit, readJsonBody, RequestSecurityError } from '@/lib/request-security';
import { SECURITY_LIMITS } from '@/lib/security-config';

export const GET = createApiRoute<{ classroomId: string }>(async ({ params, userId }) => {
  const details = await (await getClassroomRepository()).getDetails(params.classroomId, userId);
  if (!details) return NextResponse.json({ error: 'Class not found' }, { status: 404 });
  return NextResponse.json(details, { headers: { 'Cache-Control': 'no-store' } });
}, { cache: 'noStore' });

export const PATCH = createApiRoute<{ classroomId: string }>(async ({ req, params, userId }) => {
  assertAllowedOrigin(req);
  const rateLimit = await enforceRateLimit(req, 'class-update', userId, 20);
  if (rateLimit) return rateLimit;
  const body = await readJsonBody(req, SECURITY_LIMITS.jsonBodyBytes);
  const repository = await getClassroomRepository();
  const archived = boundedBoolean(body.archived, 'archived');

  if (archived) {
    const details = await repository.getDetails(params.classroomId, userId);
    if (!details || details.role !== 'owner') return NextResponse.json({ error: 'Class not found' }, { status: 404 });
    const success = await repository.archive(params.classroomId, userId);
    if (success) {
      for (const memberId of [userId, ...(details.members || []).map((member) => member.user_id)]) {
        for (const subject of details.subjects) {
          for (const studySet of subject.study_sets) revalidateQuizTag(studySet.id, memberId);
        }
      }
    }
    return NextResponse.json({ success });
  }

  const name = body.name === undefined ? undefined : boundedString(body.name, 'name', 120, true);
  const description = body.description === undefined ? undefined : boundedString(body.description, 'description', 2000);
  if (name === undefined && description === undefined) {
    throw new RequestSecurityError(400, 'Provide a class name or description to update.');
  }
  const current = await repository.get(params.classroomId, userId);
  if (!current || current.role !== 'owner') return NextResponse.json({ error: 'Class not found' }, { status: 404 });
  const updated = await repository.update(
    params.classroomId,
    name ?? current.name,
    description === undefined ? current.description : description || null,
    userId
  );
  return NextResponse.json(updated, { headers: { 'Cache-Control': 'no-store' } });
});
