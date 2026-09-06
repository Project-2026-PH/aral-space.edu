'use client';

import React from 'react';
import { createPortal } from 'react-dom';

export interface QuizContinueDockProps {
  onAdvance: () => void;
  message?: string;
  buttonText?: string;
  className?: string;
}

export default function QuizContinueDock({
  onAdvance,
  message = 'Press anywhere to continue',
  buttonText = 'Continue',
  className = ''
}: QuizContinueDockProps): React.ReactElement | null {
  const [isMounted, setIsMounted] = React.useState(false);

  React.useEffect(() => {
    setIsMounted(true);
  }, []);

  const dock = (
    <div
      className="fixed inset-x-0 bottom-0 z-[60] flex w-full max-w-sm justify-center px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pointer-events-none sm:inset-x-auto sm:bottom-12 sm:left-1/2 sm:w-[calc(100vw-1.5rem)] sm:max-w-xl sm:-translate-x-1/2 sm:px-0 sm:pb-0"
    >
      <button
        type="button"
        aria-label={`${message}. Select to continue.`}
        className={`group pointer-events-auto min-w-0 w-full flex items-center justify-between gap-3 rounded-2xl sm:rounded-3xl border border-primary/30 bg-card/95 p-3.5 sm:p-4 text-left shadow-2xl backdrop-blur-xl cursor-pointer select-none ${className}`}
        onClick={(event) => {
          event.stopPropagation();
          onAdvance();
        }}
      >
        <span className="flex min-w-0 flex-1 items-center gap-2.5 text-xs sm:text-sm font-bold text-foreground">
          <span className="relative flex h-2.5 w-2.5 shrink-0">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75" />
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-primary" />
          </span>
          <span className="truncate">{message}</span>
        </span>
        <span className="shrink-0 inline-flex items-center gap-1.5 rounded-xl sm:rounded-2xl bg-primary px-4 py-2 sm:px-5 sm:py-2.5 text-xs font-bold text-white shadow-lg shadow-primary/25 transition-all group-hover:bg-primary/90 group-active:scale-95">
          <span>{buttonText}</span>
          <span aria-hidden="true">›</span>
        </span>
      </button>
    </div>
  );

  return isMounted ? createPortal(dock, document.body) : null;
}
