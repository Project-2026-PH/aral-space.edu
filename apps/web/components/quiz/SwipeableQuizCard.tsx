'use client';

import React, { useEffect, useRef, useState } from 'react';
import RichTooltip from '@/components/ui/RichTooltip';
import { Quiz, Subject } from '@quiz-creator/types';
import { Archive, Layers, Pencil, Play, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

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
}: SwipeableQuizCardProps) {
  const router = useRouter();
  const [offset, setOffset] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  const pointerStartRef = useRef<{ x: number; y: number } | null>(null);
  const startTimeRef = useRef<number>(0);
  const directionLockRef = useRef<'horizontal' | 'vertical' | null>(null);
  const initialOffsetRef = useRef<number>(0);
  const hasMovedRef = useRef(false);
  const cardRef = useRef<HTMLDivElement>(null);

  const subjectName = subject?.name;
  const reviewHref = subjectId
    ? `/review/${encodeURIComponent(quiz.slug || quiz.id)}?subjectId=${encodeURIComponent(subjectId)}`
    : `/review/${encodeURIComponent(quiz.slug || quiz.id)}`;

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

    // If card was open, tapping it simply closes the actions
    if (isOpen) {
      e.preventDefault();
      e.stopPropagation();
      onClose();
      return;
    }
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
        className="relative z-10 flex min-h-36 sm:min-h-[148px] h-full w-full flex-col justify-between bg-white dark:bg-card p-3.5 sm:p-4 select-none"
      >
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
      </article>
    </div>
  );
}
