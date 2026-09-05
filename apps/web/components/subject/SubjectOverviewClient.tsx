'use client';

import Link from 'next/link';
import { ArrowLeft, ExternalLink, Globe, Layers } from 'lucide-react';
import { Quiz, Subject } from '@quiz-creator/types';
import QuizLibrary from '@/components/quiz/QuizLibrary';

interface SubjectOverviewClientProps {
  subject: Subject;
  quizzes: Quiz[];
}

export default function SubjectOverviewClient({ subject, quizzes }: SubjectOverviewClientProps) {
  const isPublic = subject.is_public !== false;

  return (
    <div className="space-y-8 pb-20">
      <div className="flex flex-col gap-5 rounded-3xl border border-border/80 bg-card p-6 shadow-sm sm:p-8">
        <Link
          href="/"
          className="inline-flex w-fit items-center gap-1.5 text-xs font-semibold text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to library
        </Link>

        <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-start">
          <div className="flex min-w-0 items-start gap-4">
            <span
              aria-hidden="true"
              style={{ backgroundColor: subject.color }}
              className="h-12 w-12 shrink-0 rounded-2xl border border-black/5 shadow-inner"
            />
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="truncate text-2xl font-extrabold tracking-tight text-foreground">{subject.name}</h1>
                <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-bold ${isPublic ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'}`}>
                  <Globe className="h-3 w-3" />
                  {isPublic ? 'Public' : 'Private'}
                </span>
              </div>
              <p className="mt-2 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                <Layers className="h-3.5 w-3.5" />
                {quizzes.length} {quizzes.length === 1 ? 'reviewer' : 'reviewers'} in this subject
              </p>
            </div>
          </div>

          {subject.share_token && isPublic && (
            <Link
              href={`/subjects/share/${subject.share_token}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex w-fit items-center gap-1.5 rounded-xl border border-border bg-background px-3 py-2 text-xs font-semibold text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              Open public page
            </Link>
          )}
        </div>
      </div>

      <QuizLibrary quizzes={quizzes} loading={false} />
    </div>
  );
}
