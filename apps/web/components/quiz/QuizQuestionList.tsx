'use client';

import React, { useState } from 'react';
import { QuizQuestion } from '@quiz-creator/types';
import { Edit, Trash2, ChevronDown, ChevronUp } from 'lucide-react';
import ConfirmModal from '../ui/ConfirmModal';

interface QuizQuestionListProps {
  quizId: string;
  questions: QuizQuestion[];
  onEdit: (question: QuizQuestion) => void;
  onDeleted: () => void;
}

export default function QuizQuestionList({
  quizId,
  questions,
  onEdit,
  onDeleted
}: QuizQuestionListProps) {
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  async function handleDelete() {
    if (!deletingId) return;
    try {
      await fetch(`/api/quizzes/${quizId}/questions/${deletingId}`, {
        method: 'DELETE'
      });
      setDeletingId(null);
      onDeleted();
    } catch (err) {
      console.error('Delete question error:', err);
    }
  }

  if (questions.length === 0) {
    return (
      <div className="rounded-3xl border border-dashed border-border p-8 text-center text-xs text-muted-foreground">
        No questions in this library yet. Click &quot;Add Question&quot; to create one.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {questions.map((q, idx) => {
        const isExpanded = expandedId === q.id;
        return (
          <div
            key={q.id}
            className="rounded-2xl border border-border/80 bg-card p-4 shadow-2xs hover:border-border transition-all"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3 flex-1 min-w-0">
                <span className="flex items-center justify-center w-6 h-6 rounded-lg bg-muted text-foreground text-xs font-bold shrink-0 mt-0.5">
                  {idx + 1}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-foreground leading-snug">
                    {q.question_text}
                  </p>
                  <p className="text-[11px] text-muted-foreground mt-1">
                    Correct: <span className="font-medium text-foreground">{q.options[q.correct_answer]}</span>
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-1 shrink-0">
                <button
                  onClick={() => setExpandedId(isExpanded ? null : q.id)}
                  className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted transition-colors"
                >
                  {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </button>
                <button
                  onClick={() => onEdit(q)}
                  className="rounded-lg p-1.5 text-muted-foreground hover:bg-primary/10 hover:text-primary transition-colors"
                >
                  <Edit className="h-4 w-4" />
                </button>
                <button
                  onClick={() => setDeletingId(q.id)}
                  className="rounded-lg p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>

            {isExpanded && (
              <div className="mt-3 pt-3 border-t border-border/40 space-y-2">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {q.options.map((opt, optIdx) => (
                    <div
                      key={optIdx}
                      className={`rounded-xl px-3 py-1.5 text-xs flex items-center gap-2 ${
                        optIdx === q.correct_answer
                          ? 'bg-primary/10 text-primary font-semibold border border-primary/20'
                          : 'bg-muted/50 text-muted-foreground'
                      }`}
                    >
                      <span className="font-bold text-[10px] uppercase">
                        {String.fromCharCode(65 + optIdx)}:
                      </span>
                      <span className="truncate">{opt}</span>
                    </div>
                  ))}
                </div>
                {q.explanation && (
                  <p className="text-[11px] text-muted-foreground italic bg-muted/30 p-2 rounded-xl">
                    💡 {q.explanation}
                  </p>
                )}
              </div>
            )}
          </div>
        );
      })}

      <ConfirmModal
        open={Boolean(deletingId)}
        onOpenChange={(open) => !open && setDeletingId(null)}
        onConfirm={handleDelete}
        title="Delete Question"
        message="Are you sure you want to remove this question from the quiz library?"
        destructive
        confirmText="Delete"
      />
    </div>
  );
}
