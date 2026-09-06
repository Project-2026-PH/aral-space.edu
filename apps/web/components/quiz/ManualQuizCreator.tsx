'use client';

import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Save, ArrowLeft, X, Check, CircleDot, PenLine, ToggleLeft, ListOrdered, Tag, Sparkles, ClipboardPaste } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import NewSubjectModal from '../subject/NewSubjectModal';
import StickyActionDock from '../ui/StickyActionDock';
import { parseSmartClipboard, type ParsedClipboard } from '@/lib/clipboardParser';
import { QuizTransformService } from '@quiz-creator/core';

export type QuestionType = 'multiple_choice' | 'identification' | 'true_false' | 'enumeration';

interface QuestionDraft {
  type: QuestionType;
  question_text: string;
  options: string[];
  correct_answer: number;
  explanation?: string;
}

interface ManualQuizDraft {
  version: 1;
  updatedAt: string;
  title: string;
  description: string;
  subjectId: string;
  questions: QuestionDraft[];
}

const MANUAL_DRAFT_STORAGE_KEY = 'quiz-creator:manual-draft:v1';
const MANUAL_DRAFT_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

function parseManualQuizDraft(raw: string | null): ManualQuizDraft | null {
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as Partial<ManualQuizDraft>;
    const updatedAt = Date.parse(parsed.updatedAt || '');
    if (
      parsed.version !== 1 ||
      !Number.isFinite(updatedAt) ||
      Date.now() - updatedAt > MANUAL_DRAFT_MAX_AGE_MS ||
      typeof parsed.title !== 'string' ||
      typeof parsed.description !== 'string' ||
      typeof parsed.subjectId !== 'string' ||
      !Array.isArray(parsed.questions)
    ) {
      return null;
    }

    return {
      version: 1,
      updatedAt: parsed.updatedAt as string,
      title: parsed.title,
      description: parsed.description,
      subjectId: parsed.subjectId,
      questions: parsed.questions as QuestionDraft[]
    };
  } catch {
    return null;
  }
}

const QUESTION_TYPES: { id: QuestionType; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: 'multiple_choice', label: 'Multiple Choice', icon: CircleDot },
  { id: 'identification', label: 'Identification', icon: PenLine },
  { id: 'true_false', label: 'True or False', icon: ToggleLeft },
  { id: 'enumeration', label: 'Enumeration', icon: ListOrdered },
];

