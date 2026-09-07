'use client';

import Link from 'next/link';
import { LoaderCircle } from 'lucide-react';

interface ResumePracticeModalProps {
  open: boolean;
  quizId: string;
  progressPercent: number;
  completedQuestions: number;
  questionsUntilNextCheckIn: number;
  onContinue: () => void;
}

export default function ResumePracticeModal({
  open,
  quizId,
  progressPercent,
  completedQuestions,
  questionsUntilNextCheckIn,
  onContinue
}: ResumePracticeModalProps) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="resume-practice-title"
      aria-describedby="resume-practice-description"
      onClick={onContinue}
    >
      <div
        className="w-full max-w-3xl rounded-2xl bg-[#242342] px-5 py-7 text-white shadow-2xl sm:px-8 sm:py-9"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-6">
          <div className="min-w-0">
            <h2 id="resume-practice-title" className="max-w-xl text-3xl font-black leading-tight tracking-tight sm:text-[2rem]">
              Good to see you again! Ready to crush it today?
            </h2>
            <p id="resume-practice-description" className="sr-only">
              Your unfinished reviewer progress is saved. Continue practising or switch to Learn mode.
            </p>
          </div>
          <LoaderCircle className="mt-1 h-14 w-14 shrink-0 stroke-[3] text-indigo-500 sm:h-16 sm:w-16" aria-hidden="true" />
        </div>

        <div className="mt-7 space-y-2">
          <p className="text-sm font-bold">
            Total set progress: <span className="text-emerald-400">{progressPercent}%</span>
          </p>
          <div className="h-4 overflow-hidden rounded-full bg-slate-500/90" aria-label={`${progressPercent}% complete`} role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progressPercent}>
            <div className="h-full rounded-full bg-emerald-500 transition-[width]" style={{ width: `${progressPercent}%` }} />
          </div>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="flex min-h-28 flex-col items-center justify-center rounded-2xl bg-[#1b5b59] px-4 py-4 text-center">
            <p className="text-sm font-bold">Questions completed</p>
            <p className="mt-2 text-4xl font-black leading-none text-emerald-300">{completedQuestions}</p>
          </div>
          <div className="flex min-h-28 flex-col items-center justify-center rounded-2xl bg-[#354165] px-4 py-4 text-center">
            <p className="text-sm font-bold">Questions until next check-in</p>
            <p className="mt-2 text-4xl font-black leading-none text-violet-100">{questionsUntilNextCheckIn}</p>
          </div>
        </div>

        <div className="mt-7 flex flex-col items-stretch justify-end gap-4 border-t border-white/10 pt-4 sm:flex-row sm:items-center">
          <Link
            href={`/practice/${quizId}?mode=learn`}
            onClick={onContinue}
            className="text-center text-sm font-bold text-white transition-colors hover:text-indigo-200 sm:px-3"
          >
            Restart Learn mode
          </Link>
          <button
            type="button"
            onClick={onContinue}
            className="rounded-full bg-indigo-500 px-6 py-3 text-sm font-black text-white shadow-lg shadow-indigo-950/30 transition-colors hover:bg-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-200 focus:ring-offset-2 focus:ring-offset-[#242342]"
          >
            Continue practising
          </button>
        </div>
      </div>
    </div>
  );
}
