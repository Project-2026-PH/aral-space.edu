'use client';

import React, { useState, useEffect, useRef } from 'react';
import Modal from '../ui/Modal';
import ConfirmModal from '../ui/ConfirmModal';
import { QuizQuestion } from '@quiz-creator/types';
import { makeAuthoringQuestionSnapshot, recordLocalAuthoringEvent } from '@/lib/authoringPreferences';
import { Plus, X, Check, CircleDot, PenLine, ToggleLeft, ListOrdered, Trash2 } from 'lucide-react';
import RichTextEditor from '@/components/editor/RichTextEditor';
import { hasRichTextContent } from '@/lib/richText';
import { parseSmartClipboard } from '@/lib/clipboardParser';
import { parseWithSmolLM2 } from '@/lib/ai/localClipboardParser';
import { createClipboardAuthoringCard, type ClipboardAuthoringCard } from '@/lib/clipboardAuthoring';

export type QuestionType = 'multiple_choice' | 'typed_answer' | 'identification' | 'true_false' | 'enumeration';

const QUESTION_TYPES: { id: QuestionType; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: 'identification', label: 'Identification', icon: PenLine },
  { id: 'true_false', label: 'True or False', icon: ToggleLeft },
  { id: 'enumeration', label: 'Enumeration', icon: ListOrdered },
];

function detectQuestionType(question: QuizQuestion): QuestionType {
  if (question.question_type === 'enumeration') {
    return 'enumeration';
  }

  const options = question.options || [];
  if (
    options.length === 2 &&
    options[0]?.toLowerCase() === 'true' &&
    options[1]?.toLowerCase() === 'false'
  ) {
    return 'true_false';
  }
  if (options.length === 1) {
    return 'identification';
  }
  if (options.length > 4) {
    return 'enumeration';
  }
  if (options.length === 0 && question.answer_text) {
    return 'typed_answer';
  }
  if (question.question_type === 'typed_answer') {
    return 'typed_answer';
  }
  return 'multiple_choice';
}

interface QuizQuestionFormModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  question?: QuizQuestion | null;
  quizId: string;
  subjectId?: string | null;
  userId?: string | null;
  onSaved: (savedQuestion?: QuizQuestion) => void;
  onDeleted?: (deletedId?: string) => void;
}

