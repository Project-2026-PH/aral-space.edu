import { NextResponse } from 'next/server';
import { createApiRoute } from '@/lib/api-handler';
import { getClassroomRepository } from '@/lib/classroom-repository';
import { revalidateQuizTag } from '@/lib/cached-queries';
import { assertAllowedOrigin } from '@/lib/request-security';

export const DELETE = createApiRoute<{ classroomId: string; subjectId: string }>(async ({ req, params, userId }) => {
  assertAllowedOrigin(req);
  const repository = await getClassroomRepository();
  const details = await repository.getDetails(params.classroomId, userId);
  if (!details || details.role !== 'owner') return NextResponse.json({ error: 'Class not found' }, { status: 404 });
  const sharedSubject = details.subjects.find((subject) => subject.id === params.subjectId);
  if (!sharedSubject) return NextResponse.json({ error: 'Subject is not shared with this class.' }, { status: 404 });

  const success = await repository.removeSubject(params.classroomId, params.subjectId, userId);
  if (!success) return NextResponse.json({ error: 'Subject is not shared with this class.' }, { status: 404 });
  for (const memberId of [userId, ...(details.members || []).map((member) => member.user_id)]) {
    for (const studySet of sharedSubject.study_sets) revalidateQuizTag(studySet.id, memberId);
  }
  return NextResponse.json({ success: true });
});
