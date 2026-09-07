'use client';

import React, { useEffect, useState } from 'react';
import { PublicSubjectDto } from '@quiz-creator/types';
import { BookOpen, ExternalLink, Home, Layers, ShieldAlert, Sparkles } from 'lucide-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import Skeleton from '@/components/ui/Skeleton';

export default function SharedSubjectPage() {
  const params = useParams();
  const shareToken = params?.shareToken as string;
  const [subject, setSubject] = useState<PublicSubjectDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadSubject() {
      if (!shareToken) return;
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(`/api/public/subjects/${shareToken}`);
        const data = await response.json();
        if (!response.ok) {
          throw new Error(data.error || 'This shared subject is not available.');
        }
        setSubject(data);
        void fetch(`/api/public/subjects/${encodeURIComponent(shareToken)}`, {
          method: 'POST',
          credentials: 'same-origin'
        }).catch(() => undefined);
      } catch (err: any) {
        setError(err.message || 'Unable to load shared subject.');
      } finally {
        setLoading(false);
      }
    }

    loadSubject();
  }, [shareToken]);

  if (loading) {
    return (
      <div className="mx-auto max-w-4xl space-y-8 px-4 pb-20 desktop-zoom-133">
        <div className="rounded-3xl border-3 border-slate-900/30 dark:border-white/20 bg-white dark:bg-card p-6 sm:p-8 animate-pulse">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-4">
              <Skeleton className="h-16 w-16 rounded-2xl border-2 border-slate-900/20" />
              <div className="space-y-2">
                <Skeleton className="h-3.5 w-32 rounded-lg" />
                <Skeleton className="h-7 w-56 rounded-xl" />
                <Skeleton className="h-3 w-28 rounded-lg" />
              </div>
            </div>
            <Skeleton className="h-10 w-24 rounded-xl" />
          </div>
        </div>

        <div className="space-y-4">
          <div className="flex items-end justify-between gap-3">
            <div className="space-y-1.5">
              <Skeleton className="h-3 w-24 rounded-lg" />
              <Skeleton className="h-5 w-36 rounded-xl" />
            </div>
            <Skeleton className="h-6 w-20 rounded-lg" />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {[0, 1, 2, 3].map((item) => (
              <div key={item} className="h-44 rounded-2xl border-2 border-slate-900/30 dark:border-white/20 bg-muted/40 p-5 animate-pulse" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error || !subject) {
    return (
      <div className="mx-auto max-w-lg space-y-6 rounded-3xl border-3 border-slate-900 dark:border-white/40 bg-white dark:bg-card p-8 shadow-brutal text-center my-12">
        <div className="inline-flex rounded-2xl border-2 border-slate-900 bg-destructive/10 p-4 text-destructive shadow-brutal-sm">
          <ShieldAlert className="h-10 w-10 stroke-[2.5]" />
        </div>
        <div className="space-y-2">
          <h1 className="text-2xl font-black text-slate-900 dark:text-white">Subject Not Found</h1>
          <p className="mx-auto max-w-sm text-xs font-medium leading-relaxed text-muted-foreground">
            {error || 'This link may have expired, been revoked, or set to private by its author.'}
          </p>
        </div>
        <Link
          href="/"
          className="inline-flex items-center gap-2 rounded-xl border-2 border-slate-900 bg-primary px-6 py-3 text-xs font-black text-white shadow-brutal-sm hover:-translate-y-0.5 hover:shadow-brutal active:translate-x-0.5 active:translate-y-0.5 active:shadow-none transition-all cursor-pointer"
        >
          <Home className="h-4 w-4 stroke-[2.5]" />
          Go to Quiz Hub
        </Link>
      </div>
    );
  }

  const quizzes = Array.isArray(subject.quizzes) ? subject.quizzes : [];

  return (
    <div className="mx-auto max-w-4xl space-y-8 px-4 pb-20 desktop-zoom-133">
      <div className="rounded-3xl border-3 border-slate-900 dark:border-white/40 bg-white dark:bg-card p-6 shadow-brutal sm:p-8">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <div
              aria-hidden="true"
              style={{ backgroundColor: subject.color }}
              className="h-16 w-16 shrink-0 rounded-2xl border-2 border-slate-900 shadow-brutal-sm"
            />
            <div>
              <span className="inline-flex items-center gap-1.5 rounded-md border-2 border-slate-900 bg-[#bfdbfe] px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-slate-900 shadow-brutal-sm">
                <Layers className="h-3.5 w-3.5 stroke-[2.5]" />
                Shared Subject Library
              </span>
              <h1 className="mt-2 text-2xl font-black tracking-tight text-slate-900 dark:text-white sm:text-3xl">{subject.name}</h1>
              <p className="mt-1 text-xs font-bold text-muted-foreground">
                {quizzes.length} {quizzes.length === 1 ? 'study set' : 'study sets'}
              </p>
            </div>
          </div>
          <Link
            href="/library"
            className="inline-flex items-center justify-center gap-2 rounded-xl border-2 border-slate-900 bg-white dark:bg-slate-800 px-4 py-2 text-xs font-black text-slate-900 dark:text-white shadow-brutal-sm hover:-translate-y-0.5 hover:shadow-brutal active:translate-x-0.5 active:translate-y-0.5 active:shadow-none transition-all cursor-pointer"
          >
            <Home className="h-3.5 w-3.5 stroke-[2.5]" />
            Back to Library
          </Link>
        </div>
      </div>

      {quizzes.length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed border-slate-900/40 dark:border-white/30 bg-white dark:bg-card p-12 text-center">
          <BookOpen className="mx-auto h-8 w-8 text-muted-foreground" />
          <h2 className="mt-4 text-sm font-black text-foreground">No study sets in this subject yet</h2>
          <p className="mx-auto mt-1 max-w-sm text-xs font-medium leading-relaxed text-muted-foreground">
            No study sets have been added or shared under this subject yet.
          </p>
        </div>
      ) : (
        <section className="space-y-4" aria-labelledby="shared-study-sets-heading">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 id="shared-study-sets-heading" className="text-xl font-black text-slate-900 dark:text-white">
              Study Sets
            </h2>
            <span className="rounded-lg border-2 border-slate-900 bg-[#fde047] px-3 py-1 text-xs font-black text-slate-900 shadow-brutal-sm">
              {quizzes.length} available
            </span>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {quizzes.map((quiz) => (
              <article key={quiz.id} className="flex flex-col justify-between rounded-2xl border-2 border-slate-900 dark:border-white/40 bg-white dark:bg-card p-5 shadow-brutal transition-all hover:-translate-y-1 hover:shadow-[6px_6px_0px_#0f172a]">
                <div>
                  <div className="flex items-center justify-between gap-3">
                    <span className="rounded-md border-2 border-slate-900 bg-[#bfdbfe] px-2 py-0.5 text-[10px] font-black text-slate-900 shadow-brutal-sm">Study Set</span>
                    <span className="shrink-0 rounded-md border-2 border-slate-900 bg-white dark:bg-slate-800 px-2 py-0.5 text-[10px] font-black text-slate-900 dark:text-white shadow-brutal-sm">
                      {quiz.question_count} Qs
                    </span>
                  </div>
                  <h3 className="mt-3 line-clamp-2 text-sm font-black text-foreground">{quiz.title}</h3>
                  {quiz.description && <p className="mt-2 line-clamp-2 text-xs font-medium leading-relaxed text-muted-foreground">{quiz.description}</p>}
                </div>
                <div className="mt-5 border-t-2 border-slate-900/20 dark:border-white/20 pt-4">
                  <Link
                    href={`/review/${quiz.id}?${quiz.share_token ? `shareToken=${encodeURIComponent(quiz.share_token)}&` : ''}subjectShareToken=${encodeURIComponent(subject.share_token)}`}
                    className="inline-flex items-center gap-1.5 rounded-xl border-2 border-slate-900 bg-primary px-3.5 py-1.5 text-xs font-black text-white shadow-brutal-sm transition-all hover:-translate-y-0.5 hover:shadow-brutal active:translate-x-0.5 active:translate-y-0.5 active:shadow-none"
                  >
                    <ExternalLink className="h-3.5 w-3.5 stroke-[2.5]" />
                    <span>View study set</span>
                  </Link>
                </div>
              </article>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
