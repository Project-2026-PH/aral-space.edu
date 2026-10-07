import { redirect } from 'next/navigation';

export default async function ShareRedirectPage({
  params,
}: {
  params: Promise<{ shareToken: string }>;
}) {
  const { shareToken } = await params;
  redirect(`/sets/share/${encodeURIComponent(shareToken)}`);
}
