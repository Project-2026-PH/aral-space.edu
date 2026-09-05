'use client';

import React from 'react';
import { Quiz, Subject } from '@quiz-creator/types';
import { BookOpen, Filter, Layers, Play } from 'lucide-react';
import Link from 'next/link';
import Skeleton from '@/components/ui/Skeleton';

interface QuizLibraryProps {
  quizzes: Quiz[];
  loading?: boolean;
  subjects?: Subject[];
  selectedSubjectId?: string;
  onSubjectChange?: (subjectId: string) => void;
}

export default function QuizLibrary({
  quizzes,
  loading = false,
  subjects,
  selectedSubjectId = '',
  onSubjectChange,
}: QuizLibraryProps) {
  return (
    <section className="space-y-4" aria-labelledby="quiz-library-heading">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <h2 id="quiz-library-heading" className="mt-1 text-lg font-extrabold tracking-tight text-foreground">
            Reviewers
          </h2>
          {subjects !== undefined && (
            <div className="relative flex items-center">
              <label htmlFor="reviewer-subject-filter" className="sr-only">
                Filter reviewers by subject
              </label>
              <Filter aria-hidden="true" className="pointer-events-none absolute left-3 h-3.5 w-3.5 text-muted-foreground" />
              <select
                id="reviewer-subject-filter"
                value={selectedSubjectId}
                onChange={(event) => onSubjectChange?.(event.target.value)}
                disabled={subjects.length === 0}
                className="rounded-2xl border border-border bg-card py-2 pl-8 pr-8 text-xs font-semibold text-foreground outline-none transition-colors focus:border-primary disabled:cursor-not-allowed disabled:opacity-60"
              >
                <option value="">All subjects</option>
                {subjects.map((subject) => (
                  <option key={subject.id} value={subject.id}>
                    {subject.name}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
        <span className="rounded-full bg-muted px-3 py-1 text-[11px] font-bold text-muted-foreground">
          {quizzes.length} {quizzes.length === 1 ? 'reviewer' : 'reviewers'}
        </span>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3">
          {[0, 1, 2].map((item) => (
            <Skeleton key={item} className="h-44 rounded-3xl border border-border/40 bg-muted/40" />
          ))}
        </div>
      ) : quizzes.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-border bg-card p-8 text-center">
          <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <BookOpen className="h-5 w-5" />
          </div>
          <h3 className="mt-4 text-sm font-bold text-foreground">No quizzes found</h3>
          <p className="mx-auto mt-1 max-w-sm text-xs leading-relaxed text-muted-foreground">
            Generate a quiz with AI or use the manual builder to create your first question bank.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3">
          {quizzes.map((quiz) => (
            <article
              key={quiz.id}
              className="group flex min-h-44 flex-col justify-between rounded-3xl border border-border/80 bg-card p-5 shadow-2xs transition-all hover:border-primary/40 hover:shadow-md"
            >
              <Link
                href={`/review/${quiz.id}`}
                aria-label={`Review ${quiz.title}`}
                className="block space-y-2 rounded-2xl focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
              >
                <div className="flex items-center justify-between gap-2 text-xs">
                  {quiz.id === 'quiz-cognitive-mastery-sample' ? (
                    <span className="rounded-full bg-indigo-500/15 px-2.5 py-0.5 text-[11px] font-bold text-indigo-500">
                      Cognitive Mastery Loop
                    </span>
                  ) : (
                    <span className="text-[11px] font-medium text-muted-foreground">Reviewer</span>
                  )}
                  <span className="shrink-0 rounded-full bg-muted px-2.5 py-0.5 text-[11px] font-bold text-muted-foreground">
                    {quiz.question_count} Qs
                  </span>
                </div>

                <h3 className="line-clamp-2 text-sm font-bold text-foreground transition-colors group-hover:text-primary">
                  {quiz.title}
                </h3>

                {quiz.description ? (
                  <p className="line-clamp-2 text-[11px] leading-relaxed text-muted-foreground">
                    {quiz.description}
                  </p>
                ) : quiz.handout_name ? (
                  <p className="truncate text-[11px] text-muted-foreground">
                    Source: {quiz.handout_name}
                  </p>
                ) : quiz.subject ? (
                  <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                    <Layers className="h-3 w-3" />
                    {quiz.subject.name}
                  </p>
                ) : null}
              </Link>

              <div className="mt-4 flex items-center justify-between border-t border-border/40 pt-4">
                <Link
                  href={`/quizzes/${quiz.id}`}
                  className="text-xs font-semibold text-muted-foreground transition-colors hover:text-foreground"
                >
                  Manage
                </Link>
                <Link
                  href={`/practice/${quiz.id}`}
                  className="flex items-center gap-1 rounded-xl bg-primary/10 px-3 py-1.5 text-xs font-bold text-primary shadow-2xs transition-all hover:bg-primary hover:text-white active:scale-95"
                >
                  <Play className="h-3 w-3 fill-current" />
                  <span>Practice</span>
                </Link>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
