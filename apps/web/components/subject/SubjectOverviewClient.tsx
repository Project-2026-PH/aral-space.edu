'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, ExternalLink, Layers, Link2, Lock, Pencil, Plus, Save } from 'lucide-react';
import { Quiz, Subject, SubjectAccess } from '@quiz-creator/types';
import QuizLibrary from '@/components/quiz/QuizLibrary';
import ShareSubjectModal from './ShareSubjectModal';
import StickyActionDock from '@/components/ui/StickyActionDock';
import FloatingBottomNav from '@/components/navigation/FloatingBottomNav';

interface SubjectOverviewClientProps {
  subject: Subject;
  quizzes: Quiz[];
  access: SubjectAccess;
}

export default function SubjectOverviewClient({ subject: initialSubject, quizzes, access }: SubjectOverviewClientProps) {
  const [subject, setSubject] = useState(initialSubject);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(subject.name);
  const [color, setColor] = useState(subject.color);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sharing, setSharing] = useState(false);
  const isPublic = subject.is_public !== false;

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
      setSubject(data);
      setEditing(false);
    } catch (err: any) {
      setError(err.message || 'Unable to update subject.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-8 pb-20">
      <div className="flex flex-col gap-5 rounded-3xl border border-border/80 bg-card p-6 shadow-sm sm:p-8">
        <Link href="/" className="inline-flex w-fit items-center gap-1.5 text-xs font-semibold text-muted-foreground transition-colors hover:text-foreground">
          <ArrowLeft className="h-3.5 w-3.5" /> Back to library
        </Link>

        <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-start">
          <div className="flex min-w-0 items-start gap-4">
            <span aria-hidden="true" style={{ backgroundColor: subject.color }} className="h-12 w-12 shrink-0 rounded-2xl border border-black/5 shadow-inner" />
            <div className="min-w-0">
              {editing ? (
                <div className="flex flex-wrap items-center gap-2">
                  <input value={name} onChange={(event) => setName(event.target.value)} className="rounded-xl border border-border bg-background px-3 py-2 text-lg font-extrabold text-foreground outline-none focus:border-primary" />
                  <input aria-label="Subject color" type="color" value={color} onChange={(event) => setColor(event.target.value)} className="h-9 w-10 cursor-pointer rounded-lg border-0 bg-transparent" />
                </div>
              ) : (
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="truncate text-2xl font-extrabold tracking-tight text-foreground">{subject.name}</h1>
                  <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-bold ${isPublic ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'}`}>
                    {isPublic ? <Link2 className="h-3 w-3" /> : <Lock className="h-3 w-3" />} {isPublic ? 'Link Active' : 'Link Disabled'}
                  </span>
                </div>
              )}
              <p className="mt-2 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                <Layers className="h-3.5 w-3.5" /> {quizzes.length} {quizzes.length === 1 ? 'reviewer' : 'reviewers'} in this subject
                {access.role === 'collaborator' && <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] font-bold text-amber-600">Collaborator</span>}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
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
                    className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-background px-3 py-2 text-xs font-semibold text-muted-foreground hover:bg-muted"
                  >
                    Cancel
                  </button>
                ) : (
                  <button type="button" onClick={() => setEditing(true)} className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-background px-3 py-2 text-xs font-semibold text-foreground hover:bg-muted">
                    <Pencil className="h-3.5 w-3.5" /> Edit subject
                  </button>
                )}
                <Link href={`/new?mode=manual&subjectId=${encodeURIComponent(subject.id)}`} className="inline-flex items-center gap-1.5 rounded-xl bg-primary/10 px-3 py-2 text-xs font-bold text-primary hover:bg-primary hover:text-white">
                  <Plus className="h-3.5 w-3.5" /> Add reviewer
                </Link>
              </>
            )}
            {access.can_manage && (
              <button type="button" onClick={() => setSharing(true)} className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-background px-3 py-2 text-xs font-semibold text-muted-foreground hover:border-primary/40 hover:text-foreground">
                Share & collaborate
              </button>
            )}
            {subject.share_token && isPublic && (
              <Link href={`/subjects/share/${subject.share_token}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-background px-3 py-2 text-xs font-semibold text-muted-foreground hover:border-primary/40 hover:text-foreground">
                <ExternalLink className="h-3.5 w-3.5" /> Public page
              </Link>
            )}
          </div>
        </div>
        {error && <p role="alert" className="rounded-2xl border border-destructive/20 bg-destructive/10 p-3 text-xs text-destructive">{error}</p>}
      </div>

      <QuizLibrary quizzes={quizzes} loading={false} />
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
