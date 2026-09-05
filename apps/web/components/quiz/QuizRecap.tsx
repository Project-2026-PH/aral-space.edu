'use client';

import React from 'react';
import { ChevronRight, Sparkles, Volume2 } from 'lucide-react';
import type { QuizQuestion } from '@quiz-creator/types';
import { getQuestionAnswer } from '@/lib/quizAnswerEvaluation';

interface QuizRecapProps {
  questions: QuizQuestion[];
  recapQuestionIds: string[];
  correctAnswerCount: number;
  onAdvance: () => void;
  onSurfaceClick: (event: React.MouseEvent<HTMLDivElement>) => void;
  onSurfaceKeyDown: (event: React.KeyboardEvent<HTMLDivElement>) => void;
}

export default function QuizRecap({
  questions,
  recapQuestionIds,
  correctAnswerCount,
  onAdvance,
  onSurfaceClick,
  onSurfaceKeyDown
}: QuizRecapProps): React.ReactElement {
  const recapQuestions = recapQuestionIds
    .map((questionId) => questions.find((question) => question.id === questionId))
    .filter((question): question is QuizQuestion => Boolean(question));
  const recapProgressPercent = Math.round((correctAnswerCount / questions.length) * 100);

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onSurfaceClick}
      onKeyDown={onSurfaceKeyDown}
      aria-label="Quick recap. Press any key or select Continue to resume."
      className="mx-auto min-h-[calc(100vh-2rem)] max-w-5xl space-y-8 pb-28 outline-none"
    >
      <section className="space-y-3">
        <h1 className="text-xl font-black tracking-tight text-foreground sm:text-2xl">Keep up the good work.</h1>
        <div className="flex items-center gap-1 text-[10px] font-bold text-muted-foreground sm:text-xs">
          <span>Total set progress:</span>
          <span className="text-emerald-600 dark:text-emerald-400">{recapProgressPercent}%</span>
        </div>
        <div className="relative pt-1">
          <div className="h-2 rounded-full bg-muted"><div className="recap-progress-fill h-full rounded-full bg-emerald-500 transition-all duration-300" style={{ width: `${recapProgressPercent}%` }} /></div>
          <div className="absolute top-1/2 flex h-7 w-7 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-emerald-600 text-sm font-black text-white shadow-sm ring-2 ring-background" style={{ left: `${recapProgressPercent}%` }} aria-hidden="true">
            {correctAnswerCount}
          </div>
        </div>
        <div className="flex items-center justify-between text-[10px] font-bold text-muted-foreground sm:text-xs">
          <span className="text-emerald-600 dark:text-emerald-400">Correct</span>
          <span>Total questions: {questions.length}</span>
        </div>
      </section>

      <section className="recap-terms-enter mx-auto w-full max-w-3xl space-y-3" onClick={(event) => event.stopPropagation()}>
        <div className="space-y-3">
          <h2 className="text-xs font-bold text-foreground">Terms studied in this round</h2>
          <div className="space-y-2">
            {recapQuestions.map((question) => (
              <div key={question.id} className="grid grid-cols-[minmax(0,0.8fr)_minmax(0,1.4fr)_auto] items-center gap-3 rounded-md border border-border/80 bg-card px-3 py-2.5 shadow-sm sm:gap-4 sm:px-4">
                <p className="min-w-0 text-[10px] font-semibold leading-snug text-foreground sm:text-xs">{question.question_text}</p>
                <p className="min-w-0 border-l border-border/80 pl-3 text-[10px] leading-snug text-muted-foreground sm:pl-4 sm:text-xs">{getQuestionAnswer(question) || 'No definition provided.'}</p>
                <div className="flex items-center gap-2 text-muted-foreground" aria-hidden="true"><Sparkles className="h-3 w-3 text-primary" /><Volume2 className="h-3 w-3" /></div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <div className="recap-continue-enter fixed inset-x-4 bottom-4 z-20 mx-auto flex max-w-5xl flex-col items-center justify-center gap-3 rounded-2xl border border-border/80 bg-background/90 px-4 py-3 shadow-xl backdrop-blur-md sm:flex-row sm:justify-between">
        <p className="text-[10px] font-semibold text-muted-foreground sm:text-xs">Press any key to continue</p>
        <button type="button" onClick={onAdvance} className="inline-flex items-center gap-2 rounded-full bg-primary px-6 py-2.5 text-[10px] font-bold text-primary-foreground shadow-lg shadow-primary/20 transition-all hover:bg-primary/90 active:scale-95">
          Continue <ChevronRight className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
