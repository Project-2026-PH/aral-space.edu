import ClassroomInviteJoin from '@/components/classroom/ClassroomInviteJoin';

export default async function JoinClassPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  return <ClassroomInviteJoin code={code} />;
}
