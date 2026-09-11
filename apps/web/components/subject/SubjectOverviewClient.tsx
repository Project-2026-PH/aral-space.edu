'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Eye, ExternalLink, Layers, Link2, Lock, Pencil, Plus, Save } from 'lucide-react';
import { Quiz, Subject, SubjectAccess } from '@quiz-creator/types';
import QuizLibrary from '@/components/quiz/QuizLibrary';
import ShareSubjectModal from './ShareSubjectModal';
import StickyActionDock from '@/components/ui/StickyActionDock';
import FloatingBottomNav from '@/components/navigation/FloatingBottomNav';
import { publishLibraryMutation, useSynchronizedLibraryCollections } from '@/lib/libraryMutationStore';

interface SubjectOverviewClientProps {
  subject: Subject;
  quizzes: Quiz[];
  access: SubjectAccess;
}

export default function SubjectOverviewClient({ subject: initialSubject, quizzes: initialQuizzes, access }: SubjectOverviewClientProps) {
  const [subject, setSubject] = useState(initialSubject);
  const [subjectQuizzes, setSubjectQuizzes] = useState(initialQuizzes);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(subject.name);
  const [color, setColor] = useState(subject.color);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sharing, setSharing] = useState(false);
  const isPublic = subject.is_public !== false;
  const synchronizedSubjectQuizzes = useSynchronizedLibraryCollections({
    quizzes: subjectQuizzes,
    subjects: [],
    sharedQuizzes: [],
    sharedSubjects: [],
  }).quizzes;

  async function saveSubject() {
    if (!name.trim()) {
      setError('Subject name cannot be empty.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const response = await fetch(`/api/subjects/${subject.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), color })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Unable to update subject.');
      publishLibraryMutation({ type: 'subject-updated', subject: data });
      setSubject(data);
      setEditing(false);
    } catch (err: any) {
      setError(err.message || 'Unable to update subject.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-5xl space-y-7 px-4 sm:px-6 lg:px-8 py-6 pb-24 desktop-zoom-133">
      <div className="flex flex-col gap-5 rounded-3xl border-3 border-slate-900 dark:border-white/40 bg-white dark:bg-card p-4 sm:p-6 shadow-brutal">
        <Link
          href="/library"
          className="inline-flex w-fit items-center gap-1.5 rounded-xl border-2 border-slate-900 bg-white dark:bg-slate-800 px-3 py-1.5 text-xs font-black text-slate-900 dark:text-white shadow-brutal-sm transition-all duration-150 hover:translate-x-0.5 hover:translate-y-0.5 hover:shadow-none active:scale-95 cursor-pointer"
        >
          <ArrowLeft className="h-3.5 w-3.5 stroke-[2.5]" /> Back to library
        </Link>

        <div className="flex flex-col justify-start gap-5 sm:flex-row sm:flex-wrap sm:items-start">
          <div className="flex min-w-0 items-start gap-4">
            <span aria-hidden="true" style={{ backgroundColor: subject.color }} className="h-14 w-14 shrink-0 rounded-2xl border-2 border-slate-900 shadow-brutal-sm" />
            <div className="min-w-0">
              {editing ? (
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 w-full">
                  <input
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    className="w-full sm:w-auto flex-1 min-w-0 rounded-xl border-2 border-slate-900 dark:border-white/40 bg-white dark:bg-card px-3.5 py-2 text-lg sm:text-xl font-black text-foreground shadow-brutal-sm outline-none focus:border-primary"
                  />
                  <div className="flex items-center gap-2">
                    <input
                      aria-label="Subject color"
                      type="color"
                      value={color}
                      onChange={(event) => setColor(event.target.value)}
                      className="h-10 w-12 shrink-0 cursor-pointer rounded-xl border-2 border-slate-900 shadow-brutal-sm bg-transparent"
                    />
                    <span className="text-xs font-bold text-muted-foreground uppercase">{color}</span>
                  </div>
                </div>
              ) : (
                <div className="flex flex-wrap items-center gap-2.5">
                  <h1 className="truncate text-2xl font-black tracking-tight text-slate-900 dark:text-white sm:text-3xl">{subject.name}</h1>
                  <span className={`inline-flex items-center gap-1 rounded-md border-2 border-slate-900 px-2.5 py-1 text-[10px] font-black shadow-brutal-sm ${isPublic ? 'bg-[#bfdbfe] text-slate-900' : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'}`}>
                    {isPublic ? <Link2 className="h-3 w-3 stroke-[2.5]" /> : <Lock className="h-3 w-3 stroke-[2.5]" />} {isPublic ? 'Link Active' : 'Link Disabled'}
                  </span>
                </div>
              )}
              <div className="mt-2.5 flex flex-wrap items-center gap-2 text-xs font-bold text-muted-foreground">
                <span className="inline-flex items-center gap-1.5 rounded-md border-2 border-slate-900 bg-white dark:bg-slate-800 px-2 py-0.5 text-[11px] font-black text-slate-900 dark:text-white shadow-brutal-sm">
                  <Layers className="h-3.5 w-3.5" /> {synchronizedSubjectQuizzes.length} {synchronizedSubjectQuizzes.length === 1 ? 'reviewer' : 'reviewers'}
                </span>
                {access.role === 'collaborator' && (
                  <span className="rounded-md border-2 border-slate-900 bg-[#fde047] px-2 py-0.5 text-[10px] font-black text-slate-900 shadow-brutal-sm">
                    Collaborator
                  </span>
                )}
                {access.role === 'owner' && (
                  <span className="inline-flex items-center gap-1 rounded-md border-2 border-slate-900 bg-white dark:bg-slate-800 px-2 py-0.5 text-[11px] font-black text-slate-900 dark:text-white shadow-brutal-sm" title="Unique viewers">
                    <Eye aria-hidden="true" className="h-3.5 w-3.5" />
                    {subject.viewer_count ?? 0} {subject.viewer_count === 1 ? 'viewer' : 'viewers'}
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {access.can_edit && (
              <>
                {editing ? (
                  <button
                    type="button"
                    onClick={() => {
                      setName(subject.name);
                      setColor(subject.color);
                      setError(null);
                      setEditing(false);
                    }}
                    className="inline-flex items-center gap-1.5 rounded-xl border-2 border-slate-900 bg-white dark:bg-slate-800 px-3.5 py-2 text-xs font-black text-slate-900 dark:text-white shadow-brutal-sm hover:-translate-y-0.5 hover:shadow-brutal active:translate-x-0.5 active:translate-y-0.5 active:shadow-none transition-all cursor-pointer"
                  >
                    Cancel
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => setEditing(true)}
                    className="inline-flex items-center gap-1.5 rounded-xl border-2 border-slate-900 bg-white dark:bg-slate-800 px-3.5 py-2 text-xs font-black text-slate-900 dark:text-white shadow-brutal-sm hover:-translate-y-0.5 hover:shadow-brutal active:translate-x-0.5 active:translate-y-0.5 active:shadow-none transition-all cursor-pointer"
                  >
                    <Pencil className="h-3.5 w-3.5 stroke-[2.5]" /> Edit subject
                  </button>
                )}
              </>
            )}
            {access.can_edit_reviewers && (
              <Link
                href={`/new?mode=manual&subjectId=${encodeURIComponent(subject.id)}`}
                className="inline-flex items-center gap-1.5 rounded-xl border-2 border-slate-900 bg-primary px-3.5 py-2 text-xs font-black text-white shadow-brutal-sm hover:-translate-y-0.5 hover:shadow-brutal active:translate-x-0.5 active:translate-y-0.5 active:shadow-none transition-all cursor-pointer"
              >
                <Plus className="h-3.5 w-3.5 stroke-[2.5]" /> Add reviewer
              </Link>
            )}
            {access.can_manage && (
              <button
                type="button"
                onClick={() => setSharing(true)}
                className="inline-flex items-center gap-1.5 rounded-xl border-2 border-slate-900 bg-white dark:bg-slate-800 px-3.5 py-2 text-xs font-black text-slate-900 dark:text-white shadow-brutal-sm hover:-translate-y-0.5 hover:shadow-brutal active:translate-x-0.5 active:translate-y-0.5 active:shadow-none transition-all cursor-pointer"
              >
                Share & collaborate
              </button>
            )}
          </div>
        </div>
        {error && (
          <p role="alert" className="rounded-xl border-2 border-destructive bg-destructive/10 p-3 text-xs font-black text-destructive shadow-brutal-sm">
            {error}
          </p>
        )}
      </div>

      <QuizLibrary
        quizzes={synchronizedSubjectQuizzes}
        loading={false}
        subjectId={subject.id}
        readOnly={!access.can_edit_reviewers}
        onQuizDeleted={(quizId) => {
          setSubjectQuizzes((current) => current.filter((quiz) => quiz.id !== quizId));
        }}
        onQuizArchived={(quizId) => {
          setSubjectQuizzes((current) => current.filter((quiz) => quiz.id !== quizId));
        }}
      />
      {editing && (
        <StickyActionDock
          onAction={saveSubject}
          disabled={saving}
          ariaLabel="Save subject changes"
          message="Save your subject changes"
          buttonText={saving ? 'Saving...' : 'Save subject'}
          icon={<Save className="h-4 w-4" />}
        />
      )}
      <ShareSubjectModal open={sharing} onOpenChange={setSharing} subject={subject} onUpdated={(config) => setSubject((current) => ({ ...current, ...config }))} />
      <FloatingBottomNav />
    </div>
  );
}
