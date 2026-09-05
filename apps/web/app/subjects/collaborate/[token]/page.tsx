'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { CheckCircle2, LoaderCircle, ShieldAlert } from 'lucide-react';

export default function CollaboratorRedemptionPage() {
  const params = useParams<{ token: string }>();
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function redeem() {
      try {
        const response = await fetch(`/api/subjects/collaborator/${params.token}/redeem`, { method: 'POST' });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'This collaborator link is no longer available.');
        if (!cancelled) router.replace(`/subjects/${data.subject_id}`);
      } catch (err: any) {
        if (!cancelled) setError(err.message || 'Unable to redeem collaborator link.');
      }
    }
    if (params.token) redeem();
    return () => { cancelled = true; };
  }, [params.token, router]);

  if (error) {
    return (
      <div className="mx-auto max-w-lg px-4 py-20 text-center">
        <ShieldAlert className="mx-auto h-12 w-12 text-destructive" />
        <h1 className="mt-5 text-2xl font-extrabold text-foreground">Link unavailable</h1>
        <p className="mt-2 text-sm text-muted-foreground">{error}</p>
        <Link href="/" className="mt-6 inline-flex rounded-2xl bg-primary px-5 py-3 text-xs font-bold text-white">Go to Quiz Hub</Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-lg px-4 py-20 text-center">
      <CheckCircle2 className="mx-auto h-12 w-12 animate-pulse text-primary" />
      <h1 className="mt-5 text-2xl font-extrabold text-foreground">Joining subject...</h1>
      <p className="mt-2 flex items-center justify-center gap-2 text-sm text-muted-foreground"><LoaderCircle className="h-4 w-4 animate-spin" /> Activating your collaborator access</p>
    </div>
  );
}
