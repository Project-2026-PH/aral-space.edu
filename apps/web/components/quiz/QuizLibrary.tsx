'use client';

import React, { useEffect, useState } from 'react';
import { Quiz, Subject } from '@quiz-creator/types';
import { ArrowRight, BookOpen, Filter } from 'lucide-react';
import { useRouter } from 'next/navigation';
import Skeleton from '@/components/ui/Skeleton';
import ConfirmModal from '@/components/ui/ConfirmModal';
import SwipeableQuizCard from './SwipeableQuizCard';

interface QuizLibraryProps {
  quizzes: Quiz[];
  loading?: boolean;
  subjects?: Subject[];
  selectedSubjectId?: string;
  onSubjectChange?: (subjectId: string) => void;
  onQuizDeleted?: (quizId: string) => void;
  readOnly?: boolean;
  heading?: string;
  maxItems?: number;
  onViewAll?: () => void;
}

export default function QuizLibrary({
  quizzes,
  loading = false,
  subjects,
  selectedSubjectId = '',
  onSubjectChange,
  onQuizDeleted,
  readOnly = false,
  heading = 'Reviewers',
  maxItems,
  onViewAll,
}: QuizLibraryProps) {
  const router = useRouter();
  const [swipedQuizId, setSwipedQuizId] = useState<string | null>(null);
  const [deleteQuiz, setDeleteQuiz] = useState<Quiz | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Close open swipe card when tapping anywhere outside
  useEffect(() => {
    if (!swipedQuizId) return;

    function handlePointerDown(e: PointerEvent) {
      const target = e.target as HTMLElement | null;
      if (!target?.closest('.quiz-card-enter')) {
        setSwipedQuizId(null);
      }
    }

    window.addEventListener('pointerdown', handlePointerDown);
    return () => window.removeEventListener('pointerdown', handlePointerDown);
  }, [swipedQuizId]);

  async function handleDeleteQuiz() {
    if (!deleteQuiz || isDeleting) return;
    setIsDeleting(true);
    try {
      const res = await fetch(`/api/quizzes/${deleteQuiz.id}`, {
        method: 'DELETE'
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to delete reviewer');
      }
      onQuizDeleted?.(deleteQuiz.id);
      setDeleteQuiz(null);
    } catch (err) {
      console.error('Failed to delete reviewer:', err);
    } finally {
      setIsDeleting(false);
    }
  }

  const headingId = readOnly ? 'shared-reviewer-library-heading' : 'quiz-library-heading';
  const visibleQuizzes = maxItems ? quizzes.slice(0, maxItems) : quizzes;

  return (
    <section className="space-y-4" aria-labelledby={headingId}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <h2 id={headingId} className="text-xl sm:text-2xl font-black tracking-tight text-slate-900 dark:text-white">
            {heading}
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
        <div className="home-card-grid grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((index) => (
            <div key={index} className="h-36 sm:h-[148px] rounded-2xl border-2 border-slate-900/30 bg-muted/40 p-4 animate-pulse" />
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
        <div className="home-card-grid grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {visibleQuizzes.map((quiz) => {
            const subject = quiz.subject ?? subjects?.find((candidate) => candidate.id === quiz.subject_id);

            return (
              <SwipeableQuizCard
                key={quiz.id}
                quiz={quiz}
                subject={subject}
                readOnly={readOnly}
                isOpen={swipedQuizId === quiz.id}
                onOpen={() => setSwipedQuizId(quiz.id)}
                onClose={() => {
                  if (swipedQuizId === quiz.id) setSwipedQuizId(null);
                }}
                onEdit={() => {
                  setSwipedQuizId(null);
                  router.push(`/quizzes/${quiz.id}`);
                }}
                onDelete={() => {
                  setSwipedQuizId(null);
                  setDeleteQuiz(quiz);
                }}
              />
            );
          })}
        </div>
      )}

      {maxItems && quizzes.length > visibleQuizzes.length && onViewAll && (
        <button
          type="button"
          onClick={onViewAll}
          className="inline-flex items-center gap-1.5 text-xs font-black text-primary underline-offset-2 hover:underline"
        >
          View all {quizzes.length} reviewers
          <ArrowRight aria-hidden="true" className="h-3.5 w-3.5" />
        </button>
      )}

      <ConfirmModal
        open={Boolean(deleteQuiz)}
        onOpenChange={(open) => {
          if (!open && !isDeleting) setDeleteQuiz(null);
        }}
        onConfirm={handleDeleteQuiz}
        title="Delete Reviewer"
        message={
          deleteQuiz
            ? `Are you sure you want to permanently delete "${deleteQuiz.title}" and all its questions? This action cannot be undone.`
            : 'Delete reviewer?'
        }
        destructive
        confirmText={isDeleting ? 'Deleting...' : 'Delete Reviewer'}
      />
    </section>
  );
}