export default function ManualQuizCreator({
  subjects
}: {
  subjects?: Array<{ id: string; name: string; color?: string }>;
}) {
  const router = useRouter();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [subjectList, setSubjectList] = useState<Array<{ id: string; name: string; color?: string }>>(subjects || []);
  const [subjectId, setSubjectId] = useState(subjects?.[0]?.id || '');
  const [subjectsLoading, setSubjectsLoading] = useState(!subjects || subjects.length === 0);
  const [showSubjectModal, setShowSubjectModal] = useState(false);
  const [pendingImport, setPendingImport] = useState<ParsedClipboard | null>(null);
  const [questions, setQuestions] = useState<QuestionDraft[]>([
    {
      type: 'multiple_choice',
      question_text: '',
      options: ['', '', '', ''],
      correct_answer: 0,
      explanation: ''
    }
  ]);
  const [draggedIdx, setDraggedIdx] = useState<number | null>(null);
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [draftRecovery, setDraftRecovery] = useState<ManualQuizDraft | null>(null);
  const [draftHydrated, setDraftHydrated] = useState(false);
  const [draftStatus, setDraftStatus] = useState<'idle' | 'saved' | 'error'>('idle');

  useEffect(() => {
    const requestedSubjectId = typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('subjectId') : null;
    if (subjects && subjects.length > 0) {
      setSubjectList(subjects);
      setSubjectsLoading(false);
      const requestedSubject = requestedSubjectId && subjects.some((subject) => subject.id === requestedSubjectId) ? requestedSubjectId : null;
      if (requestedSubject) setSubjectId(requestedSubject);
      else if (!subjectId) setSubjectId(subjects[0].id);
      return;
    }

    let cancelled = false;
    async function loadSubjects() {
      try {
        const res = await fetch('/api/subjects');
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelled && data.subjects) {
          setSubjectList(data.subjects);
          const requestedSubject = requestedSubjectId && data.subjects.some((subject: { id: string }) => subject.id === requestedSubjectId) ? requestedSubjectId : null;
          if (requestedSubject) setSubjectId(requestedSubject);
          else if (!subjectId && data.subjects.length > 0) {
            setSubjectId(data.subjects[0].id);
          }
        }
      } catch {
        // Fallback gracefully
      } finally {
        if (!cancelled) setSubjectsLoading(false);
      }
    }
    loadSubjects();
    return () => {
      cancelled = true;
    };
  }, [subjects]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      setDraftHydrated(true);
      return;
    }

    const draft = parseManualQuizDraft(window.localStorage.getItem(MANUAL_DRAFT_STORAGE_KEY));
    if (draft) {
      setDraftRecovery(draft);
    } else {
      window.localStorage.removeItem(MANUAL_DRAFT_STORAGE_KEY);
      setDraftHydrated(true);
    }
  }, []);

  useEffect(() => {
    if (!draftHydrated || typeof window === 'undefined') return;

    const hasContent = Boolean(
      title.trim() ||
      description.trim() ||
      questions.some((question) => question.question_text.trim() || question.options.some((option) => option.trim()))
    );
    if (!hasContent) return;

    const timeout = window.setTimeout(() => {
      try {
        const draft: ManualQuizDraft = {
          version: 1,
          updatedAt: new Date().toISOString(),
          title,
          description,
          subjectId,
          questions
        };
        window.localStorage.setItem(MANUAL_DRAFT_STORAGE_KEY, JSON.stringify(draft));
        setDraftStatus('saved');
      } catch {
        setDraftStatus('error');
      }
    }, 500);

    return () => window.clearTimeout(timeout);
  }, [draftHydrated, title, description, subjectId, questions]);

  function restoreDraft() {
    if (!draftRecovery) return;
    setTitle(draftRecovery.title);
    setDescription(draftRecovery.description);
    setSubjectId(draftRecovery.subjectId);
    setQuestions(draftRecovery.questions);
    setDraftRecovery(null);
    setDraftHydrated(true);
    setDraftStatus('saved');
  }

  function discardDraft() {
    if (typeof window !== 'undefined') {
      window.localStorage.removeItem(MANUAL_DRAFT_STORAGE_KEY);
    }
    setDraftRecovery(null);
    setDraftHydrated(true);
    setDraftStatus('idle');
  }
  function moveQuestion(fromIndex: number, toIndex: number) {
    if (toIndex < 0 || toIndex >= questions.length || fromIndex === toIndex) return;
    const next = [...questions];
    const [moved] = next.splice(fromIndex, 1);
    next.splice(toIndex, 0, moved);
    setQuestions(next);
  }

  function addQuestion() {
    setQuestions((current) => [
      ...current,
      {
        type: 'multiple_choice',
        question_text: '',
        options: ['', '', '', ''],
        correct_answer: 0,
        explanation: ''
      }
    ]);
  }

  function removeQuestion(index: number) {
    if (questions.length <= 1) return;
    setQuestions((current) => current.filter((_, i) => i !== index));
  }

  function setQuestionType(index: number, type: QuestionType) {
    const next = [...questions];
    const current = next[index];
    let newOptions = current.options;
    let newCorrect = current.correct_answer;
    let newQuestionText = current.question_text;

    if (type === 'multiple_choice') {
      if (newOptions.length < 4) {
        newOptions = [...newOptions, '', '', '', ''].slice(0, 4);
      } else if (newOptions.length > 4) {
        newOptions = newOptions.slice(0, 4);
      }
      newCorrect = Math.min(newCorrect, 3);
    } else if (type === 'true_false') {
      const termCandidate = current.type === 'identification'
        ? (current.options[0] || '')
        : (current.options[current.correct_answer] || current.options[0] || '');

      if (termCandidate.trim() && current.question_text.trim()) {
        newQuestionText = QuizTransformService.paraphraseToStatement(current.question_text, termCandidate.trim());
      }
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
      question_text: newQuestionText,
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

  function updateExplanation(index: number, text: string) {
    const next = [...questions];
    next[index].explanation = text;
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

  function applyQuestionAnswer(qIdx: number, question: string, answer: string) {
    const next = [...questions];
    next[qIdx] = {
      ...next[qIdx],
      type: 'identification',
      question_text: question,
      options: [answer],
      correct_answer: 0
    };
    setQuestions(next);
  }

  function handlePromptPaste(qIdx: number, e: React.ClipboardEvent<HTMLInputElement>) {
    const text = e.clipboardData.getData('text');
    if (!text) return;

    const parsed = parseSmartClipboard(text);
    if (parsed && parsed.type === 'question_answer') {
      e.preventDefault();
      applyQuestionAnswer(qIdx, parsed.question, parsed.answer);
      return;
    }

    if (parsed && parsed.type === 'single_pair') {
      e.preventDefault();
      const next = [...questions];
      next[qIdx] = {
        ...next[qIdx],
        type: 'identification',
        question_text: QuizTransformService.phraseIdentificationPrompt(parsed.definition, parsed.term),
        options: [parsed.term],
        correct_answer: 0
      };
      setQuestions(next);
      return;
    }

    if (parsed && (parsed.type === 'bulk_terms' || parsed.type === 'question_answers' || parsed.type === 'enumeration_blocks')) {
      e.preventDefault();
      setPendingImport(parsed);
    }
  }

  function handleTargetAnswerPaste(qIdx: number, e: React.ClipboardEvent<HTMLInputElement>) {
    const text = e.clipboardData.getData('text');
    if (!text) return;

    const parsed = parseSmartClipboard(text);
    if (parsed && parsed.type === 'question_answer') {
      e.preventDefault();
      applyQuestionAnswer(qIdx, parsed.question, parsed.answer);
      return;
    }

    if (parsed && parsed.type === 'single_pair') {
      e.preventDefault();
      const next = [...questions];
      next[qIdx] = {
        ...next[qIdx],
        type: 'identification',
        question_text: QuizTransformService.phraseIdentificationPrompt(parsed.definition, parsed.term),
        options: [parsed.term],
        correct_answer: 0
      };
      setQuestions(next);
      return;
    }

    if (parsed && (parsed.type === 'bulk_terms' || parsed.type === 'question_answers' || parsed.type === 'enumeration_blocks')) {
      e.preventDefault();
      setPendingImport(parsed);
    }
  }

  function handleContainerPaste(e: React.ClipboardEvent<HTMLDivElement>) {
    const target = e.target as HTMLElement;
    // If user is pasting into title, description, or subject selector, do not intercept
    if (target.closest('[data-skip-clipboard-intercept="true"]')) return;

    const text = e.clipboardData.getData('text');
    if (!text) return;

    const parsed = parseSmartClipboard(text);
    if (parsed && (parsed.type === 'bulk_terms' || parsed.type === 'question_answers' || parsed.type === 'enumeration_blocks')) {
      e.preventDefault();
      setPendingImport(parsed);
    }
  }

  function applyPendingImport() {
    if (!pendingImport) return;

    if (pendingImport.type === 'bulk_terms') {
      const newCards: QuestionDraft[] = pendingImport.items.map((item) => ({
        type: 'identification',
        question_text: QuizTransformService.phraseIdentificationPrompt(item.definition, item.term),
        options: [item.term],
        correct_answer: 0,
        explanation: ''
      }));

      // If existing list only contains 1 empty initial card, replace it
      const isFirstEmpty =
        questions.length === 1 &&
        !questions[0].question_text.trim() &&
        questions[0].options.every((o) => !o.trim());

      setQuestions((prev) => (isFirstEmpty ? newCards : [...prev, ...newCards]));
    } else if (pendingImport.type === 'question_answers') {
      const newCards: QuestionDraft[] = pendingImport.items.map((item) => ({
        type: 'identification',
        question_text: item.question,
        options: [item.answer],
        correct_answer: 0,
        explanation: ''
      }));

      const isFirstEmpty =
        questions.length === 1 &&
        !questions[0].question_text.trim() &&
        questions[0].options.every((o) => !o.trim());

      setQuestions((prev) => (isFirstEmpty ? newCards : [...prev, ...newCards]));
    } else if (pendingImport.type === 'enumeration_blocks') {
      const newCards: QuestionDraft[] = pendingImport.blocks.map((block) => ({
        type: 'enumeration',
        question_text: `Enumerate: ${block.header}`,
        options: block.items.length > 0 ? [...block.items] : ['', ''],
        correct_answer: 0,
        explanation: ''
      }));

      const isFirstEmpty =
        questions.length === 1 &&
        !questions[0].question_text.trim() &&
        questions[0].options.every((o) => !o.trim());

      setQuestions((prev) => (isFirstEmpty ? newCards : [...prev, ...newCards]));
    }

    setPendingImport(null);
  }

  async function handleSave() {
    if (!title.trim()) {
      setError('Please provide a title for the study set.');
      return;
    }

    const payloadQuestions = [];
    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];
      if (!q.question_text.trim()) {
        setError(`Question #${i + 1} is missing question text.`);
        return;
      }

      let opts = q.options.map((o) => o.trim());
      let correct = q.correct_answer;
      let answerText = '';
      let questionType: 'multiple_choice' | 'typed_answer' = 'multiple_choice';

      if (q.type === 'multiple_choice') {
        if (!opts[correct]) {
          setError(`Question #${i + 1} must have a filled correct choice. Other choices may be left blank.`);
          return;
        }
        answerText = opts[correct];
        questionType = 'multiple_choice';
      } else if (q.type === 'true_false') {
        opts = ['True', 'False'];
        answerText = correct === 1 ? 'False' : 'True';
        questionType = 'multiple_choice';
      } else if (q.type === 'identification') {
        if (!opts[0]) {
          setError(`Question #${i + 1} is missing the target identification answer.`);
          return;
        }
        answerText = opts[0];
        opts = [opts[0]];
        correct = 0;
        questionType = 'typed_answer';
      } else if (q.type === 'enumeration') {
        const filled = opts.filter(Boolean);
        if (filled.length === 0) {
          setError(`Question #${i + 1} must have at least one enumeration item.`);
          return;
        }
        opts = filled;
        answerText = filled.join(', ');
        correct = 0;
        questionType = 'typed_answer';
      }

      payloadQuestions.push({
        question_text: q.question_text.trim(),
        answer_text: answerText,
        question_type: questionType,
        options: opts,
        correct_answer: correct,
        explanation: q.explanation?.trim() || null,
        source_pages: null
      });
    }

    setSaving(true);
    setError(null);

    try {
      const res = await fetch('/api/quizzes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim() || null,
          subject_id: subjectId || null,
          source_model: 'manual',
          questions: payloadQuestions
        })
      });

      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error || 'Failed to create study set.');
      window.localStorage.removeItem(MANUAL_DRAFT_STORAGE_KEY);
      router.push(`/quizzes/${data.id}`);
    } catch (err: any) {
      setError(err.message || 'Failed to save study set.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      onPaste={handleContainerPaste}
      className="max-w-4xl mx-auto space-y-6 pb-32 sm:pb-36 relative"
    >
      {/* Smart Clipboard Import Preview Modal / Banner */}
      {pendingImport && (
        <div className="sticky top-4 z-40 rounded-3xl border border-primary/30 bg-card/95 backdrop-blur-md p-5 shadow-2xl ring-1 ring-primary/20 space-y-3 animate-in fade-in slide-in-from-top-3 duration-200">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                <Sparkles className="h-5 w-5" />
              </div>
              <div>
                <h4 className="text-sm font-extrabold text-foreground flex items-center gap-2">
                  <span>Smart Clipboard Detected</span>
                  <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-primary/15 text-primary">
                    {pendingImport.type === 'bulk_terms'
                      ? 'Term/Definition List'
                      : pendingImport.type === 'question_answers'
                      ? 'Question/Answer List'
                      : 'Slide Enumeration'}
                  </span>
                </h4>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {pendingImport.type === 'bulk_terms'
                    ? `✨ Detected ${pendingImport.items.length} Term/Definition pairs ready to convert into identification cards.`
                    : pendingImport.type === 'question_answers'
                    ? `✨ Detected ${pendingImport.items.length} numbered question/answer pairs ready to import.`
                    : pendingImport.type === 'enumeration_blocks'
                    ? `✨ Detected ${pendingImport.blocks.length} Enumeration group(s) (${pendingImport.blocks.map((b) => b.header).slice(0, 2).join(', ')}${pendingImport.blocks.length > 2 ? '...' : ''}) ready to convert.`
                    : '✨ Detected structured text ready to convert.'}
                </p>
              </div>  
            </div>

            <button
              type="button"
              onClick={() => setPendingImport(null)}
              className="text-muted-foreground hover:text-foreground p-1 rounded-xl hover:bg-muted transition-colors cursor-pointer"
              title="Dismiss"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="flex items-center justify-end gap-2.5 pt-1">
            <button
              type="button"
              onClick={() => setPendingImport(null)}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-muted transition-all cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={applyPendingImport}
              className="px-5 py-2 rounded-xl bg-primary text-white text-xs font-bold shadow-md shadow-primary/20 hover:bg-primary/90 transition-all flex items-center gap-2 active:scale-95 cursor-pointer"
            >
              <ClipboardPaste className="h-4 w-4" />
              <span>
                {pendingImport.type === 'bulk_terms'
                  ? `Import ${pendingImport.items.length} Question Cards`
                  : pendingImport.type === 'question_answers'
                  ? `Import ${pendingImport.items.length} Question Cards`
                  : pendingImport.type === 'enumeration_blocks'
                  ? `Import ${pendingImport.blocks.length} Enumeration Cards`
                  : 'Import Cards'}
              </span>
            </button>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between gap-3">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-xs font-semibold text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Hub
        </Link>
        <div className="flex items-center gap-2.5">
          {draftStatus === 'saved' && (
            <span className="text-[11px] font-semibold text-muted-foreground">Draft saved locally</span>
          )}
          {draftStatus === 'error' && (
            <span className="text-[11px] font-semibold text-amber-600 dark:text-amber-400">Draft could not be saved</span>
          )}
        </div>
      </div>

      {draftRecovery && (
        <div className="flex flex-col gap-3 rounded-2xl border border-primary/30 bg-primary/5 p-4 text-xs sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="font-bold text-foreground">Unsaved draft found</p>
            <p className="mt-0.5 text-muted-foreground">
              Last saved {new Date(draftRecovery.updatedAt).toLocaleString()}. Restore it to continue where you left off.
            </p>
          </div>
          <div className="flex shrink-0 gap-2">
            <button
              type="button"
              onClick={discardDraft}
              className="rounded-xl px-3 py-1.5 font-semibold text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              Discard
            </button>
            <button
              type="button"
              onClick={restoreDraft}
              className="rounded-xl bg-primary px-3 py-1.5 font-bold text-white transition-colors hover:bg-primary/90"
            >
              Restore draft
            </button>
          </div>
        </div>
      )}

      {error && (
        <div className="rounded-2xl border border-destructive/30 bg-destructive/10 p-3 text-xs font-semibold text-destructive">
          {error}
        </div>
      )}

      {/* Quiz metadata */}
      <div
        data-skip-clipboard-intercept="true"
        className="rounded-3xl border border-border/80 bg-card p-6 shadow-sm space-y-4"
      >
        <div className="flex items-center gap-2">
          <Tag className="h-4 w-4 text-primary" />
          <h2 className="text-base font-bold text-foreground">Quiz Details</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="md:col-span-2 space-y-3">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1">
                Quiz Title <span className="text-destructive">*</span>
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
                Description <span className="font-normal normal-case tracking-normal">(optional)</span>
              </label>
              <input
                type="text"
                placeholder="Brief summary of what this reviewer covers"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full rounded-2xl border border-border bg-background px-4 py-2 text-xs font-medium text-foreground focus:border-primary focus:outline-none"
              />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Subject Category
              </label>
              <button
                type="button"
                onClick={() => setShowSubjectModal(true)}
                className="text-[11px] font-bold text-primary hover:underline flex items-center gap-1 transition-all"
              >
                <Plus className="h-3 w-3" />
                <span>New Subject</span>
              </button>
            </div>
            <div className="relative flex items-center">
              <select
                value={subjectId}
                onChange={(e) => setSubjectId(e.target.value)}
                aria-busy={subjectsLoading}
                className="w-full rounded-2xl border border-border bg-background pl-4 pr-8 py-2.5 text-xs font-medium text-foreground focus:border-primary focus:outline-none cursor-pointer"
              >
                <option value="">General (No Subject)</option>
                {subjectList.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
            {subjectsLoading && (
              <p role="status" className="mt-2 flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground">
                <span
                  aria-hidden="true"
                  className="h-3 w-3 animate-spin rounded-full border-2 border-primary border-t-transparent"
                />
                Loading subjects...
              </p>
            )}
            {/* Active subject color tag */}
            {subjectId && (
              <div className="mt-2 flex items-center gap-1.5">
                {(() => {
                  const currentSub = subjectList.find((s) => s.id === subjectId);
                  if (!currentSub) return null;
                  return (
                    <span
                      style={{
                        backgroundColor: currentSub.color || '#86EFAC',
                        color: '#1e293b'
                      }}
                      className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold shadow-2xs"
                    >
                      <Tag className="h-2.5 w-2.5" />
                      {currentSub.name}
                    </span>
                  );
                })()}
              </div>
            )}
          </div>
        </div>
      </div>

      <NewSubjectModal
        open={showSubjectModal}
        onOpenChange={setShowSubjectModal}
        onCreated={(created) => {
          setSubjectList((prev) => [...prev, created]);
          setSubjectId(created.id);
        }}
      />

      {!showSubjectModal && (
        <StickyActionDock
          onAction={handleSave}
          disabled={saving}
          ariaLabel="Save and publish quiz"
          message="Your quiz is saved locally while you work"
          buttonText={saving ? 'Saving...' : 'Save & Publish Quiz'}
          icon={<Save className="h-4 w-4" />}
        />
      )}

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
                  <span
                    draggable
                    onDragStart={(e) => {
                      e.dataTransfer.effectAllowed = 'move';
                      setDraggedIdx(qIdx);
                    }}
                    onDragEnd={() => {
                      setDraggedIdx(null);
                      setDragOverIdx(null);
                    }}
                    className="flex items-center justify-center w-7 h-7 rounded-xl bg-primary/10 text-primary text-xs font-extrabold shrink-0 select-none cursor-grab active:cursor-grabbing"
                    title="Drag to reorder question"
                    aria-label={`Drag question ${qIdx + 1} to reorder`}
                  >
                    #{qIdx + 1}
                  </span>

                  <span className="text-xs font-bold text-muted-foreground">Question:</span>
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
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
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
                    type="button"
                    onClick={() => removeQuestion(qIdx)}
                    className="text-muted-foreground hover:text-destructive p-1.5 rounded-xl hover:bg-destructive/10 transition-colors ml-auto sm:ml-0 cursor-pointer"
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
                  placeholder="Enter your question prompt (or paste term/definition pair)..."
                  value={q.question_text}
                  onChange={(e) => updateQuestionText(qIdx, e.target.value)}
                  onPaste={(e) => handlePromptPaste(qIdx, e)}
                  className="w-full rounded-2xl border border-border bg-background px-4 py-2.5 text-xs font-medium text-foreground focus:border-primary focus:outline-none"
                />
              </div>

              {/* Dynamic Type Body */}
              {q.type === 'multiple_choice' && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-[11px] font-semibold text-muted-foreground">
                    <span>Choice Options</span>
                    <span className="italic">Select the entire option card to mark the correct answer</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {q.options.map((opt, optIdx) => {
                      const isSelected = q.correct_answer === optIdx;
                      return (
                        <div
                          key={optIdx}
                          onClick={() => setCorrectOption(qIdx, optIdx)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault();
                              setCorrectOption(qIdx, optIdx);
                            }
                          }}
                          tabIndex={0}
                          role="radio"
                          aria-checked={isSelected}
                          className={`flex items-center gap-3 rounded-2xl border p-3 cursor-pointer transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
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
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault();
                              setCorrectOption(qIdx, tf.val);
                            }
                          }}
                          tabIndex={0}
                          role="radio"
                          aria-checked={isSelected}
                          className={`flex items-center justify-center gap-2.5 rounded-2xl border py-4 px-4 cursor-pointer font-bold text-xs transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
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
                    onPaste={(e) => handleTargetAnswerPaste(qIdx, e)}
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
                      className="flex items-center gap-1 text-primary hover:underline text-xs font-bold cursor-pointer"
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
                            className="text-muted-foreground hover:text-destructive p-1.5 rounded-lg hover:bg-destructive/10 transition-colors cursor-pointer"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Explanation Field */}
              <div>
                <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Explanation <span className="font-normal normal-case tracking-normal">(optional)</span>
                </label>
                <input
                  type="text"
                  placeholder="Explain why this answer is correct..."
                  value={q.explanation || ''}
                  onChange={(e) => updateExplanation(qIdx, e.target.value)}
                  className="w-full rounded-2xl border border-border bg-background px-4 py-2 text-xs font-medium text-foreground focus:border-primary focus:outline-none"
                />
              </div>
            </div>
          );
        })}

        <button
          type="button"
          onClick={addQuestion}
          className="w-full py-4 rounded-3xl border border-dashed border-border bg-card/50 text-xs font-bold uppercase tracking-wider text-muted-foreground hover:text-foreground hover:bg-muted/30 transition-all flex items-center justify-center gap-2 cursor-pointer"
        >
          <Plus className="h-4 w-4" />
          <span>Add Another Question</span>
        </button>
      </div>
    </div>
  );
}
