'use client';

import React, { useState, useEffect } from 'react';
import { Quiz, QuizQuestion, QuizSession } from '@quiz-creator/types';
import QuizQuestionList from './QuizQuestionList';
import QuizQuestionFormModal from './QuizQuestionFormModal';
import QuizStartConfigModal from './QuizStartConfigModal';
import ShareQuizModal from './ShareQuizModal';
import QuizExportMenu from './QuizExportMenu';
import ConfirmModal from '../ui/ConfirmModal';
import StickyActionDock from '../ui/StickyActionDock';
import FloatingBottomNav from '../navigation/FloatingBottomNav';
import { Play, Plus, Edit, Trash2, ArrowLeft, Share2, Save, Check, FileText, Upload, X } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { publishLibraryMutation } from '@/lib/libraryMutationStore';

const DEFAULT_TERMS = [
  'Prelim',
  'Midterm',
  'Semi-Final',
  'Finals',
  '1st Grading',
  '2nd Grading',
  '3rd Grading',
  '4th Grading',
  'Quarter 1',
  'Quarter 2',
  'Quarter 3',
  'Quarter 4'
];

const CUSTOM_TERMS_STORAGE_KEY = 'quiz-creator:custom-terms:v1';

interface QuizOverviewClientProps {
  quiz: Quiz;
  questions: QuizQuestion[];
  sessions: QuizSession[];
  readOnly?: boolean;
  canDelete?: boolean;
  canManageSharing?: boolean;
}

