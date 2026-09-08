'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { BookOpen, Layers, Plus, Sparkles, GripVertical, GripHorizontal, FilePlus2, FileText } from 'lucide-react';
import Link from 'next/link';

interface FloatingBottomNavProps {
  onOpenAiModal?: () => void;
  onOpenSubjectModal?: () => void;
  onLibrarySectionSelect?: (section: 'subjects' | 'reviewers') => void;
  activeSection?: 'subjects' | 'reviewers';
}

export default function FloatingBottomNav({
  onOpenAiModal,
  onOpenSubjectModal,
  onLibrarySectionSelect,
  activeSection,
}: FloatingBottomNavProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'subjects' | 'reviewers'>('subjects');

  useEffect(() => {
    if (activeSection) {
      setActiveTab(activeSection);
    }
  }, [activeSection]);
  const [showQuickMenu, setShowQuickMenu] = useState(false);
  const [isTablet, setIsTablet] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [position, setPosition] = useState<{ x: number; y: number } | null>(null);
  const [isVertical, setIsVertical] = useState(false);

  const navRef = useRef<HTMLDivElement>(null);
  const dragStartRef = useRef<{ startX: number; startY: number; initX: number; initY: number }>({
    startX: 0,
    startY: 0,
    initX: 0,
    initY: 0,
  });

  // Show on the library and subject/quiz detail routes.
  const isLibraryRoute = pathname === '/library';
  const isVisibleRoute = isLibraryRoute
    || pathname === '/subjects'
    || pathname.startsWith('/subjects/')
    || pathname === '/quizzes'
    || pathname.startsWith('/quizzes/')
    || pathname === '/notes'
    || pathname === '/review'
    || pathname.startsWith('/review/');

  const isNotesActive = pathname === '/notes' || pathname.startsWith('/notes/');
  const isReviewerActive = !isNotesActive && (
    (isLibraryRoute && activeTab === 'reviewers') ||
    pathname === '/quizzes' ||
    pathname.startsWith('/quizzes/') ||
    pathname === '/review' ||
    pathname.startsWith('/review/')
  );
  const isSubjectsActive = !isNotesActive && !isReviewerActive && (
    (isLibraryRoute && activeTab === 'subjects') ||
    pathname === '/subjects' ||
    pathname.startsWith('/subjects/')
  );

  // Responsive device classification
  const updateDeviceMode = useCallback(() => {
    if (typeof window === 'undefined') return;
    const width = window.innerWidth;
    const tabletMatch = width >= 768 && width < 1024;
    setIsTablet(tabletMatch);

    if (!tabletMatch) {
      // Reset tablet drag states when entering mobile or desktop
      setPosition(null);
      setIsVertical(false);
      setIsDragging(false);
    } else {
      setPosition((prev) => {
        if (!prev) return null;
        const maxX = Math.max(16, window.innerWidth - 140);
        const maxY = Math.max(16, window.innerHeight - 80);
        return {
          x: Math.min(prev.x, maxX),
          y: Math.min(prev.y, maxY),
        };
      });
    }
  }, []);

  useEffect(() => {
    updateDeviceMode();
    window.addEventListener('resize', updateDeviceMode);
    return () => window.removeEventListener('resize', updateDeviceMode);
  }, [updateDeviceMode]);

  // Track active section via scroll position on the library route
  useEffect(() => {
    if (!isLibraryRoute) return;

    const handleScroll = () => {
      const reviewersEl = document.getElementById('reviewers-section');
      const subjectsEl = document.getElementById('subjects-section');

      if (reviewersEl && subjectsEl) {
        const reviewersRect = reviewersEl.getBoundingClientRect();
        // If reviewers section is near or in upper portion of viewport
        if (reviewersRect.top <= window.innerHeight * 0.45) {
          setActiveTab('reviewers');
        } else {
          setActiveTab('subjects');
        }
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();
    return () => window.removeEventListener('scroll', handleScroll);
  }, [isLibraryRoute]);

  // Initialize tablet position to bottom center once mounted
  useEffect(() => {
    if (isTablet && position === null && navRef.current) {
      const rect = navRef.current.getBoundingClientRect();
      const initialX = Math.max(16, (window.innerWidth - rect.width) / 2);
      const initialY = Math.max(16, window.innerHeight - rect.height - 28);
      setPosition({ x: initialX, y: initialY });
    }
  }, [isTablet, position]);

  // Pointer drag handlers for tablet mode
  const handlePointerDown = (e: React.PointerEvent) => {
    if (!isTablet || !navRef.current) return;
    // Don't drag if clicking interactive inner buttons
    const target = e.target as HTMLElement;
    if (target.closest('button') && !target.closest('[data-drag-handle="true"]')) {
      return;
    }

    e.preventDefault();
    const rect = navRef.current.getBoundingClientRect();
    const currentX = position?.x ?? rect.left;
    const currentY = position?.y ?? rect.top;

    dragStartRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      initX: currentX,
      initY: currentY,
    };
    setIsDragging(true);

    try {
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    } catch {
      // Ignore if pointer capture fails
    }
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDragging || !isTablet || !navRef.current) return;
    e.preventDefault();

    const deltaX = e.clientX - dragStartRef.current.startX;
    const deltaY = e.clientY - dragStartRef.current.startY;

    const navRect = navRef.current.getBoundingClientRect();
    const navWidth = navRect.width;
    const navHeight = navRect.height;

    // Viewport boundaries
    const minX = 16;
    const maxX = window.innerWidth - navWidth - 16;
    const minY = 16;
    const maxY = window.innerHeight - navHeight - 16;

    const rawX = dragStartRef.current.initX + deltaX;
    const rawY = dragStartRef.current.initY + deltaY;

    const clampedX = Math.min(Math.max(rawX, minX), maxX);
    const clampedY = Math.min(Math.max(rawY, minY), maxY);

    setPosition({ x: clampedX, y: clampedY });

    // Edge proximity detection: within 110px of left or right margin switches to vertical orientation
    const nearLeftEdge = clampedX <= 110;
    const nearRightEdge = clampedX >= window.innerWidth - navWidth - 110;

    if (nearLeftEdge || nearRightEdge) {
      if (!isVertical) setIsVertical(true);
    } else {
      if (isVertical) setIsVertical(false);
    }
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (!isDragging) return;
    setIsDragging(false);

    try {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {
      // Ignore
    }

    // Snap to edge neatly if released close to boundary
    if (navRef.current && position) {
      const navRect = navRef.current.getBoundingClientRect();
      const navWidth = navRect.width;
      const nearLeft = position.x <= 120;
      const nearRight = position.x >= window.innerWidth - navWidth - 120;

      if (nearRight) {
        setIsVertical(true);
        setPosition((prev) => (prev ? { ...prev, x: window.innerWidth - navWidth - 16 } : null));
      } else if (nearLeft) {
        setIsVertical(true);
        setPosition((prev) => (prev ? { ...prev, x: 16 } : null));
      }
    }
  };

  const scrollToSection = (id: string, tab: 'subjects' | 'reviewers') => {
    setActiveTab(tab);
    setShowQuickMenu(false);
    onLibrarySectionSelect?.(tab);

    if (!isLibraryRoute) {
      router.push(`/library#${id}`);
      return;
    }

    if (onLibrarySectionSelect) {
      return;
    }

    const scrollToTarget = () => {
      const element = document.getElementById(id);
      element?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    };

    if (document.getElementById(id)) {
      scrollToTarget();
    } else {
      window.setTimeout(scrollToTarget, 0);
    }
  };

  if (!isVisibleRoute) {
    return null;
  }

  // Tablet inline style for dragged position
  const tabletStyle: React.CSSProperties =
    isTablet && position
      ? {
          position: 'fixed',
          left: `${position.x}px`,
          top: `${position.y}px`,
          transform: 'none',
          touchAction: 'none',
          zIndex: showQuickMenu ? 50 : 30,
        }
      : {};

  return (
    <>
      {/* Backdrop for closing quick menu when clicking outside */}
      {showQuickMenu && (
        <div
          className="fixed inset-0 z-40 bg-black/20 backdrop-blur-[2px] lg:hidden animate-in fade-in duration-150"
          onClick={() => setShowQuickMenu(false)}
          aria-hidden="true"
        />
      )}

      {/* Detached Floating Navigation Bar */}
      <nav
        ref={navRef}
        aria-label="Floating navigation"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        style={tabletStyle}
        className={`fixed ${showQuickMenu ? 'z-50' : 'z-30'} select-none block lg:hidden ${
          !isTablet
            ? 'bottom-[max(1.25rem,env(safe-area-inset-bottom))] left-1/2 -translate-x-1/2'
            : isDragging
            ? 'cursor-grabbing transition-none'
            : 'cursor-grab transition-all duration-300 ease-out'
        }`}
      >
        <div
          className={`relative flex items-center gap-1.5 rounded-full border border-black/[0.08] bg-white/95 p-1.5 shadow-[0_12px_36px_rgba(0,0,0,0.14)] backdrop-blur-xl dark:border-white/[0.12] dark:bg-[#18181b]/95 dark:shadow-[0_16px_40px_rgba(0,0,0,0.6)] ${
            isVertical ? 'flex-col px-1.5 py-3' : 'flex-row px-2.5 py-1.5'
          }`}
        >
          {/* Tablet Drag Handle */}
          {isTablet && (
            <div
              data-drag-handle="true"
              title="Drag to reposition navigation"
              className={`flex items-center justify-center text-muted-foreground/60 transition-colors hover:text-foreground active:text-primary ${
                isVertical ? 'h-4 w-7 cursor-grab py-1' : 'h-7 w-4 cursor-grab px-1'
              }`}
            >
              {isVertical ? (
                <GripHorizontal className="h-3.5 w-3.5" />
              ) : (
                <GripVertical className="h-3.5 w-3.5" />
              )}
            </div>
          )}

          {/* Module 1: Subjects */}
          <button
            type="button"
            onClick={() => scrollToSection('subjects-section', 'subjects')}
            aria-label="Navigate to Subjects"
            className={`group relative flex items-center gap-1.5 rounded-full px-3 py-2 text-xs font-bold transition-all duration-200 active:scale-95 ${
              isSubjectsActive
                ? 'bg-zinc-900 text-white shadow-sm dark:bg-zinc-800 dark:text-zinc-100 dark:border dark:border-zinc-700/70'
                : 'text-zinc-600 hover:bg-zinc-100/80 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800/60 dark:hover:text-zinc-100'
            } ${isVertical ? 'w-full justify-center px-2 py-2.5' : ''}`}
          >
            <div
              className={`flex h-6 w-6 items-center justify-center rounded-md transition-colors ${
                isSubjectsActive
                  ? 'bg-transparent text-white'
                  : 'text-zinc-600 group-hover:text-zinc-900 dark:text-zinc-400 dark:group-hover:text-zinc-200'
              }`}
            >
              <BookOpen className="h-4 w-4" />
            </div>
            {!isVertical && <span>Subjects</span>}
          </button>

          {/* Center Ideal Module: Quick Create / AI Button (matches reference design) */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowQuickMenu((prev) => !prev)}
              aria-label="Create quiz or subject"
              aria-expanded={showQuickMenu}
              className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-white shadow-md shadow-primary/30 transition-all duration-200 hover:bg-primary/90 hover:scale-105 active:scale-95"
            >
              <Plus
                className={`h-5 w-5 transition-transform duration-200 ${
                  showQuickMenu ? 'rotate-45' : ''
                }`}
              />
            </button>

            {/* Quick Actions Popup Menu */}
            {showQuickMenu && (
              <div
                className={`absolute z-60 mb-3 min-w-[200px] rounded-2xl border border-border/80 bg-card p-2 shadow-2xl backdrop-blur-xl animate-in fade-in zoom-in-95 duration-150 ${
                  isVertical
                    ? 'bottom-0 left-full ml-3'
                    : 'bottom-full left-1/2 -translate-x-1/2'
                }`}
              >
                <div className="space-y-1">
                  <button
                    type="button"
                    onClick={() => {
                      setShowQuickMenu(false);
                      if (onOpenAiModal) onOpenAiModal();
                      else router.push('/library');
                    }}
                    className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-xs font-semibold text-foreground transition-colors hover:bg-primary/10 hover:text-primary active:scale-[0.98]"
                  >
                    <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/15 text-primary">
                      <Sparkles className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="font-bold">Generate with AI</p>
                      <p className="text-[10px] text-muted-foreground">From handouts or notes</p>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setShowQuickMenu(false);
                      if (onOpenSubjectModal) onOpenSubjectModal();
                      else router.push('/library');
                    }}
                    className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-xs font-semibold text-foreground transition-colors hover:bg-primary/10 hover:text-primary active:scale-[0.98]"
                  >
                    <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/15 text-primary">
                      <BookOpen className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="font-bold">New Subject</p>
                      <p className="text-[10px] text-muted-foreground">Organize your topics</p>
                    </div>
                  </button>

                  <Link
                    href="/notes"
                    onClick={() => setShowQuickMenu(false)}
                    className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-xs font-semibold text-foreground transition-colors hover:bg-primary/10 hover:text-primary active:scale-[0.98]"
                  >
                    <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/15 text-primary">
                      <FileText className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="font-bold">New Note</p>
                      <p className="text-[10px] text-muted-foreground">Capture formatted study notes</p>
                    </div>
                  </Link>

                  <Link
                    href="/new?mode=manual"
                    onClick={() => setShowQuickMenu(false)}
                    className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-xs font-semibold text-foreground transition-colors hover:bg-primary/10 hover:text-primary active:scale-[0.98]"
                  >
                    <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-muted text-foreground">
                      <FilePlus2 className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="font-bold">Create Manually</p>
                      <p className="text-[10px] text-muted-foreground">Write question decks</p>
                    </div>
                  </Link>
                </div>
              </div>
            )}
          </div>

          {/* Module 2: Reviewer */}
          <button
            type="button"
            onClick={() => scrollToSection('reviewers-section', 'reviewers')}
            aria-label="Navigate to Reviewer"
            className={`group relative flex items-center gap-1.5 rounded-full px-3 py-2 text-xs font-bold transition-all duration-200 active:scale-95 ${
              isReviewerActive
                ? 'bg-zinc-900 text-white shadow-sm dark:bg-zinc-800 dark:text-zinc-100 dark:border dark:border-zinc-700/70'
                : 'text-zinc-600 hover:bg-zinc-100/80 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800/60 dark:hover:text-zinc-100'
            } ${isVertical ? 'w-full justify-center px-2 py-2.5' : ''}`}
          >
            <div
              className={`flex h-6 w-6 items-center justify-center rounded-md transition-colors ${
                isReviewerActive
                  ? 'bg-transparent text-white'
                  : 'text-zinc-600 group-hover:text-zinc-900 dark:text-zinc-400 dark:group-hover:text-zinc-200'
              }`}
            >
              <Layers className="h-4 w-4" />
            </div>
            {!isVertical && <span>Reviewer</span>}
          </button>

          <Link
            href="/notes"
            aria-label="Open Notes"
            className={`group relative flex items-center gap-1.5 rounded-full px-3 py-2 text-xs font-bold transition-all duration-200 active:scale-95 ${
              isNotesActive
                ? 'bg-zinc-900 text-white shadow-sm dark:bg-zinc-800 dark:text-zinc-100 dark:border dark:border-zinc-700/70'
                : 'text-zinc-600 hover:bg-zinc-100/80 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800/60 dark:hover:text-zinc-100'
            } ${isVertical ? 'w-full justify-center px-2 py-2.5' : ''}`}
          >
            <div className="flex h-6 w-6 items-center justify-center rounded-md"><FileText className="h-4 w-4" /></div>
            {!isVertical && <span>Notes</span>}
          </Link>
        </div>
      </nav>
    </>
  );
}
