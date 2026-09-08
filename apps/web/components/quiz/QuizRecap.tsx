'use client';

import React from 'react';
import { Sparkles, Volume2 } from 'lucide-react';
import type { QuizMode, QuizQuestion } from '@quiz-creator/types';
import { getQuestionAnswer } from '@/lib/quizAnswerEvaluation';
import WindFlameBadge from '@/components/quiz/WindFlameBadge';
import RichTextContent from '@/components/editor/RichTextContent';

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

  const pointerStartRef = React.useRef<{ x: number; y: number } | null>(null);
  const isDraggingRef = React.useRef(false);

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    pointerStartRef.current = { x: event.clientX, y: event.clientY };
    isDraggingRef.current = false;
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!pointerStartRef.current) return;
    const dx = Math.abs(event.clientX - pointerStartRef.current.x);
    const dy = Math.abs(event.clientY - pointerStartRef.current.y);
    if (dx > 6 || dy > 6) {
      isDraggingRef.current = true;
    }
  };

  const handleSurfaceClick = (event: React.MouseEvent<HTMLDivElement>) => {
    if (isDraggingRef.current) {
      event.stopPropagation();
      return;
    }
    onSurfaceClick(event);
  };

  return (
    <div
      tabIndex={0}
      onClick={handleSurfaceClick}
      onKeyDown={onSurfaceKeyDown}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      aria-label="Quick recap. Press any key or select Continue to resume."
      className="mx-auto w-full max-w-3xl min-h-[calc(100dvh-5rem)] max-h-[calc(100dvh-4.5rem)] sm:max-h-none sm:min-h-[calc(100vh-2rem)] space-y-8 pb-48 sm:pb-40 outline-none px-3 sm:px-0 overflow-y-auto sm:overflow-visible overscroll-y-contain touch-pan-y"
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
              <div
                key={question.id}
                className="grid grid-cols-1 sm:grid-cols-[minmax(0,0.8fr)_minmax(0,1.4fr)_auto] items-start sm:items-center gap-2 sm:gap-4 rounded-xl sm:rounded-2xl border border-border/80 bg-card p-3 sm:px-4 sm:py-2.5 shadow-sm"
              >
                <RichTextContent html={question.question_text} className="min-w-0 text-xs font-semibold leading-snug text-foreground" />
                <div className="min-w-0 border-t sm:border-t-0 sm:border-l border-border/80 pt-1.5 sm:pt-0 sm:pl-4">
                  <p className="text-xs leading-snug font-medium text-emerald-600 dark:text-emerald-400 sm:text-muted-foreground">
                    {getQuestionAnswer(question) || 'No definition provided.'}
                  </p>
                </div>
                <div className="flex items-center justify-end gap-2 text-muted-foreground" aria-hidden="true">
                  <Sparkles className="h-3.5 w-3.5 text-primary" />
                  <Volume2 className="h-3.5 w-3.5" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
