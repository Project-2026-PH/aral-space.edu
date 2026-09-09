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
  selectedTerm?: string;
  onTermChange?: (term: string) => void;
  onQuizDeleted?: (quizId: string) => void;
  onQuizArchived?: (quizId: string) => void;
  readOnly?: boolean;
  heading?: string;
  maxItems?: number;
  onViewAll?: () => void;
  subjectId?: string;
}

export default function QuizLibrary({
  quizzes,
  loading = false,
  subjects,
  selectedSubjectId = '',
  onSubjectChange,
  selectedTerm: selectedTermProp,
  onTermChange,
  onQuizDeleted,
  onQuizArchived,
  readOnly = false,
  heading = 'Reviewers',
  maxItems,
  onViewAll,
  subjectId,
}: QuizLibraryProps) {
  const router = useRouter();
  const [swipedQuizId, setSwipedQuizId] = useState<string | null>(null);
  const [deleteQuiz, setDeleteQuiz] = useState<Quiz | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [archivingQuizId, setArchivingQuizId] = useState<string | null>(null);
  const [archivedQuizIds, setArchivedQuizIds] = useState<Set<string>>(() => new Set());
  const [archiveError, setArchiveError] = useState<string | null>(null);

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

  async function handleArchiveQuiz(quiz: Quiz) {
    if (archivingQuizId) return;
    setArchivingQuizId(quiz.id);
    setArchiveError(null);
    try {
      const res = await fetch(`/api/quizzes/${quiz.id}/archive`, { method: 'POST' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Failed to archive reviewer');
      setArchivedQuizIds((current) => new Set(current).add(quiz.id));
      onQuizArchived?.(quiz.id);
    } catch (err) {
      console.error('Failed to archive reviewer:', err);
      setArchiveError(err instanceof Error ? err.message : 'Failed to archive reviewer');
    } finally {
      setArchivingQuizId(null);
    }
  }

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
  const [localSelectedTerm, setLocalSelectedTerm] = useState<string>('');
  const selectedTerm = selectedTermProp ?? localSelectedTerm;
  const normalizedSelectedTerm = selectedTerm.trim().toLowerCase();
  const availableQuizzes = quizzes.filter((quiz) => !archivedQuizIds.has(quiz.id));

  const termsInQuizzes = Array.from(
    new Map(
      availableQuizzes
        .map((q) => q.term?.trim())
        .filter((t): t is string => Boolean(t))
        .map((term) => [term.toLowerCase(), term] as const)
    ).values()
  );

  const handleTermChange = (term: string) => {
    if (selectedTermProp === undefined) {
      setLocalSelectedTerm(term);
    }
    onTermChange?.(term);
  };

  const filteredQuizzes = availableQuizzes.filter((quiz) => {
    if (!normalizedSelectedTerm) return true;
    return quiz.term?.trim().toLowerCase() === normalizedSelectedTerm;
  });

  const visibleQuizzes = maxItems ? filteredQuizzes.slice(0, maxItems) : filteredQuizzes;

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
          {filteredQuizzes.length} {filteredQuizzes.length === 1 ? 'reviewer' : 'reviewers'}
        </span>
      </div>

      {archiveError && (
        <div className="rounded-xl border-2 border-destructive/30 bg-destructive/10 px-3 py-2 text-xs font-bold text-destructive">
          {archiveError}
        </div>
      )}

      {termsInQuizzes.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
          <span className="text-[11px] font-black uppercase tracking-wider text-muted-foreground mr-1">
            Term:
          </span>
          <button
            type="button"
            onClick={() => handleTermChange('')}
            className={`rounded-lg border-2 border-slate-900 px-2.5 py-1 text-xs font-black shadow-brutal-sm transition-all cursor-pointer ${
              !normalizedSelectedTerm
                ? 'bg-primary text-white'
                : 'bg-white dark:bg-card text-foreground hover:bg-muted'
            }`}
          >
            All ({availableQuizzes.length})
          </button>
          {termsInQuizzes.map((t) => {
            const count = availableQuizzes.filter((q) => q.term?.trim().toLowerCase() === t.toLowerCase()).length;
            const isSelected = normalizedSelectedTerm === t.toLowerCase();
            return (
              <button
                key={t}
                type="button"
                onClick={() => handleTermChange(isSelected ? '' : t)}
                className={`rounded-lg border-2 border-slate-900 px-2.5 py-1 text-xs font-black shadow-brutal-sm transition-all cursor-pointer ${
                  isSelected
                    ? 'bg-primary text-white'
                    : 'bg-white dark:bg-card text-foreground hover:bg-muted'
                }`}
              >
                {t} ({count})
              </button>
            );
          })}
        </div>
      )}

      {selectedTerm && !termsInQuizzes.some(
        (term) => term.toLowerCase() === normalizedSelectedTerm
      ) && (
        <div className="mt-2 flex items-center justify-between">
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-primary/10 text-primary border border-primary/20">
            <span>Term:</span>
            <span className="font-black">{selectedTerm}</span>
          </span>
          <button
            type="button"
            onClick={() => handleTermChange('')}
            className="text-[10px] font-bold text-muted-foreground hover:text-destructive transition-colors cursor-pointer"
          >
            Clear term
          </button>
        </div>
      )}

      {loading ? (
        <div className="home-card-grid grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((index) => (
            <div key={index} className="h-36 sm:h-[148px] rounded-2xl border-2 border-slate-900/30 bg-muted/40 p-4 animate-pulse" />
          ))}
        </div>
      ) : availableQuizzes.length === 0 ? (
        <div className="flex min-h-48 flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-900/40 dark:border-white/30 p-8 text-center bg-white dark:bg-card">
          <BookOpen className="h-8 w-8 text-muted-foreground" />
          <p className="mt-2 text-sm font-black text-foreground">No reviewers found</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Create your first reviewer deck or import from a handout.
          </p>
        </div>
      ) : filteredQuizzes.length === 0 ? (
        <div className="flex min-h-40 flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-900/40 dark:border-white/30 p-8 text-center bg-white dark:bg-card">
          <BookOpen className="h-8 w-8 text-muted-foreground" />
          <p className="mt-2 text-sm font-black text-foreground">No reviewers found for "{selectedTerm}"</p>
          <button
            type="button"
            onClick={() => handleTermChange('')}
            className="mt-2 text-xs font-bold text-primary hover:underline cursor-pointer"
          >
            Show all reviewers
          </button>
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
                subjectId={subjectId}
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
                onArchive={() => {
                  setSwipedQuizId(null);
                  void handleArchiveQuiz(quiz);
                }}
              />
            );
          })}
        </div>
      )}

      {maxItems && filteredQuizzes.length > visibleQuizzes.length && onViewAll && (
        <button
          type="button"
          onClick={onViewAll}
          className="inline-flex items-center gap-1.5 text-xs font-black text-primary underline-offset-2 hover:underline"
        >
          View all {filteredQuizzes.length} reviewers
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
