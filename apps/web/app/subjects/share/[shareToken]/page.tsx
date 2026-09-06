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
      <div className="mx-auto max-w-4xl space-y-8 px-4 pb-20">
        <div className="rounded-3xl border border-border/80 bg-card p-6 shadow-sm sm:p-8">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-4">
              <Skeleton className="h-16 w-16 rounded-3xl" />
              <div className="space-y-2">
                <Skeleton className="h-3.5 w-32 rounded-full" />
                <Skeleton className="h-7 w-56 rounded-xl" />
                <Skeleton className="h-3 w-28 rounded-full" />
              </div>
            </div>
            <Skeleton className="h-10 w-24 rounded-2xl" />
          </div>
        </div>

        <div className="space-y-4">
          <div className="flex items-end justify-between gap-3">
            <div className="space-y-1.5">
              <Skeleton className="h-3 w-24 rounded-full" />
              <Skeleton className="h-5 w-36 rounded-xl" />
            </div>
            <Skeleton className="h-6 w-20 rounded-full" />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {[0, 1, 2, 3].map((item) => (
              <Skeleton key={item} className="h-44 rounded-3xl border border-border/40 bg-muted/40" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error || !subject) {
    return (
      <div className="mx-auto max-w-lg space-y-6 px-4 py-20 text-center">
        <div className="inline-flex rounded-full bg-destructive/10 p-5 text-destructive">
          <ShieldAlert className="h-12 w-12" />
        </div>
        <div className="space-y-2">
          <h1 className="text-2xl font-extrabold text-foreground">Subject Not Found</h1>
          <p className="mx-auto max-w-sm text-xs leading-relaxed text-muted-foreground">
            {error || 'This link may have expired, been revoked, or set to private by its author.'}
          </p>
        </div>
        <Link
          href="/"
          className="inline-flex items-center gap-2 rounded-2xl bg-primary px-6 py-3 text-xs font-bold text-white shadow-lg shadow-primary/20 transition-all hover:bg-primary/90 active:scale-95"
        >
          <Home className="h-4 w-4" />
          Go to Quiz Hub
        </Link>
      </div>
    );
  }

  const quizzes = Array.isArray(subject.quizzes) ? subject.quizzes : [];

  return (
    <div className="mx-auto max-w-4xl space-y-8 px-4 pb-20">
      <div className="rounded-3xl border border-border/80 bg-card p-6 shadow-sm sm:p-8">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <div
              aria-hidden="true"
              style={{ backgroundColor: subject.color }}
              className="h-16 w-16 shrink-0 rounded-3xl border border-black/5 shadow-inner"
            />
            <div>
              <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.18em] text-primary">
                <Layers className="h-3.5 w-3.5" />
                Shared Subject Library
              </p>
              <h1 className="mt-1 text-2xl font-extrabold tracking-tight text-foreground sm:text-3xl">{subject.name}</h1>
              <p className="mt-1 text-xs text-muted-foreground">
                {quizzes.length} {quizzes.length === 1 ? 'study set' : 'study sets'}
              </p>
            </div>
          </div>
          <Link
            href="/"
            className="inline-flex items-center justify-center gap-2 rounded-2xl border border-border bg-background px-4 py-2.5 text-xs font-bold text-foreground transition-all hover:bg-muted active:scale-95"
          >
            <Home className="h-3.5 w-3.5" />
            Home
          </Link>
        </div>
      </div>

      {quizzes.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-border bg-card p-12 text-center">
          <BookOpen className="mx-auto h-8 w-8 text-muted-foreground" />
          <h2 className="mt-4 text-sm font-bold text-foreground">No study sets in this subject yet</h2>
          <p className="mx-auto mt-1 max-w-sm text-xs leading-relaxed text-muted-foreground">
            No study sets have been added or shared under this subject yet.
          </p>
        </div>
      ) : (
        <section className="space-y-4" aria-labelledby="shared-study-sets-heading">
          <div className="flex items-end justify-between gap-3">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-primary">Inside this subject</p>
              <h2 id="shared-study-sets-heading" className="mt-1 text-lg font-extrabold text-foreground">Study Sets</h2>
            </div>
            <span className="rounded-full bg-muted px-3 py-1 text-[11px] font-bold text-muted-foreground">
              {quizzes.length} available
            </span>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {quizzes.map((quiz) => (
              <article key={quiz.id} className="flex flex-col justify-between rounded-3xl border border-border/80 bg-card p-5 shadow-2xs transition-all hover:border-primary/40 hover:shadow-md">
                <div>
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-[11px] font-medium text-muted-foreground">Study Set</span>
                    <span className="rounded-full bg-muted px-2.5 py-0.5 text-[11px] font-bold text-muted-foreground">
                      {quiz.question_count} Qs
                    </span>
                  </div>
                  <h3 className="mt-3 line-clamp-2 text-sm font-bold text-foreground">{quiz.title}</h3>
                  {quiz.description && <p className="mt-2 line-clamp-2 text-[11px] leading-relaxed text-muted-foreground">{quiz.description}</p>}
                </div>
                <div className="mt-5 border-t border-border/40 pt-4">
                  <Link
                    href={`/review/${quiz.id}?shareToken=${encodeURIComponent(quiz.share_token)}&subjectShareToken=${encodeURIComponent(subject.share_token)}`}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-primary/10 px-3 py-1.5 text-xs font-bold text-primary transition-all hover:bg-primary hover:text-white active:scale-95"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                    View study set
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
