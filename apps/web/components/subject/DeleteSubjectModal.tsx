'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Check, LoaderCircle, Trash2 } from 'lucide-react';
import { Subject } from '@quiz-creator/types';
import Modal from '../ui/Modal';
import { publishLibraryMutation } from '@/lib/libraryMutationStore';

interface DeleteSubjectModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  subject: Subject | null;
  reviewerCount: number;
  onDeleted: (subjectId: string) => void;
}

export default function DeleteSubjectModal({ open, onOpenChange, subject, reviewerCount, onDeleted }: DeleteSubjectModalProps) {
  const [stage, setStage] = useState<'acknowledge' | 'confirm'>('acknowledge');
  const [secondsLeft, setSecondsLeft] = useState(3);
  const [confirmation, setConfirmation] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setStage('acknowledge');
    setSecondsLeft(3);
    setConfirmation('');
    setDeleting(false);
    setError(null);
    const interval = window.setInterval(() => {
      setSecondsLeft((current) => {
        if (current <= 1) {
          window.clearInterval(interval);
          return 0;
        }
        return current - 1;
      });
    }, 1000);
    return () => window.clearInterval(interval);
  }, [open, subject]);

  const canDelete = useMemo(() => Boolean(subject && stage === 'confirm' && confirmation === subject.name && !deleting), [confirmation, deleting, stage, subject]);

  function acknowledge() {
    if (secondsLeft > 0) return;
    setStage('confirm');
  }

  async function handleDelete() {
    if (!subject || !canDelete) return;
    setDeleting(true);
    setError(null);
    try {
      const response = await fetch(`/api/subjects/${subject.id}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirmation_name: confirmation })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'Failed to delete subject');
      publishLibraryMutation({ type: 'subject-deleted', subjectId: subject.id });
      onDeleted(subject.id);
      onOpenChange(false);
    } catch (err: any) {
      setError(err.message || 'Failed to delete subject');
    } finally {
      setDeleting(false);
    }
  }

  return (
    <Modal open={open} onOpenChange={onOpenChange} title="Delete subject?" description={subject ? `Permanently delete “${subject.name}”.` : undefined} maxWidth="max-w-md">
      <div className="space-y-5 pt-2">
        {stage === 'acknowledge' ? (
          <>
            <div className="rounded-2xl border-2 border-destructive bg-destructive/10 p-4 shadow-brutal-sm">
              <div className="flex items-start gap-3">
                <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-destructive stroke-[2.5]" />
                <div className="space-y-1.5 text-xs leading-relaxed text-foreground">
                  <p className="font-black text-destructive">Deleting this subject will remove its reviewers</p>
                  <p className="font-medium text-muted-foreground">This permanently removes the reviewers and questions inside this subject. This action cannot be undone.</p>
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => onOpenChange(false)}
                className="rounded-xl border-2 border-slate-900 bg-white dark:bg-slate-800 px-4 py-2.5 text-xs font-black text-slate-900 dark:text-white shadow-brutal-sm hover:-translate-y-0.5 hover:shadow-brutal active:translate-x-0.5 active:translate-y-0.5 active:shadow-none transition-all cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={acknowledge}
                disabled={secondsLeft > 0}
                className="inline-flex items-center gap-1.5 rounded-xl border-2 border-slate-900 bg-destructive px-4 py-2.5 text-xs font-black text-white shadow-brutal-sm hover:-translate-y-0.5 hover:shadow-brutal active:translate-x-0.5 active:translate-y-0.5 active:shadow-none transition-all disabled:cursor-not-allowed disabled:opacity-40 cursor-pointer"
              >
                {secondsLeft > 0 ? `I agree (${secondsLeft})` : <><Check className="h-3.5 w-3.5 stroke-[3]" /> I agree</>}
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="rounded-2xl border-2 border-destructive bg-destructive/10 p-4 text-xs leading-relaxed text-foreground shadow-brutal-sm">
              <p className="font-black text-destructive">Final confirmation</p>
              <p className="mt-1 font-medium text-muted-foreground">Type the exact subject name to confirm permanent removal of {reviewerCount} {reviewerCount === 1 ? 'reviewer' : 'reviewers'} and their questions.</p>
            </div>
            <div className="space-y-2">
              <label htmlFor="delete-subject-confirmation" className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300">
                Type <span className="font-mono text-destructive underline">{subject?.name}</span> to confirm
              </label>
              <input
                id="delete-subject-confirmation"
                type="text"
                value={confirmation}
                onChange={(event) => setConfirmation(event.target.value)}
                placeholder={subject?.name}
                autoComplete="off"
                autoFocus
                className="w-full rounded-xl border-2 border-slate-900 dark:border-white/40 bg-white dark:bg-card px-3.5 py-2.5 text-sm font-black text-foreground shadow-brutal-sm outline-none transition focus:border-destructive"
              />
            </div>
            {error && (
              <p role="alert" className="rounded-xl border-2 border-destructive bg-destructive/10 p-3 text-xs font-black text-destructive shadow-brutal-sm">
                {error}
              </p>
            )}
            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => onOpenChange(false)}
                disabled={deleting}
                className="rounded-xl border-2 border-slate-900 bg-white dark:bg-slate-800 px-4 py-2.5 text-xs font-black text-slate-900 dark:text-white shadow-brutal-sm hover:-translate-y-0.5 hover:shadow-brutal active:translate-x-0.5 active:translate-y-0.5 active:shadow-none transition-all cursor-pointer disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={!canDelete}
                className="inline-flex items-center gap-1.5 rounded-xl border-2 border-slate-900 bg-destructive px-4 py-2.5 text-xs font-black text-white shadow-brutal-sm hover:-translate-y-0.5 hover:shadow-brutal active:translate-x-0.5 active:translate-y-0.5 active:shadow-none transition-all cursor-pointer disabled:cursor-not-allowed disabled:opacity-40"
              >
                {deleting ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5 stroke-[2.5]" />}
                {deleting ? 'Deleting...' : 'Delete permanently'}
              </button>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}
