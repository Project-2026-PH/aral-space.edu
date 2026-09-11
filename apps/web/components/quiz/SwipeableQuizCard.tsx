'use client';

import React, { useEffect, useRef, useState } from 'react';
import RichTooltip from '@/components/ui/RichTooltip';
import { Quiz, Subject } from '@quiz-creator/types';
import { Archive, BarChart3, Check, Layers, MoreHorizontal, Pencil, Play, Trash2, X } from 'lucide-react';
import {
  createEmptyQuizPerformanceSnapshot,
  getQuizPerformanceSnapshot,
  subscribeToQuizPerformance,
  type QuizPerformanceMode,
  type QuizPerformanceSnapshot
} from '@/lib/quizPerformance';
import Link from 'next/link';

const REVEAL_WIDTH = 216; // 72px per action button
const SWIPE_THRESHOLD = 50;

interface SwipeableQuizCardProps {
  quiz: Quiz;
  subject?: Subject;
  readOnly: boolean;
  isOpen: boolean;
  onOpen: () => void;
  onClose: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onArchive: () => void;
  subjectId?: string;
  subjectSlug?: string;
  subjectShareToken?: string;
}

export default function SwipeableQuizCard({
  quiz,
  subject,
  readOnly,
  isOpen,
  onOpen,
  onClose,
  onEdit,
  onDelete,
  onArchive,
  subjectId,
  subjectSlug,
  subjectShareToken,
}: SwipeableQuizCardProps) {
  const [offset, setOffset] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [isFlipped, setIsFlipped] = useState(false);
  const [selectedMode, setSelectedMode] = useState<QuizPerformanceMode>('flashcard');
  const [isModeMenuOpen, setIsModeMenuOpen] = useState(false);
  const [performance, setPerformance] = useState<QuizPerformanceSnapshot>(() =>
    createEmptyQuizPerformanceSnapshot('flashcard', quiz.question_count)
  );

  const pointerStartRef = useRef<{ x: number; y: number } | null>(null);
  const startTimeRef = useRef<number>(0);
  const directionLockRef = useRef<'horizontal' | 'vertical' | null>(null);
  const initialOffsetRef = useRef<number>(0);
  const hasMovedRef = useRef(false);
  const cardRef = useRef<HTMLDivElement>(null);

  const subjectName = subject?.name;
  const subjectLocator = subjectSlug || subject?.slug || subjectId;
  const reviewQuery = [
    subjectShareToken && quiz.share_token
      ? `shareToken=${encodeURIComponent(quiz.share_token)}`
      : null,
    subjectShareToken
      ? `subjectShareToken=${encodeURIComponent(subjectShareToken)}`
      : subjectLocator
        ? `subjectSlug=${encodeURIComponent(subjectLocator)}`
        : null,
  ].filter((part): part is string => Boolean(part));
  const reviewHref = `/review/${encodeURIComponent(quiz.slug || quiz.id)}${reviewQuery.length ? `?${reviewQuery.join('&')}` : ''}`;

  // Synchronize external isOpen state
  useEffect(() => {
    if (isOpen) {
      setOffset(-REVEAL_WIDTH);
    } else {
      setOffset(0);
    }
  }, [isOpen]);

  // Detect mobile viewport (< 640px)
  useEffect(() => {
    function checkViewport() {
      setIsMobile(window.innerWidth < 640);
    }
    checkViewport();
    window.addEventListener('resize', checkViewport, { passive: true });
    return () => window.removeEventListener('resize', checkViewport);
  }, []);

  useEffect(() => {
    const refreshPerformance = () => {
      setPerformance(getQuizPerformanceSnapshot(quiz.id, selectedMode, quiz.question_count));
    };
    refreshPerformance();
    return subscribeToQuizPerformance(quiz.id, refreshPerformance);
  }, [quiz.id, quiz.question_count, selectedMode]);

  // Gesture handling (active on mobile only for editable reviewers)
  function handlePointerDown(e: React.PointerEvent) {
    if (!isMobile || readOnly) return;

    pointerStartRef.current = { x: e.clientX, y: e.clientY };
    startTimeRef.current = Date.now();
    directionLockRef.current = null;
    initialOffsetRef.current = isOpen ? -REVEAL_WIDTH : 0;
    hasMovedRef.current = false;
    setIsDragging(false);
  }

  function handlePointerMove(e: React.PointerEvent) {
    if (!pointerStartRef.current || !isMobile || readOnly) return;

    const dx = e.clientX - pointerStartRef.current.x;
    const dy = e.clientY - pointerStartRef.current.y;

    if (directionLockRef.current === null) {
      if (Math.abs(dy) > 7 && Math.abs(dy) >= Math.abs(dx)) {
        // User scrolling vertically - ignore horizontal swipe
        directionLockRef.current = 'vertical';
        return;
      }
      if (Math.abs(dx) > 7 && Math.abs(dx) > Math.abs(dy)) {
        directionLockRef.current = 'horizontal';
        hasMovedRef.current = true;
        setIsDragging(true);
        try {
          (e.target as HTMLElement).setPointerCapture(e.pointerId);
        } catch {
          // Ignore if pointer capture fails
        }
      }
    }

    if (directionLockRef.current === 'horizontal') {
      let target = initialOffsetRef.current + dx;

      // Prevent swiping right past closed edge
      if (target > 0) {
        target = 0;
      }

      // Add resistance when dragging beyond reveal limit
      if (target < -REVEAL_WIDTH) {
        const excess = target - -REVEAL_WIDTH;
        target = -REVEAL_WIDTH + excess * 0.25;
      }

      setOffset(target);
    }
  }

  function handlePointerUp(e: React.PointerEvent) {
    if (!pointerStartRef.current) return;

    try {
      if ((e.target as HTMLElement).hasPointerCapture?.(e.pointerId)) {
        (e.target as HTMLElement).releasePointerCapture(e.pointerId);
      }
    } catch {
      // Ignore
    }

    if (directionLockRef.current === 'horizontal') {
      const dx = e.clientX - pointerStartRef.current.x;
      const duration = Math.max(1, Date.now() - startTimeRef.current);
      const velocity = dx / duration;

      if (initialOffsetRef.current === 0) {
        // Was closed: snap open if swiped left past threshold or flicked left
        if (offset < -SWIPE_THRESHOLD || velocity < -0.35) {
          setOffset(-REVEAL_WIDTH);
          onOpen();
        } else {
          setOffset(0);
          onClose();
        }
      } else {
        // Was open: snap closed if dragged right past threshold or flicked right
        if (dx > SWIPE_THRESHOLD || velocity > 0.35) {
          setOffset(0);
          onClose();
        } else {
          setOffset(-REVEAL_WIDTH);
          onOpen();
        }
      }
    }

    pointerStartRef.current = null;
    directionLockRef.current = null;
    setIsDragging(false);
  }

  function handleCardClick(e: React.MouseEvent) {
    // If a horizontal drag gesture just occurred, cancel click
    if (hasMovedRef.current) {
      e.preventDefault();
      e.stopPropagation();
      hasMovedRef.current = false;
      return;
    }

    // Interactive controls own their click behavior and must not flip the card.
    if ((e.target as HTMLElement).closest('a, button, select')) return;

    // If card was open, tapping it simply closes the actions
    if (isOpen) {
      e.preventDefault();
      e.stopPropagation();
      onClose();
      return;
    }

    setIsFlipped((flipped) => !flipped);
    setIsModeMenuOpen(false);
  }

  function showProgress(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    setIsFlipped(true);
  }

  return (
    <div
      ref={cardRef}
      className="quiz-card-enter group relative min-h-36 sm:min-h-[148px] rounded-2xl border-2 border-slate-900 dark:border-white/40 bg-white dark:bg-card shadow-brutal transition-all duration-150 hover:translate-x-1 hover:translate-y-1 hover:shadow-none active:scale-[0.99] overflow-hidden"
    >
      {/* Mobile-only Underlay Action Layer */}
      {!readOnly && (
        <div
          aria-hidden={!isOpen}
          className="absolute inset-y-0 right-0 z-0 flex items-stretch sm:hidden"
        >
          {/* Edit Action Button */}
          <button
            type="button"
            aria-label={`Edit ${quiz.title}`}
            tabIndex={isOpen ? 0 : -1}
            onClick={(e) => {
              e.stopPropagation();
              onClose();
              onEdit();
            }}
            className="flex w-[72px] flex-col items-center justify-center gap-1 border-l-2 border-slate-900 bg-blue-600 active:bg-blue-700 text-white font-black transition-all cursor-pointer select-none"
          >
            <Pencil className="h-5 w-5 stroke-[2.5]" />
            <span className="text-[11px] font-black uppercase tracking-wider">Edit</span>
          </button>

          {/* Archive Action Button */}
          <button
            type="button"
            aria-label={`Archive ${quiz.title}`}
            tabIndex={isOpen ? 0 : -1}
            onClick={(e) => {
              e.stopPropagation();
              onClose();
              onArchive();
            }}
            className="flex w-[72px] flex-col items-center justify-center gap-1 border-l-2 border-slate-900 bg-amber-500 active:bg-amber-600 text-slate-900 font-black transition-all cursor-pointer select-none"
          >
            <Archive className="h-5 w-5 stroke-[2.5]" />
            <span className="text-[11px] font-black uppercase tracking-wider">Archive</span>
          </button>

          {/* Delete Action Button */}
          <button
            type="button"
            aria-label={`Delete ${quiz.title}`}
            tabIndex={isOpen ? 0 : -1}
            onClick={(e) => {
              e.stopPropagation();
              onClose();
              onDelete();
            }}
            className="flex w-[72px] flex-col items-center justify-center gap-1 border-l-2 border-slate-900 bg-rose-600 active:bg-rose-700 text-white font-black transition-all cursor-pointer select-none"
          >
            <Trash2 className="h-5 w-5 stroke-[2.5]" />
            <span className="text-[11px] font-black uppercase tracking-wider">Delete</span>
          </button>
        </div>
      )}

      {/* Foreground Card Surface */}
      <article
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onClick={handleCardClick}
        style={{
          transform: isMobile && !readOnly ? `translateX(${offset}px)` : 'none',
          transition: isDragging ? 'none' : 'transform 260ms cubic-bezier(0.2, 0.9, 0.3, 1)',
          touchAction: !readOnly && isMobile ? 'pan-y' : 'auto'
        }}
        className="relative z-10 min-h-36 sm:min-h-[148px] h-full w-full [perspective:1200px] select-none"
      >
        <div
          className={`relative min-h-36 sm:min-h-[148px] h-full w-full transition-transform duration-500 [transform-style:preserve-3d] ${
            isFlipped ? '[transform:rotateY(-180deg)]' : ''
          }`}
        >
          <div className="relative flex min-h-36 sm:min-h-[148px] h-full w-full flex-col justify-between bg-white dark:bg-card p-3.5 sm:p-4 [backface-visibility:hidden]">
        <Link
          href={reviewHref}
          aria-label={`Review ${quiz.title}`}
          onClick={(e) => {
            if (isOpen || hasMovedRef.current) {
              e.preventDefault();
              e.stopPropagation();
            }
          }}
          className="block space-y-2 rounded-xl focus:outline-none"
        >
          <div className="flex items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-1.5 min-w-0 flex-wrap">
              {quiz.id === 'b0000000-0000-4000-8000-000000000001' || quiz.share_token === 'kasaysayan-pilipinas-reviewer' ? (
                <span className="rounded-md border-2 border-slate-900 bg-[#bfdbfe] px-2 py-0.5 text-[10px] font-black text-slate-900 shadow-brutal-sm transition-transform duration-200 group-hover:scale-105">
                  Sample Reviewer
                </span>
              ) : subjectName ? (
                <span
                  style={{
                    backgroundColor: `${subject?.color || '#3b82f6'}26`,
                    borderColor: '#0f172a',
                    color: subject?.color || '#3b82f6'
                  }}
                  className="max-w-[10rem] truncate rounded-md border-2 px-2 py-0.5 text-[10px] font-black shadow-brutal-sm transition-transform duration-200 group-hover:scale-105"
                >
                  {subjectName}
                </span>
              ) : (
                <span className="rounded-md border-2 border-slate-900 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 text-[10px] font-black shadow-brutal-sm transition-transform duration-200 group-hover:scale-105">
                  Reviewer
                </span>
              )}
              {quiz.term && (
                <span className="rounded-md border-2 border-primary/40 bg-primary/10 px-2 py-0.5 text-[10px] font-black text-primary shadow-brutal-sm truncate max-w-[8rem] transition-transform duration-200 group-hover:scale-105">
                  {quiz.term}
                </span>
              )}
            </div>
            <span className="shrink-0 rounded-md border-2 border-slate-900 bg-white dark:bg-slate-800 px-2 py-0.5 text-[10px] font-black text-slate-900 dark:text-white shadow-brutal-sm transition-transform duration-200 group-hover:scale-105">
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

        <button
          type="button"
          onClick={showProgress}
          aria-label={`View progress for ${quiz.title}`}
          className="mt-2 inline-flex w-fit items-center gap-1 rounded-lg border border-primary/25 bg-primary/5 px-2 py-1 text-[10px] font-black text-primary transition-colors hover:bg-primary/10"
        >
          <BarChart3 className="h-3 w-3" />
          View progress
        </button>

        <div className="mt-3 flex items-center justify-between gap-1.5 border-t-2 border-slate-900/20 dark:border-white/20 pt-2.5">
          {!readOnly ? (
            <Link
              href={`/quizzes/${encodeURIComponent(quiz.slug || quiz.id)}`}
              onClick={(e) => {
                if (isOpen || hasMovedRef.current) {
                  e.preventDefault();
                  e.stopPropagation();
                }
              }}
              className="text-xs font-black text-slate-700 dark:text-slate-300 transition-colors hover:text-primary underline underline-offset-4 decoration-2 shrink-0"
            >
              Manage
            </Link>
          ) : (
            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-muted-foreground shrink-0">
              Read-only
            </span>
          )}

          <div className="flex items-center gap-1 shrink-0">
            {!readOnly && (
              <>
                {/* Desktop archive, delete, edit shortcut buttons */}
                <div className="hidden sm:flex items-center gap-0.5 shrink-0">
                  <RichTooltip
                    id={`quiz-archive-tooltip-${quiz.id}`}
                    title="Archive set"
                    description="Hide this study set from your active library."
                  >
                    <button
                      type="button"
                      aria-label={`Archive ${quiz.title}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        onArchive();
                      }}
                      className="inline-flex items-center justify-center rounded-lg p-1 text-muted-foreground hover:bg-amber-500/15 hover:text-amber-700 dark:hover:text-amber-400 transition-colors cursor-pointer shrink-0"
                    >
                      <Archive className="h-3.5 w-3.5" />
                    </button>
                  </RichTooltip>
                  <RichTooltip
                    id={`quiz-delete-tooltip-${quiz.id}`}
                    title="Delete set"
                    description="Permanently remove this study set and its questions."
                  >
                    <button
                      type="button"
                      aria-label={`Delete ${quiz.title}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        onDelete();
                      }}
                      className="inline-flex items-center justify-center rounded-lg p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors cursor-pointer shrink-0"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </RichTooltip>
                  <RichTooltip
                    id={`quiz-edit-tooltip-${quiz.id}`}
                    title="Edit set"
                    description="Update the title, details, and questions."
                  >
                    <button
                      type="button"
                      aria-label={`Edit ${quiz.title}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        onEdit();
                      }}
                      className="inline-flex items-center justify-center rounded-lg p-1 text-muted-foreground hover:bg-blue-600/10 hover:text-blue-600 transition-colors cursor-pointer shrink-0"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                  </RichTooltip>
                </div>

                {/* Mobile gesture hint */}
                <span className="sm:hidden text-[10px] font-bold text-muted-foreground/80 flex items-center gap-0.5 select-none pr-0.5">
                  Swipe ‹
                </span>
              </>
            )}

            <Link
              href={reviewHref}
              onClick={(e) => {
                if (isOpen || hasMovedRef.current) {
                  e.preventDefault();
                  e.stopPropagation();
                }
              }}
              className="flex items-center gap-1 rounded-xl border-2 border-slate-900 bg-primary hover:bg-[#1d4ed8] px-2.5 py-1 text-xs font-black text-white shadow-brutal-sm transition-all duration-150 hover:translate-x-0.5 hover:translate-y-0.5 hover:shadow-none active:scale-95 cursor-pointer shrink-0"
            >
              <Play className="h-3 w-3 fill-current" />
              <span>Practice</span>
            </Link>
          </div>
        </div>
        </div>
          {/* Back of the set */}
          <div
            className="absolute inset-0 flex min-h-36 sm:min-h-[148px] h-full w-full flex-col justify-between overflow-hidden bg-white dark:bg-card p-3.5 sm:p-4 [backface-visibility:hidden] [transform:rotateY(-180deg)]"
          >
            <div className="relative flex items-start justify-between gap-2">
              <div className="relative">
                <button
                  type="button"
                  aria-label="Choose performance mode"
                  aria-expanded={isModeMenuOpen}
                  onClick={(event) => {
                    event.stopPropagation();
                    setIsModeMenuOpen((open) => !open);
                  }}
                  className="inline-flex items-center gap-1 rounded-lg border-2 border-slate-900 bg-white px-1.5 py-1 text-[10px] font-black text-slate-900 shadow-brutal-sm transition-all hover:translate-x-0.5 hover:translate-y-0.5 hover:shadow-none dark:bg-slate-800 dark:text-white"
                >
                  <MoreHorizontal className="h-3.5 w-3.5" />
                  {/* <span>{selectedMode === 'multiple_choice' ? 'Multiple choice' : selectedMode === 'identification' ? 'Identification' : 'Flashcards'}</span> */}
                </button>
                {isModeMenuOpen && (
                  <div className="absolute left-0 top-9 z-20 min-w-36 rounded-xl border-2 border-slate-900 bg-white p-1.5 shadow-brutal-sm dark:bg-slate-800">
                    {([
                      ['flashcard', 'Flashcards'],
                      ['identification', 'Identification'],
                      ['multiple_choice', 'Multiple choice']
                    ] as const).map(([mode, label]) => (
                      <button
                        key={mode}
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          setSelectedMode(mode);
                          setIsModeMenuOpen(false);
                        }}
                        className={`flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-left text-[10px] font-black transition-colors ${selectedMode === mode ? 'bg-primary/10 text-primary' : 'text-foreground hover:bg-muted'}`}
                      >
                        <span>{label}</span>
                        {selectedMode === mode && <Check className="h-3 w-3" />}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <button
                type="button"
                aria-label="Flip card back"
                onClick={(event) => {
                  event.stopPropagation();
                  setIsFlipped(false);
                  setIsModeMenuOpen(false);
                }}
                className="rounded-lg p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            
            <div className="flex min-h-0 items-center gap-3 py-1">
              {performance.hasData ? (
                <>
                  <div className="relative h-16 w-16 shrink-0" aria-label={`${performance.progressPercent}% progress`}>
                    <svg className="h-full w-full -rotate-90" viewBox="0 0 76 76" role="img" aria-hidden="true">
                      <circle cx="38" cy="38" r="32" fill="none" stroke="currentColor" strokeWidth="7" className="text-slate-200 dark:text-slate-700" />
                      <circle
                        cx="38"
                        cy="38"
                        r="32"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="7"
                        strokeLinecap="round"
                        className="text-primary transition-[stroke-dashoffset] duration-500"
                        strokeDasharray={`${2 * Math.PI * 32}`}
                        strokeDashoffset={`${2 * Math.PI * 32 * (1 - performance.progressPercent / 100)}`}
                      />
                    </svg>
                    <span className="absolute inset-0 flex items-center justify-center text-sm font-black text-foreground">
                      {performance.progressPercent}%
                    </span>
                  </div>
                  <div className="min-w-0 space-y-0.5">
                    <p className="truncate text-sm font-black text-foreground">{quiz.title}</p>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Progress</p>
                    <p className="text-xs font-bold text-foreground">{performance.answeredCount}/{quiz.question_count} answered</p>
                    <p className="text-[10px] font-semibold text-muted-foreground">
                      Avg. score: <span className="font-black text-primary">{performance.averageScore}%</span>
                    </p>
                  </div>
                </>
              ) : (
                <div className="w-full rounded-xl border border-dashed border-slate-900/25 bg-muted/30 px-3 py-4 text-center dark:border-white/20">
                  <p className="text-xs font-black text-foreground">No data available for this mode.</p>
                  <p className="mt-1 text-[10px] font-semibold text-muted-foreground">Complete a question in {selectedMode === 'multiple_choice' ? 'Multiple choice' : selectedMode === 'identification' ? 'Identification' : 'Flashcards'} mode to begin tracking.</p>
                </div>
              )}
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-[10px] font-bold text-muted-foreground">
                <span>Question results</span>
                {performance.hasData && <span>{performance.correctCount} correct</span>}
              </div>
              <div className="flex h-9 w-full items-end gap-0.5 overflow-hidden" aria-label="Question results: green correct, red incorrect, gray unanswered">
                {performance.questionStatuses.map((status, index) => (
                  <span
                    key={`${quiz.id}-${selectedMode}-${index}`}
                    title={`Question ${index + 1}: ${status}`}
                    className={`h-full min-w-0 flex-1 rounded-t-[2px] transition-colors ${status === 'correct' ? 'bg-emerald-500' : status === 'incorrect' ? 'bg-rose-500' : 'bg-slate-300 dark:bg-slate-600'}`}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
      </article>
    </div>
  );
}
