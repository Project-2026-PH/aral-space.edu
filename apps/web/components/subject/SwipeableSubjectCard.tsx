'use client';

import React, { useEffect, useRef, useState } from 'react';
import RichTooltip from '@/components/ui/RichTooltip';
import { Subject } from '@quiz-creator/types';
import { BookOpen, Eye, Link2, Lock, Pencil, Share2, Trash2, Archive } from 'lucide-react';
import { useRouter } from 'next/navigation';

const REVEAL_WIDTH = 216; // 72px per action button
const SWIPE_THRESHOLD = 50;

interface SwipeableSubjectCardProps {
  subject: Subject;
  quizCount: number;
  viewerId: string;
  readOnly: boolean;
  canManage: boolean;
  canArchive: boolean;
  canOpen: boolean;
  canGeneratePublicLink: boolean;
  isPublic: boolean;
  subjectHref: string;
  index: number;
  isOpen: boolean;
  onOpen: () => void;
  onClose: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onArchive: () => void;
  onShare: () => void;
}

export default function SwipeableSubjectCard({
  subject,
  quizCount,
  viewerId,
  readOnly,
  canManage,
  canArchive,
  canOpen,
  canGeneratePublicLink,
  isPublic,
  subjectHref,
  index,
  isOpen,
  onOpen,
  onClose,
  onEdit,
  onDelete,
  onArchive,
  onShare
}: SwipeableSubjectCardProps) {
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

  // Gesture handling (active on mobile only for manageable subjects)
  function handlePointerDown(e: React.PointerEvent) {
    if (!isMobile || !canManage) return;

    pointerStartRef.current = { x: e.clientX, y: e.clientY };
    startTimeRef.current = Date.now();
    directionLockRef.current = null;
    initialOffsetRef.current = isOpen ? -REVEAL_WIDTH : 0;
    hasMovedRef.current = false;
    setIsDragging(false);
  }

  function handlePointerMove(e: React.PointerEvent) {
    if (!pointerStartRef.current || !isMobile || !canManage) return;

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

      // Decide snap outcome
      if (initialOffsetRef.current === 0) {
        // Was closed: check if swiped far enough left or flicked left
        if (offset < -SWIPE_THRESHOLD || velocity < -0.35) {
          setOffset(-REVEAL_WIDTH);
          onOpen();
        } else {
          setOffset(0);
          onClose();
        }
      } else {
        // Was open: check if dragged right past threshold or flicked right
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

    // Normal card navigation
    if (readOnly || canManage || subject.share_token) {
      router.push(subjectHref);
    } else if (canGeneratePublicLink) {
      onShare();
    }
  }

  return (
    <div
      ref={cardRef}
      className="subject-card-container group relative min-h-36 sm:min-h-[148px] rounded-2xl border-2 border-slate-900 dark:border-white/40 bg-white dark:bg-card shadow-brutal transition-all duration-150 hover:translate-x-1 hover:translate-y-1 hover:shadow-none active:scale-[0.99] overflow-hidden"
    >
      {/* Mobile-only Underlay Action Layer */}
      {canManage && (
        <div
          aria-hidden={!isOpen}
          className="absolute inset-y-0 right-0 z-0 flex items-stretch sm:hidden"
        >
          {/* Edit Action Button */}
          <button
            type="button"
            aria-label={`Edit ${subject.name}`}
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
            aria-label={`Archive ${subject.name}`}
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
            aria-label={`Delete ${subject.name}`}
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
        role={canOpen ? 'link' : undefined}
        tabIndex={canOpen ? 0 : undefined}
        aria-label={`Subject ${subject.name}`}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onClick={handleCardClick}
        onKeyDown={(event) => {
          if (canOpen && (event.key === 'Enter' || event.key === ' ')) {
            event.preventDefault();
            if (isOpen) {
              onClose();
            } else if (readOnly || canManage || subject.share_token) {
              router.push(subjectHref);
            } else if (canGeneratePublicLink) {
              onShare();
            }
          }
        }}
        style={{
          transform: isMobile && canManage ? `translateX(${offset}px)` : 'none',
          transition: isDragging ? 'none' : 'transform 260ms cubic-bezier(0.2, 0.9, 0.3, 1)',
          touchAction: canManage && isMobile ? 'pan-y' : 'auto'
        }}
        className={`relative z-10 flex min-h-36 sm:min-h-[148px] h-full w-full flex-col justify-between bg-white dark:bg-card p-3.5 sm:p-4 focus:outline-none focus:ring-2 focus:ring-primary/40 select-none ${
          canOpen ? 'cursor-pointer' : ''
        }`}
      >
        <div>
          <div className="flex items-start justify-between gap-2">
            <div className="flex flex-1 min-w-0 items-center gap-2">
              <span
                aria-hidden="true"
                style={{ backgroundColor: subject.color }}
                className="h-8 w-8 sm:h-9 sm:w-9 shrink-0 rounded-xl border-2 border-slate-900 shadow-brutal-sm transition-transform duration-200 group-hover:scale-105"
              />
              <div className="min-w-0 flex-1">
                <h3 className="line-clamp-1 text-sm font-black text-foreground transition-colors group-hover:text-primary">
                  {subject.name}
                </h3>
                <p className="mt-0.5 flex items-center gap-1 text-[11px] font-bold text-muted-foreground">
                  <BookOpen className="h-3 w-3 shrink-0" />
                  <span className="truncate">{quizCount} {quizCount === 1 ? 'study set' : 'study sets'}</span>
                  {!readOnly && canManage && (
                    <span className="ml-1 inline-flex items-center gap-0.5 shrink-0" title="Unique viewers">
                      <Eye aria-hidden="true" className="h-3 w-3" />
                      {subject.viewer_count ?? 0}
                    </span>
                  )}
                </p>
              </div>
            </div>
            <span
              className={`inline-flex shrink-0 items-center gap-1 rounded-md border-2 border-slate-900 px-1.5 py-0.5 text-[10px] font-black shadow-brutal-sm transition-transform duration-200 group-hover:scale-105 ${
                isPublic
                  ? 'bg-[#bfdbfe] text-slate-900'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
              }`}
            >
              {isPublic ? <Link2 className="h-3 w-3 stroke-[2.5]" /> : <Lock className="h-3 w-3 stroke-[2.5]" />}
              <span>{isPublic ? 'Link Active' : 'Private'}</span>
            </span>
          </div>

          {canOpen && (
            <p className="mt-2 text-[11px] font-black text-primary opacity-0 transition-opacity group-hover:opacity-100 group-focus:opacity-100">
              {canManage ? 'Click to manage subject' : canGeneratePublicLink ? 'Click to get a share link' : 'Click to view shared study sets'}
            </p>
          )}
        </div>

        <div className="mt-3 flex items-center justify-start gap-1.5 border-t-2 border-slate-900/20 dark:border-white/20 pt-2.5">
          {canManage ? (
            <div className="flex items-center gap-1.5">
              {/* Desktop-only action buttons (Edit + Delete + Share) */}
              <div className="hidden sm:flex items-center gap-1 shrink-0">
                <RichTooltip
                  id={`subject-edit-tooltip-${subject.id}`}
                  title="Edit subject"
                  description="Change the subject name and color."
                >
                  <button
                    type="button"
                    aria-label={`Edit ${subject.name}`}
                    onClick={(event) => {
                      event.stopPropagation();
                      onEdit();
                    }}
                    className="inline-flex items-center justify-center rounded-xl border-2 border-slate-900 bg-white dark:bg-slate-800 p-1.5 text-slate-700 dark:text-slate-300 shadow-brutal-sm hover:bg-blue-500 hover:text-white hover:border-slate-900 transition-all duration-150 hover:translate-x-0.5 hover:translate-y-0.5 hover:shadow-none active:scale-95 cursor-pointer shrink-0"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                </RichTooltip>
                <RichTooltip
                  id={`subject-archive-tooltip-${subject.id}`}
                  title="Archive subject"
                  description="Hide it from your active library."
                >
                  <button
                    type="button"
                    aria-label={`Archive ${subject.name}`}
                    onClick={(event) => {
                      event.stopPropagation();
                      onArchive();
                    }}
                    className="inline-flex items-center justify-center rounded-xl border-2 border-slate-900 bg-white dark:bg-slate-800 p-1.5 text-slate-700 dark:text-slate-300 shadow-brutal-sm hover:bg-amber-500 hover:text-slate-900 hover:border-slate-900 transition-all duration-150 hover:translate-x-0.5 hover:translate-y-0.5 hover:shadow-none active:scale-95 cursor-pointer shrink-0"
                  >
                    <Archive className="h-3.5 w-3.5" />
                  </button>
                </RichTooltip>
                <RichTooltip
                  id={`subject-delete-tooltip-${subject.id}`}
                  title="Delete subject"
                  description="Permanently remove this subject and its sets."
                >
                  <button
                    type="button"
                    aria-label={`Delete ${subject.name}`}
                    onClick={(event) => {
                      event.stopPropagation();
                      onDelete();
                    }}
                    className="inline-flex items-center justify-center rounded-xl border-2 border-slate-900 bg-white dark:bg-slate-800 p-1.5 text-slate-700 dark:text-slate-300 shadow-brutal-sm hover:bg-destructive hover:text-white hover:border-slate-900 transition-all duration-150 hover:translate-x-0.5 hover:translate-y-0.5 hover:shadow-none active:scale-95 cursor-pointer shrink-0"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </RichTooltip>
              </div>

              {/* Mobile gesture hint */}
              <span className="sm:hidden text-[10px] font-bold text-muted-foreground/80 flex items-center gap-0.5 select-none pr-0.5">
                Swipe ‹
              </span>

              {/* Share button (always visible) */}
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  onShare();
                }}
                className="inline-flex items-center gap-1 rounded-xl border-2 border-slate-900 bg-primary hover:bg-[#1d4ed8] px-2.5 py-1 text-xs font-black text-white shadow-brutal-sm transition-all duration-150 hover:translate-x-0.5 hover:translate-y-0.5 hover:shadow-none active:scale-95 cursor-pointer shrink-0"
              >
                <Share2 className="h-3.5 w-3.5" />
                Share
              </button>
            </div>
          ) : canArchive ? (
            <button
              type="button"
              aria-label={`Archive ${subject.name}`}
              onClick={(event) => {
                event.stopPropagation();
                onArchive();
              }}
              className="inline-flex items-center gap-1.5 rounded-xl border-2 border-slate-900 bg-white dark:bg-slate-800 px-3 py-1.5 text-xs font-black text-slate-700 dark:text-slate-300 shadow-brutal-sm transition-all duration-150 hover:translate-x-0.5 hover:translate-y-0.5 hover:shadow-none hover:bg-amber-500 hover:text-slate-900 active:scale-95 cursor-pointer shrink-0"
            >
              <Archive className="h-3.5 w-3.5" />
              Archive
            </button>
          ) : (
            <span className="text-[11px] font-bold text-muted-foreground shrink-0">Read-only</span>
          )}
        </div>
      </article>
    </div>
  );
}
