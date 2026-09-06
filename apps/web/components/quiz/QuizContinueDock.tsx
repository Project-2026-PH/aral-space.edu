'use client';

import React from 'react';

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
}: QuizContinueDockProps): React.ReactElement {
  return (
    <div className="fixed bottom-[max(2.75rem,calc(env(safe-area-inset-bottom)+1.75rem))] inset-x-0 z-40 flex justify-center px-3 sm:bottom-12 pointer-events-none">
      <div
        role="button"
        tabIndex={0}
        aria-label={`${message}. Select to continue.`}
        className={`pointer-events-auto w-full max-w-xl flex items-center justify-between gap-3 rounded-2xl sm:rounded-3xl border border-primary/30 bg-card/95 p-3.5 sm:p-4 shadow-2xl backdrop-blur-xl cursor-pointer select-none ${className}`}
        onClick={(event) => {
          event.stopPropagation();
          onAdvance();
        }}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            event.stopPropagation();
            onAdvance();
          }
        }}
      >
        <div className="flex items-center gap-2.5 text-xs sm:text-sm font-bold text-foreground min-w-0">
          <span className="relative flex h-2.5 w-2.5 shrink-0">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75" />
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-primary" />
          </span>
          <span className="truncate">{message}</span>
        </div>
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            onAdvance();
          }}
          className="shrink-0 inline-flex items-center gap-1.5 rounded-xl sm:rounded-2xl bg-primary px-4 py-2 sm:px-5 sm:py-2.5 text-xs font-bold text-white shadow-lg shadow-primary/25 transition-all hover:bg-primary/90 active:scale-95"
        >
          <span>{buttonText}</span>
          <span aria-hidden="true">›</span>
        </button>
      </div>
    </div>
  );
}
