'use client';

import React from 'react';
import { ChevronRight, Sparkles, Volume2 } from 'lucide-react';
import type { QuizMode, QuizQuestion } from '@quiz-creator/types';
import { getQuestionAnswer } from '@/lib/quizAnswerEvaluation';
import WindFlameBadge from '@/components/quiz/WindFlameBadge';

interface QuizRecapProps {
  questions: QuizQuestion[];
  recapQuestionIds: string[];
  totalLockedCount?: number;
  correctAnswerCount: number;
  overallPercent?: number;
  progressSegments?: Array<{ id: number; fillPercent: number }>;
  progressPercent?: number;
  mode?: QuizMode;
  currentStreak?: number;
  bestStreak?: number;
  onAdvance: () => void;
  onSurfaceClick: (event: React.MouseEvent<HTMLDivElement>) => void;
  onSurfaceKeyDown: (event: React.KeyboardEvent<HTMLDivElement>) => void;
}

export default function QuizRecap({
  questions,
  recapQuestionIds,
  totalLockedCount,
  correctAnswerCount,
  overallPercent,
  progressSegments,
  progressPercent,
  mode = 'multiple_choice',
  currentStreak,
  bestStreak,
  onAdvance,
  onSurfaceClick,
  onSurfaceKeyDown
}: QuizRecapProps): React.ReactElement {
  const recapQuestions = recapQuestionIds
    .map((questionId) => questions.find((question) => question.id === questionId))
    .filter((question): question is QuizQuestion => Boolean(question));

  const effectiveLockedCount = totalLockedCount ?? correctAnswerCount;
  const effectiveOverallPercent = overallPercent ?? Math.round((effectiveLockedCount / (questions.length || 1)) * 100);
  const questionsPerReviewRound = 7;
  const reviewRoundCount = Math.max(1, Math.ceil((questions.length || 1) / questionsPerReviewRound));
  const effectiveSegments = progressSegments ?? Array.from({ length: reviewRoundCount }, (_, index) => {
    const segmentStart = index * questionsPerReviewRound;
    const segmentSize = Math.min(questionsPerReviewRound, questions.length - segmentStart);
    const completedInSegment = Math.min(Math.max(effectiveLockedCount - segmentStart, 0), segmentSize);
    return { id: index, fillPercent: segmentSize > 0 ? (completedInSegment / segmentSize) * 100 : 0 };
  });
  const effectiveProgressPercent = progressPercent ?? (effectiveSegments.reduce((sum, segment) => sum + segment.fillPercent, 0) / reviewRoundCount);
  const isSegmented = mode === 'multiple_choice' || mode === 'reverse' || Boolean(progressSegments);

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
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-black tracking-tight text-foreground sm:text-2xl">Keep up the good work.</h1>
          {currentStreak !== undefined && (
            <WindFlameBadge
              streak={currentStreak}
              totalQuestions={questions.length}
              bestStreak={bestStreak ?? currentStreak}
              size="md"
            />
          )}
        </div>
        <div className="flex items-center gap-1 text-[10px] font-bold text-muted-foreground sm:text-xs">
          <span>Total set progress:</span>
          <span className="text-emerald-600 dark:text-emerald-400">{effectiveOverallPercent}%</span>
        </div>
        {isSegmented ? (
          <div className="relative pt-1">
            <div className="flex h-2 w-full gap-1" aria-hidden="true">
              {effectiveSegments.map((segment) => (
                <div key={segment.id} className="min-w-0 flex-1 overflow-hidden rounded-full bg-muted">
                  <div
                    className="recap-progress-fill h-full rounded-full bg-emerald-500 transition-[width] duration-300"
                    style={{ width: `${segment.fillPercent}%` }}
                  />
                </div>
              ))}
            </div>
            {effectiveLockedCount > 0 && effectiveLockedCount < questions.length && (
              <div
                className="absolute top-1/2 flex h-7 w-7 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-emerald-600 text-sm font-black text-white shadow-sm ring-2 ring-background transition-[left] duration-300"
                style={{ left: `${effectiveProgressPercent}%` }}
                aria-hidden="true"
              >
                {effectiveLockedCount}
              </div>
            )}
            <div
              className="absolute right-0 top-1/2 flex h-7 w-7 -translate-y-1/2 translate-x-1/2 items-center justify-center rounded-full bg-muted-foreground text-sm font-black text-background shadow-sm ring-2 ring-background"
              aria-hidden="true"
            >
              {questions.length}
            </div>
          </div>
        ) : (
          <div className="relative pt-1">
            <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
              <div
                className="recap-progress-fill h-full bg-primary transition-all duration-300"
                style={{ width: `${effectiveOverallPercent}%` }}
              />
            </div>
            {effectiveLockedCount > 0 && effectiveLockedCount < questions.length && (
              <div
                className="absolute top-1/2 flex h-7 w-7 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-primary text-sm font-black text-primary-foreground shadow-sm ring-2 ring-background transition-[left] duration-300"
                style={{ left: `${effectiveOverallPercent}%` }}
                aria-hidden="true"
              >
                {effectiveLockedCount}
              </div>
            )}
            <div
              className="absolute right-0 top-1/2 flex h-7 w-7 -translate-y-1/2 translate-x-1/2 items-center justify-center rounded-full bg-muted-foreground text-sm font-black text-background shadow-sm ring-2 ring-background"
              aria-hidden="true"
            >
              {questions.length}
            </div>
          </div>
        )}
        <div className="flex items-center justify-between text-[10px] font-bold text-muted-foreground sm:text-xs">
          <span className="text-emerald-600 dark:text-emerald-400">
            {effectiveLockedCount} of {questions.length} mastered
          </span>
          <span>{correctAnswerCount} answered correctly</span>
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
