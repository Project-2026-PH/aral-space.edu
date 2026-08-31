'use client';

import React from 'react';
import { QuizQuestion, QuestionProgress } from '@quiz-creator/types';
import { MasteryEngineService } from '@quiz-creator/core';
import { Layers, Lock, CheckCircle2 } from 'lucide-react';

interface QuizBatchesSectionProps {
  quizId: string;
  questions: QuizQuestion[];
  progressList?: QuestionProgress[];
}

export default function QuizBatchesSection({
  quizId,
  questions,
  progressList = []
}: QuizBatchesSectionProps) {
  const progressMap = new Map(progressList.map((p) => [p.question_id, p]));
  const batches = MasteryEngineService.getBatches(questions, progressMap);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
          <Layers className="h-4 w-4 text-primary" />
          <span>5-Question Mastery Batches ({batches.length})</span>
        </h3>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
        {batches.map((batch) => {
          const percent = batch.totalQuestions > 0 ? Math.round((batch.lockedQuestions / batch.totalQuestions) * 100) : 0;
          return (
            <div
              key={batch.batchNumber}
              className={`rounded-2xl border p-4 transition-all ${
                batch.isCompleted
                  ? 'border-emerald-500/30 bg-emerald-500/5'
                  : batch.isUnlocked
                  ? 'border-border/80 bg-card'
                  : 'border-border/40 bg-muted/20 opacity-60'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-foreground">
                  Batch #{batch.batchNumber + 1}
                </span>
                {batch.isCompleted ? (
                  <span className="flex items-center gap-1 text-[11px] font-bold text-emerald-500">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    Mastered
                  </span>
                ) : batch.isUnlocked ? (
                  <span className="text-[11px] font-semibold text-primary">Active</span>
                ) : (
                  <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                    <Lock className="h-3 w-3" />
                    Locked
                  </span>
                )}
              </div>

              <div className="mt-3">
                <div className="flex items-center justify-between text-[11px] text-muted-foreground mb-1">
                  <span>Progress</span>
                  <span>{batch.lockedQuestions} / {batch.totalQuestions} Locked</span>
                </div>
                <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                  <div
                    className={`h-full transition-all duration-300 ${
                      batch.isCompleted ? 'bg-emerald-500' : 'bg-primary'
                    }`}
                    style={{ width: `${percent}%` }}
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