export default function QuizOverviewClient({
  quiz: initialQuiz,
  questions: initialQuestions,
  sessions: initialSessions,
  readOnly = false,
  canDelete = !readOnly,
  canManageSharing = !readOnly
}: QuizOverviewClientProps) {
  const router = useRouter();
  const [quiz, setQuiz] = useState<Quiz>(initialQuiz);
  const [questions, setQuestions] = useState<QuizQuestion[]>(initialQuestions);
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [titleInput, setTitleInput] = useState(quiz.title);
  const [savingTitle, setSavingTitle] = useState(false);
  const [isEditingDesc, setIsEditingDesc] = useState(false);
  const [descInput, setDescInput] = useState(quiz.description || '');
  const [savingDesc, setSavingDesc] = useState(false);
  const [isEditingTerm, setIsEditingTerm] = useState(false);
  const [termInput, setTermInput] = useState(quiz.term || '');
  const [customTermVal, setCustomTermVal] = useState('');
  const [isCustomTerm, setIsCustomTerm] = useState(false);
  const [savingTerm, setSavingTerm] = useState(false);
  const [showQuestionModal, setShowQuestionModal] = useState(false);
  const [editingQuestion, setEditingQuestion] = useState<QuizQuestion | null>(null);
  const [showStartModal, setShowStartModal] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [showDeleteQuizModal, setShowDeleteQuizModal] = useState(false);
  const [savingHandout, setSavingHandout] = useState(false);
  const handoutInputRef = React.useRef<HTMLInputElement>(null);

  useEffect(() => {
    setQuiz(initialQuiz);
    setQuestions(initialQuestions);
    setTitleInput(initialQuiz.title);
    setDescInput(initialQuiz.description || '');
    setTermInput(initialQuiz.term || '');
  }, [initialQuiz, initialQuestions]);

  function handleQuestionSaved(savedQuestion?: QuizQuestion) {
    if (!savedQuestion?.id) return;

    const alreadyExists = questions.some((q) => q.id === savedQuestion.id);
    setQuestions((prev) => {
      if (prev.some((q) => q.id === savedQuestion.id)) {
        return prev.map((q) => (q.id === savedQuestion.id ? savedQuestion : q));
      }
      return [...prev, savedQuestion];
    });

    if (!alreadyExists) {
      const nextQuestionCount = questions.length + 1;
      setQuiz((prev) => ({ ...prev, question_count: nextQuestionCount }));
      publishLibraryMutation({
        type: 'quiz-updated',
        quiz: { id: quiz.id, question_count: nextQuestionCount }
      });
    }
  }

  function handleQuestionDeleted(deletedId?: string) {
    if (!deletedId || !questions.some((q) => q.id === deletedId)) return;

    setQuestions((prev) => prev.filter((q) => q.id !== deletedId));
    const nextQuestionCount = Math.max(questions.length - 1, 0);
    setQuiz((prev) => ({ ...prev, question_count: nextQuestionCount }));
    publishLibraryMutation({
      type: 'quiz-updated',
      quiz: { id: quiz.id, question_count: nextQuestionCount }
    });
  }

  async function handleSaveTitle() {
    if (!titleInput.trim()) return;
    setSavingTitle(true);
    try {
      const res = await fetch(`/api/quizzes/${quiz.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: titleInput.trim() })
      });
      if (res.ok) {
        const updated = await res.json();
        setQuiz(updated);
        publishLibraryMutation({ type: 'quiz-updated', quiz: updated });
        setTitleInput(updated.title);
        setIsEditingTitle(false);
      }
    } catch (err) {
      console.error('Title save error:', err);
    } finally {
      setSavingTitle(false);
    }
  }

  async function handleSaveDescription() {
    setSavingDesc(true);
    const trimmed = descInput.slice(0, 200).trim();
    try {
      const res = await fetch(`/api/quizzes/${quiz.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ description: trimmed })
      });
      if (res.ok) {
        const updated = await res.json();
        setQuiz(updated);
        publishLibraryMutation({ type: 'quiz-updated', quiz: updated });
        setDescInput(updated.description || '');
        setIsEditingDesc(false);
      }
    } catch (err) {
      console.error('Description save error:', err);
    } finally {
      setSavingDesc(false);
    }
  }

  async function handleSaveTerm(termToSave: string | null) {
    setSavingTerm(true);
    try {
      const res = await fetch(`/api/quizzes/${quiz.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ term: termToSave })
      });
      if (res.ok) {
        const updated = await res.json();
        setQuiz(updated);
        publishLibraryMutation({ type: 'quiz-updated', quiz: updated });
        setTermInput(updated.term || '');
        setIsEditingTerm(false);
        setIsCustomTerm(false);
        setCustomTermVal('');
        if (termToSave && typeof window !== 'undefined') {
          try {
            const raw = window.localStorage.getItem(CUSTOM_TERMS_STORAGE_KEY);
            const list = raw ? JSON.parse(raw) : [];
            if (Array.isArray(list) && !list.includes(termToSave) && !DEFAULT_TERMS.includes(termToSave)) {
              list.push(termToSave);
              window.localStorage.setItem(CUSTOM_TERMS_STORAGE_KEY, JSON.stringify(list));
            }
          } catch {}
        }
      }
    } catch (err) {
      console.error('Term save error:', err);
    } finally {
      setSavingTerm(false);
    }
  }

  async function handleRemoveHandout() {
    setSavingHandout(true);
    try {
      const res = await fetch(`/api/quizzes/${quiz.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ handout_name: null, handout_path: null }) });
      if (res.ok) setQuiz(await res.json());
    } finally { setSavingHandout(false); }
  }

  async function handleUploadHandout(file: File) {
    if (file.type !== 'application/pdf' || file.size > 15 * 1024 * 1024) return;
    setSavingHandout(true);
    try {
      const dataUrl = await new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = reject; reader.readAsDataURL(file); });
      const res = await fetch(`/api/quizzes/${quiz.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ handout_name: file.name, handout_path: dataUrl }) });
      if (res.ok) setQuiz(await res.json());
    } finally { setSavingHandout(false); }
  }

  async function handleDeleteQuiz() {
    try {
      const res = await fetch(`/api/quizzes/${quiz.id}`, {
        method: 'DELETE'
      });
      if (res.ok) {
        publishLibraryMutation({ type: 'quiz-deleted', quizId: quiz.id });
        router.push('/library');
      }
    } catch (err) {
      console.error('Delete quiz error:', err);
    }
  }

  return (
    <div className="mx-auto max-w-5xl space-y-7 px-4 sm:px-6 lg:px-8 py-6 pb-24 desktop-zoom-133">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Link
          href="/library"
          className="inline-flex items-center gap-2 text-xs font-semibold text-muted-foreground hover:text-foreground w-fit"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Library
        </Link>
        <div className="flex items-center gap-2 w-full sm:w-auto">
          {canDelete && (
            <button
              onClick={() => setShowDeleteQuizModal(true)}
              className="p-2.5 sm:p-2 rounded-2xl sm:rounded-xl text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors shrink-0"
              title="Delete Quiz"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          )}
          <QuizExportMenu quiz={quiz} questions={questions} />
          {canManageSharing && (
            <button
              onClick={() => setShowShareModal(true)}
              className="flex items-center gap-1.5 rounded-2xl border border-border bg-card px-3 sm:px-4 py-2.5 text-xs font-bold text-foreground hover:bg-muted transition-all active:scale-95 shadow-2xs shrink-0"
              title="Share Quiz"
            >
              <Share2 className="h-3.5 w-3.5 shrink-0" />
              <span className="hidden sm:inline">Share</span>
            </button>
          )}
          <button
            onClick={() => setShowStartModal(true)}
            className="flex flex-1 sm:flex-initial items-center justify-center gap-2 rounded-2xl bg-primary px-4 sm:px-6 py-2.5 text-xs font-bold text-white shadow-lg shadow-primary/20 hover:bg-primary/90 transition-all active:scale-95 whitespace-nowrap"
          >
            <Play className="h-3.5 w-3.5 fill-current shrink-0" />
            <span>Start Learning</span>
          </button>
        </div>
      </div>

      {/* Hero Header */}
      <div className="rounded-3xl border border-border/80 bg-card p-6 shadow-sm space-y-3">
        <div className="flex items-center justify-between gap-4">
          <div className="flex-1 min-w-0">
            {isEditingTitle ? (
              <div className="flex items-center gap-2 min-w-0 w-full">
                <input
                  type="text"
                  maxLength={50}
                  value={titleInput}
                  onChange={(e) => setTitleInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleSaveTitle();
                    if (e.key === 'Escape') {
                      setTitleInput(quiz.title);
                      setIsEditingTitle(false);
                    }
                  }}
                  className="rounded-xl border border-primary bg-background px-3 py-1.5 text-lg font-bold text-foreground focus:outline-none flex-1 min-w-0"
                  autoFocus
                />
                <button
                  type="button"
                  onClick={handleSaveTitle}
                  disabled={savingTitle || !titleInput.trim()}
                  className="inline-flex items-center gap-1 rounded-xl bg-primary px-3 py-1.5 text-xs font-bold text-white hover:bg-primary/90 disabled:opacity-50 shrink-0"
                >
                  <Check className="h-3.5 w-3.5" />
                  Save
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setTitleInput(quiz.title);
                    setIsEditingTitle(false);
                  }}
                  className="rounded-xl px-3 py-1.5 text-xs font-semibold text-muted-foreground hover:bg-muted shrink-0"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <div className="flex items-start gap-2 min-w-0 w-full">
                <h1
                  className="text-lg sm:text-xl font-extrabold text-foreground min-w-0 flex-1 break-words [overflow-wrap:anywhere] leading-snug"
                  title={quiz.title}
                >
                  {quiz.title}
                </h1>
                {!readOnly && (
                  <button
                    type="button"
                    onClick={() => setIsEditingTitle(true)}
                    title="Edit title"
                    aria-label="Edit title"
                    className="p-1 rounded-lg text-muted-foreground hover:text-foreground shrink-0 mt-0.5"
                  >
                    <Edit className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            )}
            <div className="flex flex-wrap items-center gap-3 sm:gap-4 text-xs text-muted-foreground mt-1.5">
              <span>{questions.length} Questions</span>
              {quiz.subject && (
                <span className="flex items-center gap-1.5 font-semibold text-foreground">
                  <span
                    className="w-2.5 h-2.5 rounded-full"
                    style={{ backgroundColor: quiz.subject.color }}
                  />
                  {quiz.subject.name}
                </span>
              )}
              {/* Term badge & editor */}
              {isEditingTerm ? (
                <div className="flex items-center gap-1.5">
                  {!isCustomTerm ? (
                    <select
                      value={termInput}
                      onChange={(e) => {
                        if (e.target.value === '__custom__') {
                          setIsCustomTerm(true);
                        } else {
                          setTermInput(e.target.value);
                        }
                      }}
                      className="rounded-xl border border-primary bg-background px-2 py-0.5 text-xs font-bold text-foreground focus:outline-none cursor-pointer"
                    >
                      <option value="">No Term</option>
                      {Array.from(new Set([...DEFAULT_TERMS, ...(quiz.term ? [quiz.term] : [])])).map((t) => (
                        <option key={t} value={t}>{t}</option>
                      ))}
                      <option value="__custom__">+ Custom term...</option>
                    </select>
                  ) : (
                    <input
                      type="text"
                      placeholder="e.g. Prelim..."
                      value={customTermVal}
                      onChange={(e) => setCustomTermVal(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && customTermVal.trim()) {
                          handleSaveTerm(customTermVal.trim());
                        } else if (e.key === 'Escape') {
                          setIsEditingTerm(false);
                          setIsCustomTerm(false);
                        }
                      }}
                      className="rounded-xl border border-primary bg-background px-2.5 py-0.5 text-xs font-bold text-foreground focus:outline-none w-28"
                      autoFocus
                    />
                  )}
                  <button
                    type="button"
                    onClick={() => handleSaveTerm(isCustomTerm ? (customTermVal.trim() || null) : (termInput.trim() || null))}
                    disabled={savingTerm}
                    className="inline-flex items-center gap-1 rounded-xl bg-primary px-2 py-0.5 text-xs font-bold text-white hover:bg-primary/90 disabled:opacity-50 cursor-pointer"
                  >
                    <Check className="h-3 w-3" />
                    Save
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setIsEditingTerm(false);
                      setIsCustomTerm(false);
                      setTermInput(quiz.term || '');
                    }}
                    className="rounded-xl px-2 py-0.5 text-xs font-semibold text-muted-foreground hover:bg-muted cursor-pointer"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                quiz.term ? (
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-2.5 py-0.5 text-[11px] font-extrabold text-primary shadow-2xs">
                    <span>{quiz.term}</span>
                    {!readOnly && (
                      <button
                        type="button"
                        onClick={() => {
                          setTermInput(quiz.term || '');
                          setIsEditingTerm(true);
                        }}
                        title="Edit term"
                        aria-label="Edit term"
                        className="text-primary/70 hover:text-primary transition-colors cursor-pointer"
                      >
                        <Edit className="h-2.5 w-2.5" />
                      </button>
                    )}
                  </span>
                ) : (
                  !readOnly && (
                    <button
                      type="button"
                      onClick={() => {
                        setTermInput('');
                        setIsEditingTerm(true);
                      }}
                      className="inline-flex items-center gap-1 text-[11px] font-bold text-primary hover:underline cursor-pointer"
                    >
                      <Plus className="h-3 w-3" />
                      <span>Add Term</span>
                    </button>
                  )
                )
              )}
              <span className="inline-flex items-center gap-1.5">
                {quiz.handout_name ? <><FileText className="h-3 w-3" />Source: {quiz.handout_name}<button type="button" onClick={handleRemoveHandout} disabled={savingHandout} aria-label="Remove source handout" className="text-muted-foreground hover:text-destructive"><X className="h-3 w-3" /></button></> : !readOnly && <><button type="button" onClick={() => handoutInputRef.current?.click()} disabled={savingHandout} className="inline-flex items-center gap-1 font-bold text-primary hover:underline"><Upload className="h-3 w-3" />Add PDF</button><input ref={handoutInputRef} type="file" accept="application/pdf" className="hidden" onChange={(e) => { const file = e.target.files?.[0]; if (file) void handleUploadHandout(file); e.currentTarget.value = ''; }} /></>}
              </span>
            </div>
            {isEditingDesc ? (
              <div className="mt-2 space-y-1.5 max-w-2xl">
                <textarea
                  value={descInput}
                  onChange={(e) => setDescInput(e.target.value.slice(0, 200))}
                  onKeyDown={(e) => {
                    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                      e.preventDefault();
                      handleSaveDescription();
                    }
                    if (e.key === 'Escape') {
                      setDescInput(quiz.description || '');
                      setIsEditingDesc(false);
                    }
                  }}
                  maxLength={200}
                  rows={2}
                  placeholder="Add a brief description (up to 200 characters)..."
                  className="w-full resize-none rounded-xl border border-primary bg-background px-3 py-2 text-xs leading-relaxed text-foreground placeholder:text-muted-foreground focus:outline-none"
                  autoFocus
                />
                <div className="flex items-center justify-between">
                  <span className={`text-[11px] font-medium ${descInput.length >= 190 ? 'text-amber-500 font-bold' : 'text-muted-foreground'}`}>
                    {descInput.length}/200 characters
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setDescInput(quiz.description || '');
                        setIsEditingDesc(false);
                      }}
                      className="rounded-xl px-3 py-1.5 text-xs font-semibold text-muted-foreground hover:bg-muted"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleSaveDescription}
                      disabled={savingDesc}
                      className="inline-flex items-center gap-1 rounded-xl bg-primary px-3 py-1.5 text-xs font-bold text-white shadow-sm hover:bg-primary/90 disabled:opacity-50"
                    >
                      <Check className="h-3.5 w-3.5" />
                      {savingDesc ? 'Saving...' : 'Save'}
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="group mt-2 flex items-start gap-2 max-w-2xl">
                {quiz.description ? (
                  <p className="text-xs leading-relaxed text-muted-foreground">
                    {quiz.description}
                  </p>
                ) : (
                  <p className="text-xs italic text-muted-foreground/60">
                    No description. Click edit to add one.
                  </p>
                )}
                {!readOnly && (
                  <button
                    type="button"
                    onClick={() => {
                      setDescInput(quiz.description || '');
                      setIsEditingDesc(true);
                    }}
                    title="Edit description"
                    aria-label="Edit description"
                    className="rounded-lg p-1 text-muted-foreground opacity-60 hover:opacity-100 hover:bg-muted transition-all"
                  >
                    <Edit className="h-3 w-3" />
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Question Bank */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
            Questions ({questions.length})
          </h3>
          {!readOnly && (
            <button
              onClick={() => {
                setEditingQuestion(null);
                setShowQuestionModal(true);
              }}
              className="flex items-center gap-1.5 rounded-xl border border-border bg-card px-3 py-1.5 text-xs font-bold text-foreground hover:bg-muted transition-all"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Add Question</span>
            </button>
          )}
        </div>

        <QuizQuestionList
          quizId={quiz.id}
          subjectId={quiz.subject_id}
          userId={quiz.user_id}
          questions={questions}
          onEdit={(q) => {
            setEditingQuestion(q);
            setShowQuestionModal(true);
          }}
          onDeleted={handleQuestionDeleted}
          readOnly={readOnly}
        />
      </div>

      {!readOnly && isEditingTitle && (
        <StickyActionDock
          onAction={handleSaveTitle}
          disabled={savingTitle || !titleInput.trim()}
          ariaLabel="Save quiz title"
          message="Save your reviewer title"
          buttonText={savingTitle ? 'Saving...' : 'Save'}
          icon={<Save className="h-4 w-4" />}
        />
      )}

      <QuizQuestionFormModal
        open={!readOnly && showQuestionModal}
        onOpenChange={setShowQuestionModal}
        question={editingQuestion}
        quizId={quiz.id}
        subjectId={quiz.subject_id}
        userId={quiz.user_id}
        onSaved={handleQuestionSaved}
        onDeleted={handleQuestionDeleted}
      />

      <QuizStartConfigModal
        open={showStartModal}
        onOpenChange={setShowStartModal}
        quizId={quiz.id}
        quizSlug={quiz.slug}
        shareToken={quiz.share_token}
        title={quiz.title}
      />

      <ShareQuizModal
        open={canManageSharing && showShareModal}
        onOpenChange={setShowShareModal}
        quizId={quiz.id}
        quizTitle={quiz.title}
      />

      <ConfirmModal
        open={canDelete && Boolean(showDeleteQuizModal)}
        onOpenChange={setShowDeleteQuizModal}
        onConfirm={handleDeleteQuiz}
        title="Delete Quiz"
        message="Are you sure you want to permanently delete this entire quiz library and all questions?"
        destructive
        confirmText="Delete Quiz"
      />
      <FloatingBottomNav />
    </div>
  );
}
