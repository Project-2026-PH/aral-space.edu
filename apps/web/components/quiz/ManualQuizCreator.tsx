'use client';

import React, { useState } from 'react';
import { Plus, Trash2, CheckCircle2, Save, ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

interface QuestionDraft {
  question_text: string;
  options: string[];
  correct_answer: number;
  explanation: string;
}

export default function ManualQuizCreator({ subjects = [] }: { subjects?: Array<{ id: string; name: string }> }) {
  const router = useRouter();
  const [title, setTitle] = useState('');
  const [subjectId, setSubjectId] = useState(subjects[0]?.id || '');
  const [questions, setQuestions] = useState<QuestionDraft[]>([
    {
      question_text: '',
      options: ['', '', '', ''],
      correct_answer: 0,
      explanation: ''
    }
  ]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function addQuestion() {
    setQuestions([
      ...questions,
      {
        question_text: '',
        options: ['', '', '', ''],
        correct_answer: 0,
        explanation: ''
      }
    ]);
  }

  function removeQuestion(index: number) {
    if (questions.length <= 1) return;
    setQuestions(questions.filter((_, i) => i !== index));
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

  function setCorrectOption(qIdx: number, optIdx: number) {
    const next = [...questions];
    next[qIdx].correct_answer = optIdx;
    setQuestions(next);
  }

  function updateExplanation(qIdx: number, val: string) {
    const next = [...questions];
    next[qIdx].explanation = val;
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
      if (q.options.some((o) => !o.trim())) {
        setError(`Question #${i + 1} must have all 4 options filled.`);
        return;
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
          subject_id: subjectId || null,
          source_model: 'manual',
          questions: questions.map((q, idx) => ({
            question_text: q.question_text.trim(),
            options: q.options.map((o) => o.trim()),
            correct_answer: q.correct_answer,
            explanation: q.explanation.trim() || null,
            source_pages: [1]
          }))
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
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 rounded-2xl bg-primary px-6 py-2.5 text-xs font-bold text-white shadow-lg shadow-primary/20 hover:bg-primary/90 transition-all active:scale-95 disabled:opacity-50"
        >
          <Save className="h-4 w-4" />
          <span>{saving ? 'Saving...' : 'Save & Publish Quiz'}</span>
        </button>
      </div>

      {error && (
        <div className="rounded-2xl border border-destructive/30 bg-destructive/10 p-3 text-xs font-semibold text-destructive">
          {error}
        </div>
      )}

      {/* Quiz metadata */}
      <div className="rounded-3xl border border-border/80 bg-card p-6 shadow-sm space-y-4">
        <h2 className="text-base font-bold text-foreground">Quiz Details</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="md:col-span-2">
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
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1">
              Subject Category
            </label>
            <select
              value={subjectId}
              onChange={(e) => setSubjectId(e.target.value)}
              className="w-full rounded-2xl border border-border bg-background px-4 py-2.5 text-xs font-medium text-foreground focus:border-primary focus:outline-none"
            >
              <option value="">General</option>
              {subjects.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Questions list */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
            Questions ({questions.length})
          </h3>
          <button
            onClick={addQuestion}
            className="flex items-center gap-1.5 rounded-xl border border-border bg-card px-3 py-1.5 text-xs font-bold text-foreground hover:bg-muted transition-all"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>Add Question</span>
          </button>
        </div>

        {questions.map((q, qIdx) => (
          <div key={qIdx} className="rounded-3xl border border-border/80 bg-card p-6 shadow-sm space-y-4">
            <div className="flex items-start justify-between gap-4">
              <span className="flex items-center justify-center w-7 h-7 rounded-xl bg-primary/10 text-primary text-xs font-extrabold shrink-0">
                #{qIdx + 1}
              </span>
              <div className="flex-1">
                <input
                  type="text"
                  placeholder="Enter your question prompt..."
                  value={q.question_text}
                  onChange={(e) => updateQuestionText(qIdx, e.target.value)}
                  className="w-full rounded-2xl border border-border bg-background px-4 py-2 text-xs font-medium text-foreground focus:border-primary focus:outline-none"
                />
              </div>
              {questions.length > 1 && (
                <button
                  onClick={() => removeQuestion(qIdx)}
                  className="text-muted-foreground hover:text-destructive p-1 rounded-lg"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
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

            <div>
              <input
                type="text"
                placeholder="Explanation (why the selected option is correct)"
                value={q.explanation}
                onChange={(e) => updateExplanation(qIdx, e.target.value)}
                className="w-full rounded-xl border border-dashed border-border bg-background/30 px-3 py-1.5 text-xs text-muted-foreground focus:border-primary focus:outline-none"
              />
            </div>
          </div>
        ))}

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
