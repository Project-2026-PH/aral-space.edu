import { NextResponse } from 'next/server';
import { createApiRoute } from '@/lib/api-handler';
import { getClassroomRepository } from '@/lib/classroom-repository';
import { revalidateQuizTag } from '@/lib/cached-queries';
import { assertAllowedOrigin } from '@/lib/request-security';

export const DELETE = createApiRoute<{ classroomId: string }>(async ({ req, params, userId }) => {
  assertAllowedOrigin(req);
  const repository = await getClassroomRepository();
  const details = await repository.getDetails(params.classroomId, userId);
  if (!details || details.role !== 'member') return NextResponse.json({ error: 'Class not found' }, { status: 404 });
  const success = await repository.leave(params.classroomId, userId);
  if (!success) return NextResponse.json({ error: 'Membership was not found.' }, { status: 404 });
  for (const subject of details.subjects) {
    for (const studySet of subject.study_sets) revalidateQuizTag(studySet.id, userId);
  }
  return NextResponse.json({ success: true });
});
