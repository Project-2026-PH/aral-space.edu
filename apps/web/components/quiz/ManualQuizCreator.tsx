'use client';

import React, { useState } from 'react';
import { Plus, Trash2, Save, ArrowLeft, X, Check, CircleDot, PenLine, ToggleLeft, ListOrdered, GripVertical, Tag, Sparkles } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

export type QuestionType = 'multiple_choice' | 'identification' | 'true_false' | 'enumeration';

interface QuestionDraft {
  type: QuestionType;
  question_text: string;
  options: string[];
  correct_answer: number;
  explanation?: string;
}

const QUESTION_TYPES: { id: QuestionType; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: 'multiple_choice', label: 'Multiple Choice', icon: CircleDot },
  { id: 'identification', label: 'Identification', icon: PenLine },
  { id: 'true_false', label: 'True or False', icon: ToggleLeft },
  { id: 'enumeration', label: 'Enumeration', icon: ListOrdered },
];

export default function ManualQuizCreator({
  onSwitchToAi
}: {
  subjects?: Array<{ id: string; name: string; color?: string }>;
  onSwitchToAi?: () => void;
}) {
  const router = useRouter();
  const [title, setTitle] = useState('');
  const [questions, setQuestions] = useState<QuestionDraft[]>([
    {
      type: 'multiple_choice',
      question_text: '',
      options: ['', '', '', ''],
      correct_answer: 0
    }
  ]);
  const [draggedIdx, setDraggedIdx] = useState<number | null>(null);
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function moveQuestion(fromIndex: number, toIndex: number) {
    if (toIndex < 0 || toIndex >= questions.length || fromIndex === toIndex) return;
    const next = [...questions];
    const [moved] = next.splice(fromIndex, 1);
    next.splice(toIndex, 0, moved);
    setQuestions(next);
  }

  function addQuestion() {
    setQuestions([
      ...questions,
      {
        type: 'multiple_choice',
        question_text: '',
        options: ['', '', '', ''],
        correct_answer: 0
      }
    ]);
  }

  function removeQuestion(index: number) {
    if (questions.length <= 1) return;
    setQuestions(questions.filter((_, i) => i !== index));
  }

  function setQuestionType(index: number, type: QuestionType) {
    const next = [...questions];
    const current = next[index];
    let newOptions = current.options;
    let newCorrect = current.correct_answer;

    if (type === 'multiple_choice') {
      if (newOptions.length < 4) {
        newOptions = [...newOptions, '', '', '', ''].slice(0, 4);
      } else if (newOptions.length > 4) {
        newOptions = newOptions.slice(0, 4);
      }
      newCorrect = Math.min(newCorrect, 3);
    } else if (type === 'true_false') {
      newOptions = ['True', 'False'];
      newCorrect = newCorrect === 1 ? 1 : 0;
    } else if (type === 'identification') {
      newOptions = [newOptions[0] || ''];
      newCorrect = 0;
    } else if (type === 'enumeration') {
      const valid = newOptions.filter((o) => o.trim());
      newOptions = valid.length > 0 ? valid : ['', ''];
      newCorrect = 0;
    }

    next[index] = {
      ...current,
      type,
      options: newOptions,
      correct_answer: newCorrect
    };
    setQuestions(next);
  }

  function updateQuestionText(index: number, text: string) {
    const next = [...questions];
    next[index].question_text = text;
    setQuestions(next);
  }

  function updateOptionText(qIdx: number, optIdx: number, val: string) {
    const next = [...questions];
    next[qIdx].options[optIdx] = val;
    setQuestions(next);
  }

  function addEnumerationItem(qIdx: number) {
    const next = [...questions];
    next[qIdx].options.push('');
    setQuestions(next);
  }

  function removeEnumerationItem(qIdx: number, optIdx: number) {
    const next = [...questions];
    if (next[qIdx].options.length <= 1) return;
    next[qIdx].options = next[qIdx].options.filter((_, i) => i !== optIdx);
    setQuestions(next);
  }

  function setCorrectOption(qIdx: number, optIdx: number) {
    const next = [...questions];
    next[qIdx].correct_answer = optIdx;
    setQuestions(next);
  }

  async function handleSave() {
    if (!title.trim()) {
      setError('Please provide a title for the quiz.');
      return;
    }

    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];
      if (!q.question_text.trim()) {
        setError(`Question #${i + 1} is missing question text.`);
        return;
      }
      if (q.type === 'multiple_choice') {
        if (q.options.some((o) => !o.trim())) {
          setError(`Question #${i + 1} must have all 4 options filled.`);
          return;
        }
      } else if (q.type === 'identification') {
        if (!q.options[0]?.trim()) {
          setError(`Question #${i + 1} is missing the identification answer.`);
          return;
        }
      } else if (q.type === 'enumeration') {
        const filled = q.options.filter((o) => o.trim());
        if (filled.length === 0) {
          setError(`Question #${i + 1} must have at least one enumeration item.`);
          return;
        }
      }
    }

    setSaving(true);
    setError(null);

    try {
      const res = await fetch('/api/quizzes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          subject_id: null,
          source_model: 'manual',
          questions: questions.map((q) => {
            let opts = q.options.map((o) => o.trim());
            let correct = q.correct_answer;

            if (q.type === 'true_false') {
              opts = ['True', 'False'];
            } else if (q.type === 'identification') {
              opts = [q.options[0]?.trim() || ''];
              correct = 0;
            } else if (q.type === 'enumeration') {
              opts = q.options.map((o) => o.trim()).filter(Boolean);
              correct = 0;
            }

            return {
              question_text: q.question_text.trim(),
              options: opts,
              correct_answer: correct,
              explanation: q.explanation?.trim() || null,
              source_pages: [1]
            };
          })
        })
      });

      if (!res.ok) throw new Error('Failed to create quiz');
      const created = await res.json();
      router.push(`/quizzes/${created.id}`);
    } catch (err: any) {
      setError(err.message || 'Failed to save quiz.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-20">
      <div className="flex items-center justify-between">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-xs font-semibold text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Hub
        </Link>
        <div className="flex items-center gap-2.5">
          {onSwitchToAi && (
            <button
              type="button"
              onClick={onSwitchToAi}
              className="flex items-center gap-1.5 rounded-2xl border border-border bg-card px-4 py-2.5 text-xs font-bold text-foreground hover:bg-muted transition-all active:scale-95 shadow-2xs"
            >
              <Sparkles className="h-3.5 w-3.5 text-primary" />
              <span>Generate with AI</span>
            </button>
          )}
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 rounded-2xl bg-primary px-6 py-2.5 text-xs font-bold text-white shadow-lg shadow-primary/20 hover:bg-primary/90 transition-all active:scale-95 disabled:opacity-50"
          >
            <Save className="h-4 w-4" />
            <span>{saving ? 'Saving...' : 'Save & Publish Quiz'}</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-2xl border border-destructive/30 bg-destructive/10 p-3 text-xs font-semibold text-destructive">
          {error}
        </div>
      )}

      {/* Quiz metadata */}
      <div className="rounded-3xl border border-border/80 bg-card p-6 shadow-sm space-y-4">
        <h2 className="text-base font-bold text-foreground">Quiz Details</h2>
        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1">
            Quiz Title
          </label>
          <input
            type="text"
            placeholder="e.g. Molecular Biology Core Concepts"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full rounded-2xl border border-border bg-background px-4 py-2.5 text-xs font-medium text-foreground focus:border-primary focus:outline-none"
          />
        </div>
      </div>

      {/* Questions list */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
            Questions ({questions.length})
          </h3>
        </div>

        {questions.map((q, qIdx) => {
          const isDragging = draggedIdx === qIdx;
          const isOver = dragOverIdx === qIdx && draggedIdx !== qIdx;

          return (
            <div
              key={qIdx}
              draggable
              onDragStart={(e) => {
                const target = e.target as HTMLElement;
                // If user started dragging inside an input, button, or textarea, don't drag card
                if (target.closest('input, textarea, select, button')) {
                  e.preventDefault();
                  return;
                }
                e.dataTransfer.effectAllowed = 'move';
                setDraggedIdx(qIdx);
              }}
              onDragEnd={() => {
                setDraggedIdx(null);
                setDragOverIdx(null);
              }}
              onDragOver={(e) => {
                e.preventDefault();
                setDragOverIdx(qIdx);
              }}
              onDragLeave={() => {
                if (dragOverIdx === qIdx) setDragOverIdx(null);
              }}
              onDrop={(e) => {
                e.preventDefault();
                if (draggedIdx !== null && draggedIdx !== qIdx) {
                  moveQuestion(draggedIdx, qIdx);
                }
                setDraggedIdx(null);
                setDragOverIdx(null);
              }}
              className={`rounded-3xl border bg-card p-6 shadow-sm space-y-4 transition-all cursor-default ${
                isDragging
                  ? 'opacity-30 border-dashed border-primary scale-[0.98] shadow-none'
                  : isOver
                  ? 'border-primary ring-2 ring-primary/30 bg-primary/[0.03] translate-y-1 shadow-md'
                  : 'border-border/80 hover:border-border'
              }`}
            >
              {/* Header: Drag handle, Number, Category Badges & Delete */}
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  {/* Drag Handle */}
                  <div
                    className="cursor-grab active:cursor-grabbing text-muted-foreground/50 hover:text-primary p-1 rounded-lg hover:bg-muted transition-colors"
                    title="Drag anywhere on card to reorder"
                  >
                    <GripVertical className="h-4 w-4" />
                  </div>

                  {/* Question Number Badge */}
                  <span className="flex items-center justify-center w-7 h-7 rounded-xl bg-primary/10 text-primary text-xs font-extrabold shrink-0 select-none">
                    #{qIdx + 1}
                  </span>

                  <span className="text-xs font-bold text-muted-foreground">Category:</span>
                </div>

                {/* Question Type Badges */}
                <div className="flex flex-wrap items-center gap-1.5">
                  {QUESTION_TYPES.map((t) => {
                    const isActive = q.type === t.id;
                    const Icon = t.icon;
                    return (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => setQuestionType(qIdx, t.id)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                          isActive
                            ? 'bg-primary text-white shadow-sm shadow-primary/30 ring-2 ring-primary/20 scale-100'
                            : 'bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground border border-border/40'
                        }`}
                      >
                        <Icon className="h-3.5 w-3.5" />
                        <span>{t.label}</span>
                      </button>
                    );
                  })}
                </div>

                {questions.length > 1 && (
                  <button
                    onClick={() => removeQuestion(qIdx)}
                    className="text-muted-foreground hover:text-destructive p-1.5 rounded-xl hover:bg-destructive/10 transition-colors ml-auto sm:ml-0"
                    title="Delete Question"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </div>

            {/* Question prompt input */}
            <div>
              <input
                type="text"
                placeholder="Enter your question prompt..."
                value={q.question_text}
                onChange={(e) => updateQuestionText(qIdx, e.target.value)}
                className="w-full rounded-2xl border border-border bg-background px-4 py-2.5 text-xs font-medium text-foreground focus:border-primary focus:outline-none"
              />
            </div>

            {/* Dynamic Type Body */}
            {q.type === 'multiple_choice' && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-[11px] font-semibold text-muted-foreground">
                  <span>Choice Options</span>
                  <span className="italic">Select the radio icon of the correct choice</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {q.options.map((opt, optIdx) => {
                    const isSelected = q.correct_answer === optIdx;
                    return (
                      <div
                        key={optIdx}
                        onClick={() => setCorrectOption(qIdx, optIdx)}
                        className={`flex items-center gap-3 rounded-2xl border p-3 cursor-pointer transition-all ${
                          isSelected
                            ? 'border-primary bg-primary/5 ring-1 ring-primary'
                            : 'border-border bg-background/50 hover:bg-muted/40'
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
                          placeholder={`Option ${String.fromCharCode(65 + optIdx)}`}
                          value={opt}
                          onChange={(e) => {
                            e.stopPropagation();
                            updateOptionText(qIdx, optIdx, e.target.value);
                          }}
                          className="w-full bg-transparent text-xs text-foreground focus:outline-none font-medium"
                        />
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {q.type === 'true_false' && (
              <div className="space-y-2">
                <div className="text-[11px] font-semibold text-muted-foreground">
                  Select the correct answer:
                </div>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { label: 'True', val: 0, color: 'text-emerald-500', activeBg: 'border-emerald-500 bg-emerald-500/10 ring-1 ring-emerald-500' },
                    { label: 'False', val: 1, color: 'text-rose-500', activeBg: 'border-rose-500 bg-rose-500/10 ring-1 ring-rose-500' }
                  ].map((tf) => {
                    const isSelected = q.correct_answer === tf.val;
                    return (
                      <div
                        key={tf.val}
                        onClick={() => setCorrectOption(qIdx, tf.val)}
                        className={`flex items-center justify-center gap-2.5 rounded-2xl border py-4 px-4 cursor-pointer font-bold text-xs transition-all ${
                          isSelected
                            ? tf.activeBg
                            : 'border-border bg-background/50 hover:bg-muted/40 text-muted-foreground'
                        }`}
                      >
                        <div
                          className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 ${
                            isSelected ? 'border-current bg-current text-card' : 'border-muted-foreground'
                          }`}
                        >
                          {isSelected && <Check className="w-3 h-3 text-white" />}
                        </div>
                        <span className={`text-sm ${isSelected ? tf.color : ''}`}>{tf.label}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {q.type === 'identification' && (
              <div className="space-y-2">
                <label className="block text-[11px] font-semibold text-muted-foreground">
                  Correct Answer (Target identification term/phrase)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Photosynthesis"
                  value={q.options[0] || ''}
                  onChange={(e) => updateOptionText(qIdx, 0, e.target.value)}
                  className="w-full rounded-2xl border border-primary/30 bg-primary/5 px-4 py-3 text-xs font-semibold text-foreground focus:border-primary focus:outline-none"
                />
              </div>
            )}

            {q.type === 'enumeration' && (
              <div className="space-y-3">
                <div className="flex items-center justify-between text-[11px] font-semibold text-muted-foreground">
                  <span>Enumeration Items / Answers</span>
                  <button
                    type="button"
                    onClick={() => addEnumerationItem(qIdx)}
                    className="flex items-center gap-1 text-primary hover:underline text-xs font-bold"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    <span>Add Item</span>
                  </button>
                </div>
                <div className="space-y-2">
                  {q.options.map((opt, optIdx) => (
                    <div key={optIdx} className="flex items-center gap-2">
                      <span className="flex items-center justify-center w-6 h-6 rounded-lg bg-muted text-muted-foreground text-[11px] font-bold shrink-0">
                        {optIdx + 1}
                      </span>
                      <input
                        type="text"
                        placeholder={`Item #${optIdx + 1}`}
                        value={opt}
                        onChange={(e) => updateOptionText(qIdx, optIdx, e.target.value)}
                        className="flex-1 rounded-xl border border-border bg-background px-3 py-2 text-xs font-medium text-foreground focus:border-primary focus:outline-none"
                      />
                      {q.options.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeEnumerationItem(qIdx, optIdx)}
                          className="text-muted-foreground hover:text-destructive p-1.5 rounded-lg hover:bg-destructive/10 transition-colors"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
          );
        })}

        <button
          onClick={addQuestion}
          className="w-full py-4 rounded-3xl border border-dashed border-border bg-card/50 text-xs font-bold uppercase tracking-wider text-muted-foreground hover:text-foreground hover:bg-muted/30 transition-all flex items-center justify-center gap-2"
        >
          <Plus className="h-4 w-4" />
          <span>Add Another Question</span>
        </button>
      </div>
    </div>
  );
}
