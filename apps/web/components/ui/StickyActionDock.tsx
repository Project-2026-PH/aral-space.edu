'use client';

import React from 'react';
import { createPortal } from 'react-dom';

export interface StickyActionDockProps {
  onAction: () => void;
  buttonText: string;
  ariaLabel: string;
  message: string;
  icon?: React.ReactNode;
  disabled?: boolean;
}

export default function StickyActionDock({
  onAction,
  buttonText,
  ariaLabel,
  message,
  icon,
  disabled = false
}: StickyActionDockProps): React.ReactElement | null {
  const [isMounted, setIsMounted] = React.useState(false);

  React.useEffect(() => {
    setIsMounted(true);
  }, []);

  const dock = (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-[60] flex w-full justify-center px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:inset-x-auto sm:bottom-6 sm:left-1/2 sm:w-[calc(100vw-1.5rem)] sm:max-w-xl sm:-translate-x-1/2 sm:px-0 sm:pb-0">
      <div className="pointer-events-auto flex w-full items-center justify-between gap-3 rounded-2xl border border-primary/30 bg-card/95 p-3.5 shadow-2xl backdrop-blur-xl sm:rounded-3xl sm:p-4">
        <span className="flex min-w-0 flex-1 items-center gap-2.5 text-xs font-bold text-foreground sm:text-sm">
          <span className="relative flex h-2.5 w-2.5 shrink-0">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-primary" />
          </span>
          <span className="truncate">{message}</span>
        </span>
        <button
          type="button"
          aria-label={ariaLabel}
          onClick={onAction}
          disabled={disabled}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-xs font-bold text-white shadow-lg shadow-primary/25 transition-all hover:bg-primary/90 active:scale-95 disabled:cursor-not-allowed disabled:opacity-50 sm:rounded-2xl sm:px-5 sm:py-2.5"
        >
          {icon}
          <span>{buttonText}</span>
        </button>
      </div>
    </div>
  );

  return isMounted ? createPortal(dock, document.body) : null;
}
