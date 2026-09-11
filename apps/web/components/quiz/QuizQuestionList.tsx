'use client';

import React, { useState } from 'react';
import RichTextContent from '@/components/editor/RichTextContent';
import { QuizQuestion } from '@quiz-creator/types';
import { Edit, Trash2 } from 'lucide-react';
import ConfirmModal from '../ui/ConfirmModal';
import { makeAuthoringQuestionSnapshot, recordLocalAuthoringEvent } from '@/lib/authoringPreferences';

interface QuizQuestionListProps {
  quizId: string;
  questions: QuizQuestion[];
  onEdit: (question: QuizQuestion) => void;
  onDeleted: (deletedId?: string) => void;
  readOnly?: boolean;
  subjectId?: string | null;
  userId?: string | null;
}

export default function QuizQuestionList({
  quizId,
  questions,
  onEdit,
  onDeleted,
  readOnly = false,
  subjectId,
  userId
}: QuizQuestionListProps) {
  const [deletingId, setDeletingId] = useState<string | null>(null);

  async function handleDelete() {
    if (!deletingId) return;
    try {
      const deletedQuestion = questions.find((question) => question.id === deletingId);
      const res = await fetch(`/api/quizzes/${quizId}/questions/${deletingId}`, {
        method: 'DELETE'
      });
      if (res.ok) {
        if (deletedQuestion) {
          recordLocalAuthoringEvent(
            {
              action: 'delete',
              before: makeAuthoringQuestionSnapshot(
                deletedQuestion.question_type === 'typed_answer' ? 'typed_answer' : 'multiple_choice',
                deletedQuestion.question_text,
                deletedQuestion.options || [],
                deletedQuestion.explanation
              )
            },
            { userId, subjectId }
          );
        }
        const idToDelete = deletingId;
        setDeletingId(null);
        onDeleted(idToDelete);
      }
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
      {questions.map((q, idx) => (
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
                <RichTextContent
                  html={q.question_text}
                  className="text-xs font-semibold text-foreground leading-snug"
                />
              </div>
            </div>

            {!readOnly && (
              <div className="flex items-center gap-1 shrink-0">
                <button
                  onClick={() => onEdit(q)}
                  className="rounded-lg p-1.5 text-muted-foreground hover:bg-primary/10 hover:text-primary transition-colors"
                  aria-label="Edit question"
                >
                  <Edit className="h-4 w-4" />
                </button>
                <button
                  onClick={() => setDeletingId(q.id)}
                  className="rounded-lg p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
                  aria-label="Delete question"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            )}
          </div>

          <div className="mt-3 pt-3 border-t border-border/40 space-y-2">
            {q.options.length > 0 ? (
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
            ) : (
              <div className="rounded-xl bg-primary/5 px-3 py-2 text-xs text-primary flex flex-wrap items-center justify-between gap-2 border border-primary/20">
                <span className="font-semibold">
                  <span className="text-[10px] uppercase font-bold text-muted-foreground mr-1.5">Answer:</span>
                  {q.answer_text || 'No answer provided'}
                </span>
                <span className="text-[10px] font-normal text-muted-foreground italic">
                  Typed-answer card (Learn mode)
                </span>
              </div>
            )}
            {q.explanation && (
              <div className="flex items-start gap-1.5 rounded-xl bg-muted/30 p-2 text-[11px] text-muted-foreground">
                <span aria-hidden="true">💡</span>
                <RichTextContent
                  html={q.explanation}
                  className="italic"
                />
              </div>
            )}
          </div>
        </div>
      ))}

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
