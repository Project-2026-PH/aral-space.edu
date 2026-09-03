'use client';

import React, { useEffect, useState } from 'react';
import { Subject } from '@quiz-creator/types';
import { Copy, CopyCheck, Globe, Link2, Lock } from 'lucide-react';
import Modal from '../ui/Modal';

interface ShareSubjectModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  subject: Subject | null;
}

export default function ShareSubjectModal({
  open,
  onOpenChange,
  subject
}: ShareSubjectModalProps) {
  const [shareToken, setShareToken] = useState('');
  const [isPublic, setIsPublic] = useState(true);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const shareUrl = shareToken && origin ? `${origin}/subjects/share/${shareToken}` : '';

  useEffect(() => {
    if (!open || !subject) return;

    const subjectId = subject.id;
    let cancelled = false;
    setLoading(true);
    setError(null);
    setCopied(false);

    async function loadShareConfig() {
      try {
        const response = await fetch(`/api/subjects/${subjectId}/share-link`);
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Failed to load subject sharing settings');
        if (!cancelled) {
          setShareToken(data.share_token || '');
          setIsPublic(data.is_public ?? true);
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
  }, [open, subject]);

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
      if (updates.reset_token) setCopied(false);
    } catch (err: any) {
      setError(err.message || 'Failed to update subject sharing settings');
    } finally {
      setSaving(false);
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
    >
      <div className="space-y-5 pt-2">
        {loading ? (
          <div className="flex flex-col items-center justify-center gap-3 py-12">
            <div className="h-7 w-7 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            <p className="text-xs font-medium text-muted-foreground">Preparing public link...</p>
          </div>
        ) : error ? (
          <div className="rounded-2xl border border-destructive/20 bg-destructive/10 p-4 text-xs text-destructive">
            {error}
          </div>
        ) : (
          <>
            <div className="space-y-2">
              <label className="flex items-center justify-between text-xs font-bold text-foreground">
                <span>Public Subject Link</span>
                <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Anyone with link</span>
              </label>
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <input
                    type="text"
                    readOnly
                    value={shareUrl}
                    onFocus={(event) => event.target.select()}
                    className="w-full rounded-2xl border border-border/80 bg-background/50 px-3.5 py-2.5 pr-10 font-mono text-xs text-foreground shadow-inner outline-none transition-all focus:border-primary focus:ring-1 focus:ring-primary/20 select-all"
                  />
                  <Link2 className="pointer-events-none absolute right-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                </div>
                <button
                  type="button"
                  onClick={handleCopy}
                  className={`inline-flex shrink-0 items-center justify-center gap-1.5 rounded-2xl px-4 py-2.5 text-xs font-bold shadow-sm transition-all active:scale-95 ${
                    copied ? 'bg-emerald-600 text-white' : 'bg-primary text-primary-foreground hover:opacity-90'
                  }`}
                >
                  {copied ? <CopyCheck className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                  <span>{copied ? 'Copied!' : 'Copy'}</span>
                </button>
              </div>
            </div>

            <div className="space-y-4 rounded-2xl border border-border/60 bg-muted/20 p-4">
              <h4 className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Access Permissions</h4>
              <div className="flex items-center justify-between gap-4">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-foreground">
                    {isPublic ? <Globe className="h-3.5 w-3.5 text-primary" /> : <Lock className="h-3.5 w-3.5 text-amber-500" />}
                    <span>{isPublic ? 'Link Enabled' : 'Link Disabled'}</span>
                  </div>
                  <p className="text-[11px] leading-relaxed text-muted-foreground">
                    {isPublic ? 'Anyone with the link can see this subject and its public study sets.' : 'The public link is disabled until you enable it again.'}
                  </p>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={isPublic}
                  disabled={saving}
                  onClick={() => updateConfig({ is_public: !isPublic })}
                  className={`relative inline-flex h-6 w-11 shrink-0 rounded-full border-2 border-transparent transition-colors focus:outline-none disabled:cursor-not-allowed disabled:opacity-50 ${isPublic ? 'bg-primary' : 'bg-muted'}`}
                >
                  <span className={`inline-block h-5 w-5 rounded-full bg-white shadow-lg transition-transform ${isPublic ? 'translate-x-5' : 'translate-x-0'}`} />
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between gap-3 pt-1">
              <button
                type="button"
                disabled={saving}
                onClick={() => updateConfig({ reset_token: true })}
                className="inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-50"
              >
                <Link2 className="h-3.5 w-3.5" />
                Regenerate link
              </button>
              <button
                type="button"
                onClick={() => onOpenChange(false)}
                className="rounded-xl px-4 py-2 text-xs font-semibold text-muted-foreground transition-colors hover:bg-muted"
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
