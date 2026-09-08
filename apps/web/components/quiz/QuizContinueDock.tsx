'use client';

import React from 'react';
import { createPortal } from 'react-dom';
import { LoaderCircle, Sparkles } from 'lucide-react';

export interface QuizContinueDockProps {
  onAdvance: () => void;
  message?: string;
  buttonText?: string;
  className?: string;
  showAiExplain?: boolean;
  isAiExplaining?: boolean;
  onExplainWithAi?: () => void;
  hasAiExplanation?: boolean;
}

export default function QuizContinueDock({
  onAdvance,
  message = 'Press anywhere to continue',
  buttonText = 'Continue',
  className = '',
  showAiExplain = false,
  isAiExplaining = false,
  onExplainWithAi,
  hasAiExplanation = false,
}: QuizContinueDockProps): React.ReactElement | null {
  const [isMounted, setIsMounted] = React.useState(false);

  React.useEffect(() => {
    setIsMounted(true);
  }, []);

  const dock = (
    <div
      className="fixed bottom-0 left-1/2 z-[60] flex w-[calc(100vw-1.5rem)] max-w-sm -translate-x-1/2 justify-center px-0 pb-[max(0.75rem,env(safe-area-inset-bottom))] pointer-events-none sm:bottom-12 sm:max-w-xl sm:pb-0"
    >
      <div
        className={`group pointer-events-auto min-w-0 w-full flex items-center justify-between gap-2.5 sm:gap-3 rounded-2xl sm:rounded-3xl border border-primary/30 bg-card/95 p-2 sm:p-2.5 shadow-2xl backdrop-blur-xl ${className}`}
      >
        <button
          type="button"
          aria-label={`${message}. Select to continue.`}
          className="flex min-w-0 flex-1 items-center gap-2.5 p-2 text-xs sm:text-sm font-bold text-foreground hover:opacity-80 transition-opacity cursor-pointer text-left"
          onClick={(event) => {
            event.stopPropagation();
            onAdvance();
          }}
        >
          <span className="relative flex h-2.5 w-2.5 shrink-0">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75" />
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-primary" />
          </span>
          <span className="truncate">{message}</span>
        </button>

        <div className="flex items-center gap-2 shrink-0">
          {showAiExplain && !hasAiExplanation && (
            <button
              type="button"
              disabled={isAiExplaining}
              onClick={(event) => {
                event.stopPropagation();
                onExplainWithAi?.();
              }}
              className="inline-flex items-center gap-1.5 rounded-xl sm:rounded-2xl border-2 border-primary/40 bg-primary/10 hover:bg-primary/20 text-primary px-3 py-2 sm:px-3.5 sm:py-2.5 text-xs font-black shadow-sm transition-all active:scale-95 disabled:opacity-75 disabled:cursor-wait"
            >
              {isAiExplaining ? (
                <>
                  <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
                  <span className="hidden xs:inline">Simplifying...</span>
                </>
              ) : (
                <>
                  <Sparkles className="h-3.5 w-3.5" />
                  <span>Explain with AI</span>
                </>
              )}
            </button>
          )}

          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              onAdvance();
            }}
            className="inline-flex items-center gap-1.5 rounded-xl sm:rounded-2xl bg-primary px-4 py-2 sm:px-5 sm:py-2.5 text-xs font-bold text-white shadow-lg shadow-primary/25 transition-all hover:bg-primary/90 active:scale-95 cursor-pointer"
          >
            <span>{buttonText}</span>
            <span aria-hidden="true">›</span>
          </button>
        </div>
      </div>
    </div>
  );

  return isMounted ? createPortal(dock, document.body) : null;
}