export default function QuizQuestionFormModal({
  open,
  onOpenChange,
  question,
  quizId,
  subjectId,
  userId,
  onSaved,
  onDeleted
}: QuizQuestionFormModalProps) {
  const isEditing = Boolean(question);
  const [type, setType] = useState<QuestionType>('identification');
  const [questionText, setQuestionText] = useState('');
  const [options, setOptions] = useState<string[]>(['']);
  const [correctAnswer, setCorrectAnswer] = useState<number>(0);
  const [answerText, setAnswerText] = useState<string>('');
  const [answerTerms, setAnswerTerms] = useState<string[]>([]);
  const [enumerationTotal, setEnumerationTotal] = useState('');
  const [enumerationDistractors, setEnumerationDistractors] = useState<string[]>([]);
  const [explanation, setExplanation] = useState<string>('');
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pasteRequestRef = useRef(0);
  const mountedRef = useRef(true);

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen) pasteRequestRef.current += 1;
    onOpenChange(nextOpen);
  }

  useEffect(() => {
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    pasteRequestRef.current += 1;
    if (question) {
      const detected = detectQuestionType(question);
      setType(detected);
      setQuestionText(question.question_text);
      setOptions(
        detected === 'typed_answer'
          ? []
          : detected === 'multiple_choice'
            ? (() => {
                const padded = [...question.options, '', '', '', ''].slice(0, 4);
                const correctIndex = Math.min(Math.max(question.correct_answer, 0), 3);
                if (!padded[correctIndex] && question.answer_text?.trim()) {
                  padded[correctIndex] = question.answer_text.trim();
                }
                return padded;
              })()
            : detected === 'identification'
              ? [question.options[0] || question.answer_text || '']
              : question.options
      );
      setCorrectAnswer(question.correct_answer);
      setAnswerText(question.answer_text || question.options[question.correct_answer] || '');
      const legacyTerms = Array.isArray(question.answer_terms) ? question.answer_terms : question.options;
      setAnswerTerms(detected === 'enumeration' ? [...legacyTerms] : []);
      setEnumerationTotal(detected === 'enumeration'
        ? (/^\d+$/.test((question.answer_text || '').trim()) ? (question.answer_text || '').trim() : String(legacyTerms.filter((term) => term.trim()).length))
        : '');
      setEnumerationDistractors(detected === 'enumeration' && Array.isArray(question.enumeration_distractors) ? [...question.enumeration_distractors] : []);
      setExplanation(question.explanation || '');
    } else {
      setType('identification');
      setQuestionText('');
      setOptions(['']);
      setCorrectAnswer(0);
      setAnswerText('');
      setAnswerTerms([]);
      setEnumerationTotal('');
      setEnumerationDistractors([]);
      setExplanation('');
    }
    setError(null);
    setDeleting(false);
    setShowDeleteConfirm(false);
  }, [question, open]);

  function handleTypeChange(newType: QuestionType) {
    pasteRequestRef.current += 1;
    let newOptions = options;
    let newCorrect = correctAnswer;

    if (newType === 'multiple_choice') {
      if (newOptions.length < 4) {
        newOptions = [...newOptions, '', '', '', ''].slice(0, 4);
      } else if (newOptions.length > 4) {
        newOptions = newOptions.slice(0, 4);
      }
      newCorrect = Math.min(newCorrect, 3);
      if (!newOptions.some((option) => option.trim()) && answerText.trim()) {
        newOptions[newCorrect] = answerText.trim();
      }
    } else if (newType === 'typed_answer') {
      setAnswerText(answerText || options[correctAnswer] || '');
      newOptions = [];
      newCorrect = 0;
    } else if (newType === 'true_false') {
      // Preserve the prompt and its rich-text formatting when changing modes.
      // Users can edit the wording directly if the statement needs adjustment.
      newOptions = ['True', 'False'];
      newCorrect = newCorrect === 1 ? 1 : 0;
    } else if (newType === 'identification') {
      newOptions = [newOptions[0] || answerText || ''];
      newCorrect = 0;
    } else if (newType === 'enumeration') {
      const legacyTerms = answerTerms.length > 0 ? answerTerms : newOptions.filter((option) => option.trim());
      setAnswerTerms(legacyTerms);
      setEnumerationTotal(enumerationTotal || String(legacyTerms.filter((term) => term.trim()).length));
      newOptions = [];
      newCorrect = 0;
    }

    setType(newType);
    setOptions(newOptions);
    setCorrectAnswer(newCorrect);
  }

  function applyClipboardCard(card: ClipboardAuthoringCard) {
    setType('identification');
    setQuestionText(card.question);
    setOptions([card.answer]);
    setCorrectAnswer(0);
    setAnswerText(card.answer);
  }

  function handleClipboardPaste(event: React.ClipboardEvent<HTMLElement>) {
    const text = event.clipboardData.getData('text');
    const html = event.clipboardData.getData('text/html');
    if (!text && !html) return;

    const parsed = parseSmartClipboard(text, html);
    const card = createClipboardAuthoringCard(parsed);
    if (card) {
      event.preventDefault();
      pasteRequestRef.current += 1;
      applyClipboardCard(card);
      return;
    }

    // Bulk/list/enumeration formats remain native because this modal edits one card.
    if (parsed) return;

    if (text && text.trim().length >= 15 && text.trim().length <= 800) {
      const requestId = ++pasteRequestRef.current;
      void parseWithSmolLM2(text)
        .then((aiParsed) => {
          if (
            !mountedRef.current ||
            requestId !== pasteRequestRef.current
          ) {
            return;
          }
          const aiCard = createClipboardAuthoringCard(aiParsed);
          if (aiCard) applyClipboardCard(aiCard);
        })
        .catch(() => {
          // Keep the browser's native paste when the local fallback fails.
        });
    }
  }

  async function handleSave() {
    if (!hasRichTextContent(questionText)) {
      setError('Please provide a question prompt.');
      return;
    }

    let cleanedOptions = options.map((o) => o.trim());
    let cleanedCorrect = correctAnswer;
    let cleanedAnswer = answerText.trim();

    if (type === 'multiple_choice') {
      if (cleanedOptions[cleanedCorrect]) {
        cleanedAnswer = cleanedOptions[cleanedCorrect];
      } else if (!cleanedAnswer) {
        setError('Please provide the correct answer or fill in the selected option. Other options may be left blank.');
        return;
      } else {
        // Keep sparse multiple-choice cards valid; review mode can add distractors later.
        cleanedCorrect = 0;
      }
    } else if (type === 'typed_answer') {
      if (!cleanedAnswer) {
        setError('Please enter the typed answer.');
        return;
      }
      cleanedOptions = [];
      cleanedCorrect = 0;
    } else if (type === 'true_false') {
      cleanedOptions = ['True', 'False'];
      cleanedAnswer = cleanedOptions[cleanedCorrect];
    } else if (type === 'identification') {
      if (!cleanedOptions[0]) {
        setError('Please enter the identification answer.');
        return;
      }
      cleanedOptions = [cleanedOptions[0]];
      cleanedCorrect = 0;
      cleanedAnswer = cleanedOptions[0];
    } else if (type === 'enumeration') {
      const filledTerms = answerTerms.map((term) => term.trim());
      const total = Number(enumerationTotal.trim());
      if (!Number.isSafeInteger(total) || total <= 0) {
        setError('Please provide a positive enumeration total.');
        return;
      }
      if (filledTerms.some((term) => !term) || filledTerms.length < total) {
        setError(`Please provide at least ${total} answer terms.`);
        return;
      }
      if (filledTerms.length > total) {
        setError(`Enumeration total is ${total}, but ${filledTerms.length} answer terms were provided.`);
        return;
      }
      cleanedOptions = [];
      cleanedCorrect = 0;
      cleanedAnswer = String(total);
    }

    setSaving(true);
    setError(null);

    const payload = {
      question_text: questionText.trim(),
      answer_text: cleanedAnswer || null,
      question_type: type === 'enumeration'
        ? 'enumeration' as const
        : type === 'typed_answer' || type === 'identification' ? 'typed_answer' as const : 'multiple_choice' as const,
      options: cleanedOptions,
      ...(type === 'enumeration' ? {
        answer_terms: answerTerms.map((term) => term.trim()),
        enumeration_distractors: enumerationDistractors.map((term) => term.trim()).filter(Boolean)
      } : {}),
      correct_answer: cleanedCorrect,
      explanation: explanation.trim() || null
    };

    try {
      const url = isEditing && question
        ? `/api/quizzes/${quizId}/questions/${question.id}`
        : `/api/quizzes/${quizId}/questions`;
      const res = await fetch(url, {
        method: isEditing && question ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error || (isEditing ? 'Failed to update question' : 'Failed to create question'));

      recordLocalAuthoringEvent(
        {
          action: isEditing ? 'edit' : 'create',
          before: question
            ? makeAuthoringQuestionSnapshot(
                detectQuestionType(question),
                question.question_text,
                question.options || [],
                question.explanation
              )
            : undefined,
          after: makeAuthoringQuestionSnapshot(type, questionText, cleanedOptions, explanation)
        },
        { userId, subjectId }
      );
      handleOpenChange(false);
      onSaved(data);
    } catch (err: any) {
      setError(err.message || 'Error saving question');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!question) return;

    setDeleting(true);
    setError(null);

    try {
      const res = await fetch(`/api/quizzes/${quizId}/questions/${question.id}`, {
        method: 'DELETE'
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error || 'Failed to delete question');

      recordLocalAuthoringEvent(
        {
          action: 'delete',
          before: makeAuthoringQuestionSnapshot(
            detectQuestionType(question),
            question.question_text,
            question.options || [],
            question.explanation
          )
        },
        { userId, subjectId }
      );
      handleOpenChange(false);
      onDeleted?.(question.id);
    } catch (err: any) {
      setError(err.message || 'Failed to delete question');
    } finally {
      setDeleting(false);
    }
  }

  return (
    <Modal
      open={open}
      onOpenChange={handleOpenChange}
      title={isEditing ? 'Edit Question' : 'Add Question'}
      description="Configure question prompt, category mode, and correct answers."
    >
      <div className="space-y-4">
        {error && (
          <div className="rounded-2xl border border-destructive/30 bg-destructive/10 p-3 text-xs font-semibold text-destructive">
            {error}
          </div>
        )}

        {/* Category Badges */}
        <div className="space-y-1.5">
          <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground">
            Category / Mode
          </label>
          <div className="flex flex-wrap gap-1.5">
            {QUESTION_TYPES.map((t) => {
              const isActive = type === t.id;
              const Icon = t.icon;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => handleTypeChange(t.id)}
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
        </div>

          <div>
            <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Question Prompt
            </label>
            <RichTextEditor
              value={questionText}
              onChange={(value) => {
                pasteRequestRef.current += 1;
                setQuestionText(value);
              }}
              onPaste={handleClipboardPaste}
              placeholder="Type question prompt here..."
              minHeight="120px"
              data-skip-clipboard-intercept="true"
              hideToolbarUntilFocus
            />
          </div>

        {/* Dynamic Type Inputs */}
        {type === 'multiple_choice' && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider text-muted-foreground">
              <span>Options & Correct Answer</span>
              <span className="text-[11px] font-normal lowercase italic text-muted-foreground">select the entire option card to mark it correct</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {options.map((opt, idx) => {
                const isSelected = correctAnswer === idx;
                return (
                  <div
                    key={idx}
                    onClick={() => {
                      setCorrectAnswer(idx);
                      if (opt.trim()) setAnswerText(opt);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        setCorrectAnswer(idx);
                        if (opt.trim()) setAnswerText(opt);
                      }
                    }}
                    tabIndex={0}
                    role="radio"
                    aria-checked={isSelected}
                    className={`flex items-center gap-2 rounded-2xl border p-2.5 cursor-pointer transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
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
                        pasteRequestRef.current += 1;
                        const next = [...options];
                        next[idx] = e.target.value;
                        setOptions(next);
                        if (idx === correctAnswer) setAnswerText(e.target.value);
                      }}
                      className="w-full bg-transparent text-xs text-foreground focus:outline-none"
                    />
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {type === 'true_false' && (
          <div className="space-y-2">
            <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Correct Answer
            </label>
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: 'True', val: 0, color: 'text-emerald-500', activeBg: 'border-emerald-500 bg-emerald-500/10 ring-1 ring-emerald-500' },
                { label: 'False', val: 1, color: 'text-rose-500', activeBg: 'border-rose-500 bg-rose-500/10 ring-1 ring-rose-500' }
              ].map((tf) => {
                const isSelected = correctAnswer === tf.val;
                return (
                  <div
                    key={tf.val}
                    onClick={() => setCorrectAnswer(tf.val)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        setCorrectAnswer(tf.val);
                      }
                    }}
                    tabIndex={0}
                    role="radio"
                    aria-checked={isSelected}
                    className={`flex items-center justify-center gap-2 rounded-2xl border py-3.5 px-4 cursor-pointer font-bold text-xs transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                      isSelected
                        ? tf.activeBg
                        : 'border-border bg-background hover:bg-muted/40 text-muted-foreground'
                    }`}
                  >
                    <div
                      className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 ${
                        isSelected ? 'border-current bg-current text-card' : 'border-muted-foreground'
                      }`}
                    >
                      {isSelected && <Check className="w-3 h-3 text-white" />}
                    </div>
                    <span className={isSelected ? tf.color : ''}>{tf.label}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {type === 'typed_answer' && (
          <div className="space-y-1.5">
            <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Answer Learners Must Type
            </label>
            <input
              type="text"
              placeholder="e.g. Photosynthesis"
              value={answerText}
              onChange={(e) => {
                pasteRequestRef.current += 1;
                setAnswerText(e.target.value);
              }}
              onPaste={handleClipboardPaste}
              className="w-full rounded-2xl border border-primary/30 bg-primary/5 px-4 py-2.5 text-xs font-semibold text-foreground focus:border-primary focus:outline-none"
            />
            <p className="text-[11px] text-muted-foreground">
              Learn mode uses this explicit answer instead of requiring multiple-choice options.
            </p>
          </div>
        )}

        {type === 'identification' && (
          <div className="space-y-1.5">
            <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Target Identification Answer
            </label>
            <input
              type="text"
              placeholder="e.g. Photosynthesis"
              value={options[0] || ''}
              onChange={(e) => {
                pasteRequestRef.current += 1;
                setOptions([e.target.value]);
                setAnswerText(e.target.value);
              }}
              onPaste={handleClipboardPaste}
              className="w-full rounded-2xl border border-primary/30 bg-primary/5 px-4 py-2.5 text-xs font-semibold text-foreground focus:border-primary focus:outline-none"
            />
          </div>
        )}

        {type === 'enumeration' && (
          <div className="space-y-3">
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <div className="space-y-1.5">
                <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground">Total terms</label>
                <input type="number" min="1" step="1" value={enumerationTotal} onChange={(event) => { pasteRequestRef.current += 1; setEnumerationTotal(event.target.value); }} className="w-full rounded-xl border border-primary/30 bg-primary/5 px-3 py-2 text-xs font-semibold text-foreground focus:border-primary focus:outline-none" />
              </div>
              <div className="flex items-end pb-1 text-[11px] text-muted-foreground">Options are stored empty; terms are the canonical answer key.</div>
            </div>
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Answer terms</label>
              <button type="button" onClick={() => setAnswerTerms([...answerTerms, ''])} className="flex items-center gap-1 text-xs font-bold text-primary hover:underline"><Plus className="h-3.5 w-3.5" />Add term</button>
            </div>
            <div className="max-h-48 space-y-2 overflow-y-auto pr-1">
              {answerTerms.map((term, index) => (
                <div key={index} className="flex items-center gap-2">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-muted text-[11px] font-bold text-muted-foreground">{index + 1}</span>
                  <input type="text" placeholder={`Term #${index + 1}`} value={term} onChange={(event) => { pasteRequestRef.current += 1; const next = [...answerTerms]; next[index] = event.target.value; setAnswerTerms(next); }} className="flex-1 rounded-xl border border-border bg-background px-3 py-1.5 text-xs font-medium text-foreground focus:border-primary focus:outline-none" />
                  {answerTerms.length > 1 && <button type="button" onClick={() => setAnswerTerms(answerTerms.filter((_, itemIndex) => itemIndex !== index))} className="rounded-lg p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"><X className="h-3.5 w-3.5" /></button>}
                </div>
              ))}
            </div>
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Distractors (optional)</label>
              <button type="button" onClick={() => setEnumerationDistractors([...enumerationDistractors, ''])} className="flex items-center gap-1 text-xs font-bold text-primary hover:underline"><Plus className="h-3.5 w-3.5" />Add distractor</button>
            </div>
            {enumerationDistractors.map((term, index) => <div key={index} className="flex items-center gap-2"><input type="text" placeholder="Wrong choice" value={term} onChange={(event) => { pasteRequestRef.current += 1; const next = [...enumerationDistractors]; next[index] = event.target.value; setEnumerationDistractors(next); }} className="flex-1 rounded-xl border border-border bg-background px-3 py-1.5 text-xs font-medium text-foreground focus:border-primary focus:outline-none" /><button type="button" onClick={() => setEnumerationDistractors(enumerationDistractors.filter((_, itemIndex) => itemIndex !== index))} className="rounded-lg p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"><X className="h-3.5 w-3.5" /></button></div>)}
          </div>
        )}

        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1.5">
            Explanation
          </label>
          <RichTextEditor
            value={explanation}
            onChange={(value) => {
              pasteRequestRef.current += 1;
              setExplanation(value);
            }}
            placeholder="Why is the chosen option correct?"
            minHeight="90px"
            data-skip-clipboard-intercept="true"
            hideToolbarUntilFocus
          />
        </div>

        <div className="flex items-center justify-between gap-2 pt-2">
          {isEditing ? (
            <button
              type="button"
              onClick={() => setShowDeleteConfirm(true)}
              disabled={saving || deleting}
              className="inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-bold text-destructive hover:bg-destructive/10 transition-colors disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Trash2 className="h-3.5 w-3.5" />
              {deleting ? 'Deleting...' : 'Delete Question'}
            </button>
          ) : (
            <span />
          )}
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => handleOpenChange(false)}
              disabled={saving || deleting}
              className="rounded-xl px-4 py-2 text-xs font-semibold text-muted-foreground hover:bg-muted transition-colors disabled:cursor-not-allowed disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving || deleting}
              className="rounded-xl bg-primary px-4 py-2 text-xs font-bold text-white shadow-sm transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {saving ? 'Saving...' : isEditing ? 'Save Changes' : 'Add Question'}
            </button>
          </div>
        </div>
      </div>

      <ConfirmModal
        open={showDeleteConfirm}
        onOpenChange={setShowDeleteConfirm}
        onConfirm={handleDelete}
        title="Delete Question"
        message="Are you sure you want to permanently remove this question from the quiz?"
        destructive
        confirmText="Delete Question"
      />
    </Modal>
  );
}
