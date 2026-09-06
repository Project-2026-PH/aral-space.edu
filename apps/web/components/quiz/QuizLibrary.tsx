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
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <h2 id="quiz-library-heading" className="text-xl sm:text-2xl font-black tracking-tight text-slate-900 dark:text-white">
            Reviewers
          </h2>
          {subjects !== undefined && (
            <div className="relative flex items-center">
              <label htmlFor="reviewer-subject-filter" className="sr-only">
                Filter reviewers by subject
              </label>
              <Filter aria-hidden="true" className="pointer-events-none absolute left-3 h-3.5 w-3.5 text-slate-700 dark:text-slate-300" />
              <select
                id="reviewer-subject-filter"
                value={selectedSubjectId}
                onChange={(event) => onSubjectChange?.(event.target.value)}
                disabled={subjects.length === 0}
                className="rounded-xl border-2 border-slate-900 dark:border-white/40 bg-white dark:bg-card py-2 pl-8 pr-8 text-xs font-black text-foreground shadow-brutal-sm outline-none transition-colors focus:border-primary disabled:cursor-not-allowed disabled:opacity-60"
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
        <span className="rounded-lg border-2 border-slate-900 bg-[#fde047] text-slate-900 px-3 py-1 text-xs font-black shadow-brutal-sm">
          {quizzes.length} {quizzes.length === 1 ? 'reviewer' : 'reviewers'}
        </span>
      </div>

      {loading ? (
        <div className="home-card-grid grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3">
          {[1, 2, 3].map((index) => (
            <div key={index} className="h-44 rounded-2xl border-2 border-slate-900/30 bg-muted/40 p-5 animate-pulse" />
          ))}
        </div>
      ) : quizzes.length === 0 ? (
        <div className="flex min-h-48 flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-900/40 dark:border-white/30 p-8 text-center bg-white dark:bg-card">
          <BookOpen className="h-8 w-8 text-muted-foreground" />
          <p className="mt-2 text-sm font-black text-foreground">No reviewers found</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Create your first reviewer deck or import from a handout.
          </p>
        </div>
      ) : (
        <div className="home-card-grid grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3">
          {quizzes.map((quiz) => {
            const subject = quiz.subject ?? subjects?.find((candidate) => candidate.id === quiz.subject_id);
            const subjectName = subject?.name;

            return (
              <article
                key={quiz.id}
                className="group flex min-h-44 flex-col justify-between rounded-2xl border-2 border-slate-900 dark:border-white/40 bg-white dark:bg-card p-5 shadow-brutal transition-all hover:-translate-y-1 hover:shadow-[6px_6px_0px_#0f172a]"
              >
                <Link
                  href={`/review/${quiz.id}`}
                  aria-label={`Review ${quiz.title}`}
                  className="block space-y-2 rounded-xl focus:outline-none"
                >
                  <div className="flex items-center justify-between gap-2 text-xs">
                    {quiz.id === 'b0000000-0000-4000-8000-000000000001' || quiz.share_token === 'kasaysayan-pilipinas-reviewer' ? (
                      <span className="rounded-md border-2 border-slate-900 bg-[#bfdbfe] px-2 py-0.5 text-[10px] font-black text-slate-900 shadow-brutal-sm">
                        Sample Reviewer
                      </span>
                    ) : subjectName ? (
                      <span
                        style={{
                          backgroundColor: `${subject.color}26`,
                          borderColor: '#0f172a',
                          color: subject.color
                        }}
                        className="max-w-[12rem] truncate rounded-md border-2 px-2 py-0.5 text-[10px] font-black shadow-brutal-sm"
                      >
                        {subjectName}
                      </span>
                    ) : (
                      <span className="rounded-md border-2 border-slate-900 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 text-[10px] font-black shadow-brutal-sm">
                        Reviewer
                      </span>
                    )}
                    <span className="shrink-0 rounded-md border-2 border-slate-900 bg-white dark:bg-slate-800 px-2 py-0.5 text-[10px] font-black text-slate-900 dark:text-white shadow-brutal-sm">
                      {quiz.question_count} Qs
                    </span>
                  </div>

                  <h3 className="line-clamp-2 text-sm font-black text-foreground transition-colors group-hover:text-primary">
                    {quiz.title}
                  </h3>

                  {quiz.description ? (
                    <p className="line-clamp-2 text-xs leading-relaxed text-muted-foreground font-medium">
                      {quiz.description}
                    </p>
                  ) : quiz.handout_name ? (
                    <p className="truncate text-xs text-muted-foreground font-medium">
                      Source: {quiz.handout_name}
                    </p>
                  ) : quiz.subject ? (
                    <p className="flex items-center gap-1.5 text-xs text-muted-foreground font-medium">
                      <Layers className="h-3.5 w-3.5" />
                      {quiz.subject.name}
                    </p>
                  ) : null}
                </Link>

                <div className="mt-4 flex items-center justify-between border-t-2 border-slate-900/20 dark:border-white/20 pt-4">
                  <Link
                    href={`/quizzes/${quiz.id}`}
                    className="text-xs font-black text-slate-700 dark:text-slate-300 transition-colors hover:text-primary underline underline-offset-4 decoration-2"
                  >
                    Manage
                  </Link>
                  <Link
                    href={`/practice/${quiz.id}`}
                    className="flex items-center gap-1 rounded-xl border-2 border-slate-900 bg-primary px-3.5 py-1.5 text-xs font-black text-white shadow-brutal-sm transition-all hover:-translate-y-0.5 hover:shadow-brutal active:translate-x-0.5 active:translate-y-0.5 active:shadow-none"
                  >
                    <Play className="h-3 w-3 fill-current" />
                    <span>Practice</span>
                  </Link>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
