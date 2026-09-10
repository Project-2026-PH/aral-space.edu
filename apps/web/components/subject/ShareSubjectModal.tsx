'use client';

import React, { useEffect, useState } from 'react';
import { Subject } from '@quiz-creator/types';
import { Copy, CopyCheck, Globe, Link2, Lock, UserPlus } from 'lucide-react';
import Modal from '../ui/Modal';

interface ShareSubjectModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  subject: Subject | null;
  readOnly?: boolean;
  onUpdated?: (config: { share_token: string; is_public: boolean }) => void;
}

export default function ShareSubjectModal({
  open,
  onOpenChange,
  subject,
  readOnly = false,
  onUpdated
}: ShareSubjectModalProps) {
  const [shareToken, setShareToken] = useState('');
  const [isPublic, setIsPublic] = useState(true);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);
  const [collaboratorExpiry, setCollaboratorExpiry] = useState('7');
  const [collaboratorMaxUses, setCollaboratorMaxUses] = useState('5');
  const [collaboratorUrl, setCollaboratorUrl] = useState('');
  const [collaboratorCopied, setCollaboratorCopied] = useState(false);
  const [creatingCollaborator, setCreatingCollaborator] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [origin, setOrigin] = useState('');

  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

  const shareUrl = shareToken && origin ? `${origin}/subjects/share/${shareToken}` : '';

  useEffect(() => {
    if (!open || !subject) return;

    const subjectId = subject.id;
    let cancelled = false;
    setLoading(true);
    setError(null);
    setCopied(false);
    setCollaboratorUrl('');
    setCollaboratorCopied(false);

    async function loadShareConfig() {
      try {
        const response = await fetch(`/api/subjects/${subjectId}/share-link`);
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Failed to load subject sharing settings');
        if (!cancelled) {
          setShareToken(data.share_token || '');
          setIsPublic(data.is_public ?? true);
          onUpdated?.({
            share_token: data.share_token || '',
            is_public: data.is_public ?? true
          });
        }
      } catch (err: any) {
        if (!cancelled) setError(err.message || 'Failed to load subject sharing settings');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadShareConfig();
    return () => {
      cancelled = true;
    };
  }, [open, subject?.id]);

  async function updateConfig(updates: { is_public?: boolean; reset_token?: boolean }) {
    if (!subject) return;
    setSaving(true);
    setError(null);
    try {
      const response = await fetch(`/api/subjects/${subject.id}/share-link`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates)
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to update subject sharing settings');
      setShareToken(data.share_token || '');
      setIsPublic(data.is_public ?? true);
      onUpdated?.({
        share_token: data.share_token || '',
        is_public: data.is_public ?? true
      });
      if (updates.reset_token) setCopied(false);
    } catch (err: any) {
      setError(err.message || 'Failed to update subject sharing settings');
    } finally {
      setSaving(false);
    }
  }

  async function createCollaboratorLink() {
    if (!subject) return;
    setCreatingCollaborator(true);
    setError(null);
    try {
      const expiryDays = collaboratorExpiry === 'never' ? null : Number(collaboratorExpiry);
      if (expiryDays !== null && (!Number.isFinite(expiryDays) || expiryDays <= 0)) {
        throw new Error('Please choose a valid collaborator link expiration.');
      }
      const expiresAt = expiryDays === null
        ? null
        : new Date(Date.now() + expiryDays * 24 * 60 * 60 * 1000).toISOString();
      const maxUses = Math.min(5, Math.max(1, Number(collaboratorMaxUses) || 5));
      const response = await fetch(`/api/subjects/${subject.id}/collaborator-link`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          expires_at: expiresAt,
          max_uses: maxUses
        })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to create collaborator link');
      setCollaboratorUrl(`${origin}/subjects/collaborate/${data.token}`);
      setCollaboratorCopied(false);
    } catch (err: any) {
      setError(err.message || 'Failed to create collaborator link');
    } finally {
      setCreatingCollaborator(false);
    }
  }

  async function copyCollaboratorLink() {
    if (!collaboratorUrl) return;
    try {
      await navigator.clipboard.writeText(collaboratorUrl);
      setCollaboratorCopied(true);
      window.setTimeout(() => setCollaboratorCopied(false), 2500);
    } catch {
      setError('Could not copy the collaborator link. Select it and copy it manually.');
    }
  }

  async function handleCopy() {
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2500);
    } catch {
      setError('Could not copy the link. Select it and copy it manually.');
    }
  }

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title="Share Subject"
      description={subject ? `Share “${subject.name}” and its public study sets.` : undefined}
      maxWidth="max-w-lg"
      contentClassName="custom-scrollbar"
    >
      <div className="space-y-5 pt-2">
        {loading ? (
          <div className="flex flex-col items-center justify-center gap-3 py-12">
            <div className="h-7 w-7 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            <p className="text-xs font-black text-muted-foreground">Preparing public link...</p>
          </div>
        ) : error ? (
          <div className="rounded-xl border-2 border-destructive bg-destructive/10 p-4 text-xs font-black text-destructive shadow-brutal-sm">
            {error}
          </div>
        ) : (
          <>
            <div className="space-y-2">
              <label className="flex items-center justify-between text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300">
                <span>Shared Subject Link</span>
                <span className="rounded-md border-2 border-slate-900 bg-white dark:bg-slate-800 px-2 py-0.5 text-[10px] font-black text-slate-900 dark:text-white shadow-brutal-sm">Anyone with link</span>
              </label>
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <input
                    type="text"
                    readOnly
                    value={shareUrl}
                    onFocus={(event) => event.target.select()}
                    className="w-full rounded-xl border-2 border-slate-900 dark:border-white/40 bg-white dark:bg-card px-3.5 py-2.5 pr-10 font-mono text-xs font-black text-foreground shadow-brutal-sm outline-none transition-colors focus:border-primary select-all"
                  />
                  <Link2 className="pointer-events-none absolute right-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-700 dark:text-slate-300" />
                </div>
                <button
                  type="button"
                  onClick={handleCopy}
                  className={`inline-flex shrink-0 items-center justify-center gap-1.5 rounded-xl border-2 border-slate-900 px-4 py-2.5 text-xs font-black shadow-brutal-sm hover:-translate-y-0.5 hover:shadow-brutal active:translate-x-0.5 active:translate-y-0.5 active:shadow-none transition-all cursor-pointer ${copied ? 'bg-emerald-500 text-white' : 'bg-primary text-white'
                    }`}
                >
                  {copied ? <CopyCheck className="h-3.5 w-3.5 stroke-[2.5]" /> : <Copy className="h-3.5 w-3.5 stroke-[2.5]" />}
                  <span>{copied ? 'Copied!' : 'Copy'}</span>
                </button>
              </div>
            </div>

            {/* Collaborator link container */}
            {!readOnly && (
              <div className="space-y-4 rounded-2xl border-2 border-slate-900 bg-[#bfdbfe]/30 dark:bg-blue-950/40 p-4 shadow-brutal-sm">
                <div className="flex items-center gap-2">
                  <UserPlus className="h-4 w-4 text-primary" />
                  <h4 className="text-[11px] font-black uppercase tracking-wider text-primary">Collaborator link</h4>
                </div>
                <p className="text-[11px] font-medium leading-relaxed text-muted-foreground">
                  Create a read-only shared library link for up to 5 users. Each device/user is counted once in the owner’s viewer total.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-black uppercase tracking-wider text-slate-600 dark:text-slate-400">Expiration</label>
                    <select
                      value={collaboratorExpiry}
                      onChange={(event) => setCollaboratorExpiry(event.target.value)}
                      className="rounded-xl border-2 border-slate-900 dark:border-white/40 bg-white dark:bg-card px-3 py-2 text-xs font-black text-foreground shadow-brutal-sm outline-none focus:border-primary"
                    >
                      <option value="1">Expires in 1 day</option>
                      <option value="7">Expires in 7 days</option>
                      <option value="30">Expires in 30 days</option>
                      <option value="never">No expiry</option>
                    </select>
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-black uppercase tracking-wider text-slate-600 dark:text-slate-400">Max Users / Devices</label>
                    <select
                      value={collaboratorMaxUses}
                      onChange={(event) => setCollaboratorMaxUses(event.target.value)}
                      className="rounded-xl border-2 border-slate-900 dark:border-white/40 bg-white dark:bg-card px-3 py-2 text-xs font-black text-foreground shadow-brutal-sm outline-none focus:border-primary"
                    >
                      <option value="1">1 user / device</option>
                      <option value="2">2 users / devices</option>
                      <option value="3">3 users / devices</option>
                      <option value="4">4 users / devices</option>
                      <option value="5">5 users / devices (max)</option>
                    </select>
                  </div>
                </div>

                <div className="pt-1">
                  <button
                    type="button"
                    onClick={createCollaboratorLink}
                    disabled={creatingCollaborator}
                    className="w-full inline-flex items-center justify-center gap-1.5 rounded-xl border-2 border-slate-900 bg-primary px-3.5 py-2 text-xs font-black text-white shadow-brutal-sm hover:-translate-y-0.5 hover:shadow-brutal active:translate-x-0.5 active:translate-y-0.5 active:shadow-none transition-all disabled:opacity-50 cursor-pointer"
                  >
                    <UserPlus className="h-3.5 w-3.5 stroke-[2.5]" /> {creatingCollaborator ? 'Creating...' : 'Create collaborator link'}
                  </button>
                </div>

                {collaboratorUrl && (
                  <div className="space-y-1.5 pt-1">
                    <div className="flex items-center justify-between text-[10px] font-black text-slate-600 dark:text-slate-400">
                      <span>Collaborator Link Ready</span>
                      <span className="text-primary font-black">Valid for {collaboratorMaxUses} unique viewer(s)</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        readOnly
                        value={collaboratorUrl}
                        onFocus={(event) => event.target.select()}
                        className="min-w-0 flex-1 rounded-xl border-2 border-slate-900 dark:border-white/40 bg-white dark:bg-card px-3 py-2 font-mono text-[11px] font-black text-foreground shadow-brutal-sm outline-none"
                      />
                      <button
                        type="button"
                        onClick={copyCollaboratorLink}
                        className="inline-flex shrink-0 items-center gap-1.5 rounded-xl border-2 border-slate-900 bg-white dark:bg-slate-800 px-3 py-2 text-xs font-black text-slate-900 dark:text-white shadow-brutal-sm hover:-translate-y-0.5 hover:shadow-brutal active:translate-x-0.5 active:translate-y-0.5 active:shadow-none transition-all cursor-pointer"
                      >
                        {collaboratorCopied ? <CopyCheck className="h-3.5 w-3.5 stroke-[2.5]" /> : <Copy className="h-3.5 w-3.5 stroke-[2.5]" />} {collaboratorCopied ? 'Copied' : 'Copy'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className="flex items-center justify-between gap-3 pt-1">
              {!readOnly && (
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => updateConfig({ reset_token: true })}
                  className="inline-flex items-center gap-1.5 rounded-xl border-2 border-slate-900 bg-white dark:bg-slate-800 px-3.5 py-2 text-xs font-black text-slate-900 dark:text-white shadow-brutal-sm hover:-translate-y-0.5 hover:shadow-brutal active:translate-x-0.5 active:translate-y-0.5 active:shadow-none transition-all cursor-pointer disabled:opacity-50"
                >
                  <Link2 className="h-3.5 w-3.5 stroke-[2.5]" />
                  Regenerate link
                </button>
              )}
              <button
                type="button"
                onClick={() => onOpenChange(false)}
                className="rounded-xl border-2 border-slate-900 bg-slate-900 text-white dark:bg-white dark:text-slate-900 px-5 py-2 text-xs font-black uppercase tracking-wider shadow-brutal-sm hover:-translate-y-0.5 hover:shadow-brutal active:translate-x-0.5 active:translate-y-0.5 active:shadow-none transition-all cursor-pointer"
              >
                Done
              </button>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}
