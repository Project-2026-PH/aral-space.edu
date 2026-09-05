'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Check, LoaderCircle, Trash2 } from 'lucide-react';
import { Subject } from '@quiz-creator/types';
import Modal from '../ui/Modal';

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
            <div className="rounded-2xl border border-destructive/25 bg-destructive/10 p-4">
              <div className="flex items-start gap-3">
                <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-destructive" />
                <div className="space-y-2 text-xs leading-relaxed text-foreground">
                  <p className="font-bold">Deleting this subject will also delete all subjects</p>
                  <p>This permanently removes the reviewers and questions inside this subject. This action cannot be undone.</p>
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <button type="button" onClick={() => onOpenChange(false)} className="rounded-xl px-4 py-2.5 text-xs font-semibold text-muted-foreground hover:bg-muted">Cancel</button>
              <button type="button" onClick={acknowledge} disabled={secondsLeft > 0} className="inline-flex items-center gap-1.5 rounded-xl bg-destructive px-4 py-2.5 text-xs font-bold text-destructive-foreground disabled:cursor-not-allowed disabled:opacity-40">
                {secondsLeft > 0 ? `I agree (${secondsLeft})` : <><Check className="h-3.5 w-3.5" /> I agree</>}
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="rounded-2xl border border-destructive/25 bg-destructive/10 p-4 text-xs leading-relaxed text-foreground">
              <p className="font-bold">Final confirmation</p>
              <p className="mt-1">Type the exact subject name to confirm permanent removal of {reviewerCount} {reviewerCount === 1 ? 'reviewer' : 'reviewers'} and their questions.</p>
            </div>
            <div className="space-y-2">
              <label htmlFor="delete-subject-confirmation" className="text-xs font-bold text-foreground">Type <span className="font-mono text-destructive">{subject?.name}</span> to confirm</label>
              <input id="delete-subject-confirmation" type="text" value={confirmation} onChange={(event) => setConfirmation(event.target.value)} placeholder={subject?.name} autoComplete="off" autoFocus className="w-full rounded-2xl border border-border bg-background px-3.5 py-2.5 text-sm text-foreground outline-none transition focus:border-destructive focus:ring-2 focus:ring-destructive/20" />
            </div>
            {error && <p role="alert" className="rounded-2xl border border-destructive/20 bg-destructive/10 p-3 text-xs text-destructive">{error}</p>}
            <div className="flex justify-end gap-2 pt-1">
              <button type="button" onClick={() => onOpenChange(false)} disabled={deleting} className="rounded-xl px-4 py-2.5 text-xs font-semibold text-muted-foreground hover:bg-muted disabled:opacity-50">Cancel</button>
              <button type="button" onClick={handleDelete} disabled={!canDelete} className="inline-flex items-center gap-1.5 rounded-xl bg-destructive px-4 py-2.5 text-xs font-bold text-destructive-foreground hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40">
                {deleting ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                {deleting ? 'Deleting...' : 'Delete permanently'}
              </button>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}
