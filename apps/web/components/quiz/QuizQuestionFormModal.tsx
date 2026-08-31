'use client';

import React, { useState, useEffect } from 'react';
import Modal from '../ui/Modal';
import { QuizQuestion } from '@quiz-creator/types';

interface QuizQuestionFormModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  question?: QuizQuestion | null;
  quizId: string;
  onSaved: () => void;
}

export default function QuizQuestionFormModal({
  open,
  onOpenChange,
  question,
  quizId,
  onSaved
}: QuizQuestionFormModalProps) {
  const isEditing = Boolean(question);
  const [questionText, setQuestionText] = useState('');
  const [options, setOptions] = useState<string[]>(['', '', '', '']);
  const [correctAnswer, setCorrectAnswer] = useState<number>(0);
  const [explanation, setExplanation] = useState<string>('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (question) {
      setQuestionText(question.question_text);
      setOptions(question.options.length === 4 ? question.options : [...question.options, '', '', '', ''].slice(0, 4));
      setCorrectAnswer(question.correct_answer);
      setExplanation(question.explanation || '');
    } else {
      setQuestionText('');
      setOptions(['', '', '', '']);
      setCorrectAnswer(0);
      setExplanation('');
    }
    setError(null);
  }, [question, open]);

  async function handleSave() {
    if (!questionText.trim()) {
      setError('Please provide a question prompt.');
      return;
    }
    if (options.some((o) => !o.trim())) {
      setError('All 4 options must be filled out.');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      if (isEditing && question) {
        const res = await fetch(`/api/quizzes/${quizId}/questions/${question.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            question_text: questionText.trim(),
            options: options.map((o) => o.trim()),
            correct_answer: correctAnswer,
            explanation: explanation.trim() || null
          })
        });
        if (!res.ok) throw new Error('Failed to update question');
      } else {
        const res = await fetch(`/api/quizzes/${quizId}/questions`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            question_text: questionText.trim(),
            options: options.map((o) => o.trim()),
            correct_answer: correctAnswer,
            explanation: explanation.trim() || null
          })
        });
        if (!res.ok) throw new Error('Failed to create question');
      }

      onOpenChange(false);
      onSaved();
    } catch (err: any) {
      setError(err.message || 'Error saving question');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={isEditing ? 'Edit Question' : 'Add Question'}
      description="Define question prompt, 4 choices, and correct answer."
    >
      <div className="space-y-4">
        {error && (
          <div className="rounded-2xl border border-destructive/30 bg-destructive/10 p-3 text-xs font-semibold text-destructive">
            {error}
          </div>
        )}

        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1.5">
            Question Prompt
          </label>
          <textarea
            rows={3}
            placeholder="Type question prompt here..."
            value={questionText}
            onChange={(e) => setQuestionText(e.target.value)}
            className="w-full rounded-2xl border border-border bg-background p-3 text-xs text-foreground focus:border-primary focus:outline-none resize-none font-medium"
          />
        </div>

        <div className="space-y-2">
          <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground">
            Options & Correct Answer
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {options.map((opt, idx) => {
              const isSelected = correctAnswer === idx;
              return (
                <div
                  key={idx}
                  onClick={() => setCorrectAnswer(idx)}
                  className={`flex items-center gap-2 rounded-2xl border p-2.5 cursor-pointer transition-all ${
                    isSelected
                      ? 'border-primary bg-primary/5 ring-1 ring-primary'
                      : 'border-border bg-background hover:bg-muted/40'
                  }`}
                >
                  <div
                    className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 ${
                      isSelected ? 'border-primary bg-primary text-white' : 'border-muted-foreground'
                    }`}
                  >
                    {isSelected && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                  </div>
                  <input
                    type="text"
                    placeholder={`Option ${String.fromCharCode(65 + idx)}`}
                    value={opt}
                    onChange={(e) => {
                      e.stopPropagation();
                      const next = [...options];
                      next[idx] = e.target.value;
                      setOptions(next);
                    }}
                    className="w-full bg-transparent text-xs text-foreground focus:outline-none"
                  />
                </div>
              );
            })}
          </div>
        </div>

        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1.5">
            Explanation
          </label>
          <input
            type="text"
            placeholder="Why is the chosen option correct?"
            value={explanation}
            onChange={(e) => setExplanation(e.target.value)}
            className="w-full rounded-2xl border border-border bg-background px-4 py-2.5 text-xs text-foreground focus:border-primary focus:outline-none"
          />
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="rounded-xl px-4 py-2 text-xs font-semibold text-muted-foreground hover:bg-muted transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="rounded-xl bg-primary px-5 py-2 text-xs font-bold text-white hover:bg-primary/90 transition-all active:scale-95 disabled:opacity-50"
          >
            {saving ? 'Saving...' : isEditing ? 'Save Changes' : 'Add Question'}
          </button>
        </div>
      </div>
    </Modal>
  );
}
