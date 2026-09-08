'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Quiz, Subject } from '@quiz-creator/types';
import { Layers, Pencil, Play, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

const REVEAL_WIDTH = 144; // 72px per action button
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
}

export default function SwipeableQuizCard({
  quiz,
  subject,
  readOnly,
  isOpen,
  onOpen,
  onClose,
  onEdit,
  onDelete
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
      className="quiz-card-enter group relative min-h-36 sm:min-h-[148px] rounded-2xl border-2 border-slate-900 dark:border-white/40 bg-slate-900 shadow-brutal transition-all hover:-translate-y-1 hover:shadow-[6px_6px_0px_#0f172a] overflow-hidden"
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
        className="relative z-10 flex min-h-36 sm:min-h-[148px] h-full w-full flex-col justify-between bg-white dark:bg-card p-4 sm:p-4.5 select-none"
      >
        <Link
          href={`/review/${quiz.id}`}
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
                <span className="rounded-md border-2 border-slate-900 bg-[#bfdbfe] px-2 py-0.5 text-[10px] font-black text-slate-900 shadow-brutal-sm">
                  Sample Reviewer
                </span>
              ) : subjectName ? (
                <span
                  style={{
                    backgroundColor: `${subject?.color || '#3b82f6'}26`,
                    borderColor: '#0f172a',
                    color: subject?.color || '#3b82f6'
                  }}
                  className="max-w-[10rem] truncate rounded-md border-2 px-2 py-0.5 text-[10px] font-black shadow-brutal-sm"
                >
                  {subjectName}
                </span>
              ) : (
                <span className="rounded-md border-2 border-slate-900 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 text-[10px] font-black shadow-brutal-sm">
                  Reviewer
                </span>
              )}
              {quiz.term && (
                <span className="rounded-md border-2 border-primary/40 bg-primary/10 px-2 py-0.5 text-[10px] font-black text-primary shadow-brutal-sm truncate max-w-[8rem]">
                  {quiz.term}
                </span>
              )}
            </div>
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

        <div className="mt-3 flex items-center justify-between border-t-2 border-slate-900/20 dark:border-white/20 pt-3">
          {!readOnly ? (
            <div className="flex items-center gap-2">
              <Link
                href={`/quizzes/${quiz.id}`}
                onClick={(e) => {
                  if (isOpen || hasMovedRef.current) {
                    e.preventDefault();
                    e.stopPropagation();
                  }
                }}
                className="text-xs font-black text-slate-700 dark:text-slate-300 transition-colors hover:text-primary underline underline-offset-4 decoration-2"
              >
                Manage
              </Link>
              {/* Desktop delete shortcut button */}
              <button
                type="button"
                aria-label={`Delete ${quiz.title}`}
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete();
                }}
                className="hidden sm:inline-flex items-center justify-center rounded-lg p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors cursor-pointer"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                aria-label={`Edit ${quiz.title}`}
                onClick={(e) => {
                  e.stopPropagation();
                  onEdit();
                }}
                className="hidden sm:inline-flex items-center justify-center rounded-lg p-1 text-muted-foreground hover:bg-blue-600/10 hover:text-blue-600 transition-colors cursor-pointer"
              >
                <Pencil className="h-3.5 w-3.5" />
              </button>
            </div>
          ) : (
            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-muted-foreground">
              Read-only
            </span>
          )}

          <div className="flex items-center gap-1.5">
            {/* Mobile gesture hint */}
            {!readOnly && (
              <span className="sm:hidden text-[10px] font-bold text-muted-foreground/80 flex items-center gap-0.5 select-none pr-0.5">
                Swipe ‹
              </span>
            )}
            <Link
              href={`/review/${quiz.id}`}
              onClick={(e) => {
                if (isOpen || hasMovedRef.current) {
                  e.preventDefault();
                  e.stopPropagation();
                }
              }}
              className="flex items-center gap-1 rounded-xl border-2 border-slate-900 bg-primary px-3 py-1 text-xs font-black text-white shadow-brutal-sm transition-all hover:-translate-y-0.5 hover:shadow-brutal active:translate-x-0.5 active:translate-y-0.5 active:shadow-none"
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
