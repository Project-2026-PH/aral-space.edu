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
        <div className="rounded-3xl border-3 border-slate-900 dark:border-white/40 bg-white dark:bg-card p-8 shadow-brutal space-y-5">
          <div className="mx-auto inline-flex rounded-2xl border-2 border-slate-900 bg-destructive/10 p-4 text-destructive shadow-brutal-sm">
            <ShieldAlert className="h-10 w-10 stroke-[2.5]" />
          </div>
          <h1 className="text-2xl font-black text-slate-900 dark:text-white">Link unavailable</h1>
          <p className="text-xs font-medium text-muted-foreground">{error}</p>
          <div>
            <Link
              href="/"
              className="inline-flex items-center gap-2 rounded-xl border-2 border-slate-900 bg-primary px-6 py-3 text-xs font-black text-white shadow-brutal-sm hover:-translate-y-0.5 hover:shadow-brutal active:translate-x-0.5 active:translate-y-0.5 active:shadow-none transition-all cursor-pointer"
            >
              Go to Quiz Hub
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-lg px-4 py-20 text-center">
      <div className="rounded-3xl border-3 border-slate-900 dark:border-white/40 bg-white dark:bg-card p-8 shadow-brutal space-y-4">
        <div className="mx-auto inline-flex rounded-2xl border-2 border-slate-900 bg-[#86efac] p-4 text-slate-900 shadow-brutal-sm">
          <CheckCircle2 className="h-10 w-10 stroke-[2.5] animate-pulse" />
        </div>
        <h1 className="text-2xl font-black text-slate-900 dark:text-white">Joining subject...</h1>
        <p className="flex items-center justify-center gap-2 text-xs font-bold text-muted-foreground">
          <LoaderCircle className="h-4 w-4 animate-spin stroke-[2.5]" /> Activating your collaborator access
        </p>
      </div>
    </div>
  );
}
