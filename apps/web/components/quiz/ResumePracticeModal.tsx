'use client';

import { createPortal } from 'react-dom';
import { LoaderCircle, RotateCcw } from 'lucide-react';

interface ResumePracticeModalProps {
  open: boolean;
  progressPercent: number;
  completedQuestions: number;
  questionsUntilNextCheckIn: number;
  onContinue: () => void;
  onReset: () => void;
}

export default function ResumePracticeModal({
  open,
  progressPercent,
  completedQuestions,
  questionsUntilNextCheckIn,
  onContinue,
  onReset
}: ResumePracticeModalProps) {
  if (!open || typeof document === 'undefined') return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[60] flex min-h-dvh w-screen items-center justify-center overflow-y-auto bg-background/80 p-3 backdrop-blur-md animate-modal-backdrop sm:p-4"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 60,
        display: 'flex',
        width: '100vw',
        height: '100dvh',
        alignItems: 'center',
        justifyContent: 'center',
        overflowY: 'auto',
        boxSizing: 'border-box'
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="resume-practice-title"
      aria-describedby="resume-practice-description"
      onClick={onContinue}
    >
      <div
        className="mx-auto w-full max-w-[calc(100vw-2rem)] max-h-[calc(100dvh-2rem)] overflow-y-auto rounded-2xl border border-border bg-card p-4 text-foreground shadow-2xl shadow-primary/10 animate-modal-pop sm:max-w-3xl sm:rounded-3xl sm:p-8"
        style={{
          width: 'min(48rem, calc(100vw - 2rem))',
          maxHeight: 'calc(100dvh - 2rem)',
          boxSizing: 'border-box',
          flexShrink: 0
        }}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 sm:gap-6">
          <div className="min-w-0">
            <h2 id="resume-practice-title" className="max-w-xl text-2xl font-black leading-snug tracking-tight sm:text-3xl sm:leading-tight lg:text-[2rem]">
              Good to see you again! Ready to crush it today?
            </h2>
            <p id="resume-practice-description" className="sr-only">
              Your unfinished reviewer progress is saved. Continue practising, switch to Learn mode, or reset the saved review point.
            </p>
          </div>
          <LoaderCircle className="mt-0.5 h-10 w-10 shrink-0 stroke-[3] text-primary sm:mt-1 sm:h-16 sm:w-16" aria-hidden="true" />
        </div>

        <div className="mt-5 space-y-2 sm:mt-7">
          <p className="text-xs font-bold sm:text-sm">
            Total set progress: <span className="text-primary">{progressPercent}%</span>
          </p>
          <div className="h-3 overflow-hidden rounded-full bg-muted sm:h-4" aria-label={`${progressPercent}% complete`} role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progressPercent}>
            <div className="h-full rounded-full bg-primary transition-[width]" style={{ width: `${progressPercent}%` }} />
          </div>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2 sm:mt-4 sm:gap-3">
          <div className="flex min-h-20 flex-col items-center justify-center rounded-xl border border-border/70 bg-primary/10 px-2 py-3 text-center sm:min-h-28 sm:rounded-2xl sm:px-4 sm:py-4">
            <p className="text-[11px] font-bold leading-tight sm:text-sm">Questions completed</p>
            <p className="mt-1.5 text-3xl font-black leading-none text-primary sm:mt-2 sm:text-4xl">{completedQuestions}</p>
          </div>
          <div className="flex min-h-20 flex-col items-center justify-center rounded-xl border border-border/70 bg-muted/40 px-2 py-3 text-center sm:min-h-28 sm:rounded-2xl sm:px-4 sm:py-4">
            <p className="text-[11px] font-bold leading-tight sm:text-sm">Questions until next check-in</p>
            <p className="mt-1.5 text-3xl font-black leading-none text-foreground sm:mt-2 sm:text-4xl">{questionsUntilNextCheckIn}</p>
          </div>
        </div>

        <div className="mt-5 flex flex-col items-stretch justify-end gap-3 border-t border-border pt-3 sm:mt-7 sm:flex-row sm:items-center sm:gap-4 sm:pt-4">
          <button
            type="button"
            onClick={onReset}
            title="Restart Learn mode and clear the saved review point. Mastery progress stays safe."
            aria-label="Restart Learn mode and clear the saved review point"
            className="inline-flex w-full shrink-0 items-center justify-center gap-1.5 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs font-semibold text-destructive transition-colors hover:bg-destructive/10 focus:outline-none focus:ring-2 focus:ring-destructive/30 focus:ring-offset-2 focus:ring-offset-card sm:w-auto sm:px-3 sm:py-1.5 sm:text-sm"
          >
            <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
            Restart
          </button>
          <button
            type="button"
            onClick={onContinue}
            className="w-full rounded-full bg-primary px-5 py-2.5 text-xs font-black text-primary-foreground shadow-lg shadow-primary/20 transition-colors hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-primary/40 focus:ring-offset-2 focus:ring-offset-card sm:w-auto sm:px-6 sm:py-3 sm:text-sm"
          >
            Continue practising
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
