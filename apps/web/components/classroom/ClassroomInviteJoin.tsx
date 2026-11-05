'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowRight, LoaderCircle, LockKeyhole, Users } from 'lucide-react';

interface ClassroomInviteJoinProps {
  code: string;
}

export default function ClassroomInviteJoin({ code }: ClassroomInviteJoinProps) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const join = async () => {
    setBusy(true);
    setError('');
    try {
      const response = await fetch('/api/classes/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok || typeof body.classroom_id !== 'string') {
        throw new Error(body.error || 'This class invite is invalid, expired, or revoked.');
      }
      router.replace(`/library?tab=classes&classId=${encodeURIComponent(body.classroom_id)}`);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Could not join this class.');
      setBusy(false);
    }
  };

  return (
    <main className="mx-auto flex min-h-[calc(100vh-5rem)] max-w-xl items-center px-4 py-10">
      <section className="w-full rounded-3xl border-3 border-slate-900 bg-white p-6 text-center shadow-brutal dark:border-white/30 dark:bg-card sm:p-8">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border-2 border-slate-900 bg-[#bfdbfe] text-slate-950 shadow-brutal-sm dark:border-white/40">
          <Users aria-hidden="true" className="h-7 w-7" />
        </div>
        <h1 className="mt-5 text-2xl font-black tracking-tight text-slate-950 dark:text-white">You’re invited to a class</h1>
        <p className="mx-auto mt-2 max-w-sm text-sm font-semibold leading-relaxed text-muted-foreground">Join to see the class’s shared study sets and practice them in Aral Space.</p>
        <div className="mx-auto mt-5 inline-flex items-center gap-2 rounded-xl border border-emerald-700/30 bg-emerald-50 px-3 py-2 text-xs font-black text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200">
          <LockKeyhole aria-hidden="true" className="h-4 w-4" /> Private class access
        </div>
        {error && <p role="alert" className="mt-4 rounded-xl border-2 border-rose-700 bg-rose-50 p-3 text-xs font-bold text-rose-800 dark:bg-rose-950/40 dark:text-rose-200">{error}</p>}
        <div className="mt-6 flex flex-col justify-center gap-2 sm:flex-row">
          <button type="button" onClick={() => void join()} disabled={busy} className="inline-flex items-center justify-center gap-2 rounded-xl border-2 border-slate-900 bg-[#fde047] px-5 py-3 text-sm font-black text-slate-950 shadow-brutal-sm transition hover:-translate-y-0.5 hover:shadow-brutal disabled:opacity-60 dark:border-white/40">
            {busy ? <LoaderCircle aria-hidden="true" className="h-4 w-4 animate-spin" /> : <ArrowRight aria-hidden="true" className="h-4 w-4" />}
            {busy ? 'Joining…' : 'Join class'}
          </button>
          <Link href="/library?tab=classes" className="inline-flex items-center justify-center rounded-xl border-2 border-slate-900 bg-white px-5 py-3 text-sm font-black text-slate-900 shadow-brutal-sm dark:border-white/40 dark:bg-slate-800 dark:text-white">Open classes</Link>
        </div>
      </section>
    </main>
  );
}
