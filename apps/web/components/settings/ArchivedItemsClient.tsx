'use client';

import React, { useMemo, useState } from 'react';
import { Quiz, Subject } from '@quiz-creator/types';
import { Archive, ArrowLeft, BookOpen, Layers, LoaderCircle, RotateCcw } from 'lucide-react';
import Link from 'next/link';

interface ArchivedItemsClientProps {
  initialSubjects: Subject[];
  initialQuizzes: Quiz[];
}

export default function ArchivedItemsClient({
  initialSubjects,
  initialQuizzes,
}: ArchivedItemsClientProps) {
  const [subjects, setSubjects] = useState<Subject[]>(initialSubjects);
  const [quizzes, setQuizzes] = useState<Quiz[]>(initialQuizzes);
  const [restoringSubjectId, setRestoringSubjectId] = useState<string | null>(null);
  const [restoringQuizId, setRestoringQuizId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const subjectById = useMemo(
    () => new Map(subjects.map((subject) => [subject.id, subject])),
    [subjects]
  );

  async function restoreSubject(subjectId: string) {
    if (restoringSubjectId || restoringQuizId) return;
    setRestoringSubjectId(subjectId);
    setError(null);
    try {
      const response = await fetch(`/api/subjects/${subjectId}/restore`, { method: 'POST' });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'Unable to restore subject');

      setSubjects((current) => current.filter((subject) => subject.id !== subjectId));
      setQuizzes((current) => current.filter((quiz) => (
        quiz.subject_id !== subjectId || !quiz.archived_by_subject
      )));
    } catch (restoreError) {
      setError(restoreError instanceof Error ? restoreError.message : 'Unable to restore subject');
    } finally {
      setRestoringSubjectId(null);
    }
  }

  async function restoreQuiz(quizId: string) {
    if (restoringSubjectId || restoringQuizId) return;
    setRestoringQuizId(quizId);
    setError(null);
    try {
      const response = await fetch(`/api/quizzes/${quizId}/restore`, { method: 'POST' });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'Unable to restore reviewer');
      setQuizzes((current) => current.filter((quiz) => quiz.id !== quizId));
    } catch (restoreError) {
      setError(restoreError instanceof Error ? restoreError.message : 'Unable to restore reviewer');
    } finally {
      setRestoringQuizId(null);
    }
  }

  const archivedCount = subjects.length + quizzes.length;

  return (
    <div className="mx-auto max-w-5xl space-y-7 px-4 py-6 pb-24 sm:px-6 lg:px-8 desktop-zoom-133">
      <section className="space-y-4 rounded-3xl border-3 border-slate-900 bg-slate-50 p-4 shadow-brutal dark:border-white/30 dark:bg-card sm:p-6">
        <Link
          href="/library"
          className="inline-flex w-fit items-center gap-1.5 rounded-xl border-2 border-slate-900 bg-white px-3 py-1.5 text-xs font-black text-slate-900 shadow-brutal-sm transition-all duration-150 hover:translate-x-0.5 hover:translate-y-0.5 hover:shadow-none dark:bg-slate-800 dark:text-white active:scale-95 cursor-pointer"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to library
        </Link>

        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex min-w-0 items-start gap-3.5">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border-2 border-slate-900 bg-[#fde047] text-slate-900 shadow-brutal-sm">
              <Archive className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white sm:text-3xl">
                Archived items
              </h1>
              <p className="mt-1 max-w-2xl text-xs font-medium leading-relaxed text-muted-foreground">
                Archived subjects and reviewers are hidden from your active library until you restore them.
              </p>
            </div>
          </div>
          <span className="rounded-lg border-2 border-slate-900 bg-[#fde047] px-3 py-1 text-xs font-black text-slate-900 shadow-brutal-sm">
            {archivedCount} {archivedCount === 1 ? 'item' : 'items'}
          </span>
        </div>
      </section>

      {error && (
        <div role="alert" className="rounded-2xl border-2 border-destructive/30 bg-destructive/10 px-4 py-3 text-xs font-bold text-destructive">
          {error}
        </div>
      )}

      {archivedCount === 0 ? (
        <section className="flex min-h-56 flex-col items-center justify-center rounded-3xl border-2 border-dashed border-slate-900/40 bg-white p-8 text-center dark:border-white/30 dark:bg-card">
          <Archive className="h-9 w-9 text-muted-foreground" />
          <h2 className="mt-3 text-lg font-black text-foreground">Nothing archived</h2>
          <p className="mt-1 text-xs text-muted-foreground">Archived subjects and reviewers will appear here.</p>
        </section>
      ) : (
        <div className="space-y-7">
          {subjects.length > 0 && (
            <section className="space-y-4" aria-labelledby="archived-subjects-heading">
              <div className="flex items-center justify-between gap-3">
                <h2 id="archived-subjects-heading" className="text-xl font-black tracking-tight text-slate-900 dark:text-white">
                  Subjects
                </h2>
                <span className="rounded-lg border-2 border-slate-900 bg-[#86efac] px-3 py-1 text-xs font-black text-slate-900 shadow-brutal-sm">
                  {subjects.length}
                </span>
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {subjects.map((subject) => {
                  const childCount = quizzes.filter((quiz) => quiz.subject_id === subject.id).length;
                  const isRestoring = restoringSubjectId === subject.id;
                  return (
                    <article key={subject.id} className="flex min-h-36 flex-col justify-between rounded-2xl border-2 border-slate-900 bg-white p-4 shadow-brutal dark:border-white/40 dark:bg-card">
                      <div className="flex items-start gap-3">
                        <span
                          aria-hidden="true"
                          style={{ backgroundColor: subject.color }}
                          className="h-9 w-9 shrink-0 rounded-xl border-2 border-slate-900 shadow-brutal-sm"
                        />
                        <div className="min-w-0">
                          <h3 className="truncate text-sm font-black text-foreground">{subject.name}</h3>
                          <p className="mt-1 text-[11px] font-bold text-muted-foreground">
                            {childCount} {childCount === 1 ? 'reviewer' : 'reviewers'} in this subject
                          </p>
                          <p className="mt-1 text-[10px] text-muted-foreground">
                            Archived {subject.archived_at ? new Date(subject.archived_at).toLocaleDateString() : ''}
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => void restoreSubject(subject.id)}
                        disabled={Boolean(restoringSubjectId || restoringQuizId)}
                        className="mt-4 inline-flex items-center justify-center gap-1.5 rounded-xl border-2 border-slate-900 bg-primary px-3 py-2 text-xs font-black text-white shadow-brutal-sm transition-all hover:-translate-y-0.5 hover:shadow-brutal disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {isRestoring ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> : <RotateCcw className="h-3.5 w-3.5" />}
                        {isRestoring ? 'Restoring...' : 'Restore subject'}
                      </button>
                    </article>
                  );
                })}
              </div>
            </section>
          )}

          {quizzes.length > 0 && (
            <section className="space-y-4" aria-labelledby="archived-reviewers-heading">
              <div className="flex items-center justify-between gap-3">
                <h2 id="archived-reviewers-heading" className="text-xl font-black tracking-tight text-slate-900 dark:text-white">
                  Reviewers
                </h2>
                <span className="rounded-lg border-2 border-slate-900 bg-[#fde047] px-3 py-1 text-xs font-black text-slate-900 shadow-brutal-sm">
                  {quizzes.length}
                </span>
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {quizzes.map((quiz) => {
                  const subject = quiz.subject ?? (quiz.subject_id ? subjectById.get(quiz.subject_id) : undefined);
                  const isRestoring = restoringQuizId === quiz.id;
                  return (
                    <article key={quiz.id} className="flex min-h-36 flex-col justify-between rounded-2xl border-2 border-slate-900 bg-white p-4 shadow-brutal dark:border-white/40 dark:bg-card">
                      <div>
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <h3 className="line-clamp-2 text-sm font-black text-foreground">{quiz.title}</h3>
                            <p className="mt-1 flex items-center gap-1.5 text-[11px] font-bold text-muted-foreground">
                              <BookOpen className="h-3 w-3" />
                              {quiz.question_count} {quiz.question_count === 1 ? 'question' : 'questions'}
                            </p>
                          </div>
                          <Layers className="h-4 w-4 shrink-0 text-muted-foreground" />
                        </div>
                        <p className="mt-2 truncate text-[11px] font-bold text-muted-foreground">
                          {subject ? `Subject: ${subject.name}` : 'Standalone reviewer'}
                        </p>
                        <p className="mt-1 text-[10px] text-muted-foreground">
                          Archived {quiz.archived_at ? new Date(quiz.archived_at).toLocaleDateString() : ''}
                        </p>
                      </div>
                      {quiz.archived_by_subject ? (
                        <p className="mt-4 rounded-xl border-2 border-dashed border-slate-900/30 px-3 py-2 text-center text-[11px] font-bold text-muted-foreground dark:border-white/20">
                          Restore the subject to bring this reviewer back.
                        </p>
                      ) : (
                        <button
                          type="button"
                          onClick={() => void restoreQuiz(quiz.id)}
                          disabled={Boolean(restoringSubjectId || restoringQuizId)}
                          className="mt-4 inline-flex items-center justify-center gap-1.5 rounded-xl border-2 border-slate-900 bg-primary px-3 py-2 text-xs font-black text-white shadow-brutal-sm transition-all hover:-translate-y-0.5 hover:shadow-brutal disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {isRestoring ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> : <RotateCcw className="h-3.5 w-3.5" />}
                          {isRestoring ? 'Restoring...' : 'Restore reviewer'}
                        </button>
                      )}
                    </article>
                  );
                })}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  );
}
