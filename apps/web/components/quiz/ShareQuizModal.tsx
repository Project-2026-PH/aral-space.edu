'use client';

import React, { useState, useEffect } from 'react';
import Modal from '../ui/Modal';
import { Copy, Check, Globe, Lock, CopyCheck, Sparkles } from 'lucide-react';

interface ShareQuizModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  quizId: string;
  quizTitle: string;
}

export default function ShareQuizModal({
  open,
  onOpenChange,
  quizId,
  quizTitle
}: ShareQuizModalProps) {
  const [shareToken, setShareToken] = useState<string>('');
  const [isPublic, setIsPublic] = useState<boolean>(true);
  const [allowCloning, setAllowCloning] = useState<boolean>(true);
  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [copied, setCopied] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const shareUrl = shareToken ? `${origin}/sets/share/${shareToken}` : '';

  useEffect(() => {
    if (!open) {
      setCopied(false);
      return;
    }

    async function loadShareConfig() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/quizzes/${quizId}/share-link`);
        if (!res.ok) throw new Error('Failed to load share settings');
        const data = await res.json();
        setShareToken(data.share_token);
        setIsPublic(data.is_public ?? true);
        setAllowCloning(data.allow_cloning ?? true);
      } catch (err: any) {
        setError(err.message || 'Error loading share settings');
      } finally {
        setLoading(false);
      }
    }

    loadShareConfig();
  }, [open, quizId]);

  async function updateConfig(updates: { is_public?: boolean; allow_cloning?: boolean; reset_token?: boolean }) {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/quizzes/${quizId}/share-link`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates)
      });
      if (!res.ok) throw new Error('Failed to update share settings');
      const data = await res.json();
      setShareToken(data.share_token);
      setIsPublic(data.is_public ?? true);
      setAllowCloning(data.allow_cloning ?? true);
      if (updates.reset_token) {
        setCopied(false);
      }
    } catch (err: any) {
      setError(err.message || 'Error updating settings');
    } finally {
      setSaving(false);
    }
  }

  function handleCopy() {
    if (!shareUrl) return;
    navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => {
      setCopied(false);
    }, 2500);
  }

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title="Share Study Set"
      description={`Generate a secure public link for "${quizTitle}" to study or share.`}
      maxWidth="max-w-lg"
    >
      <div className="space-y-5 pt-2">
        {loading ? (
          <div className="py-12 flex flex-col items-center justify-center gap-3">
            <div className="h-7 w-7 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            <p className="text-xs text-muted-foreground font-medium">Loading sharing options...</p>
          </div>
        ) : error ? (
          <div className="p-4 rounded-2xl bg-destructive/10 border border-destructive/20 text-destructive text-xs">
            {error}
          </div>
        ) : (
          <>
            {/* Share Link Box */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-foreground flex items-center justify-between">
                <span>Direct Access Link</span>
                <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">Anyone with link</span>
              </label>
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <input
                    type="text"
                    readOnly
                    value={shareUrl}
                    onFocus={(e) => e.target.select()}
                    className="w-full rounded-2xl border border-border/80 bg-background/50 backdrop-blur-sm px-3.5 py-2.5 text-xs text-foreground font-mono shadow-inner outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 transition-all select-all pr-10"
                  />
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none">
                    <Globe className="h-3.5 w-3.5" />
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleCopy}
                  className={`inline-flex items-center justify-center gap-1.5 rounded-2xl px-4 py-2.5 text-xs font-bold transition-all shadow-sm active:scale-95 shrink-0 ${
                    copied
                      ? 'bg-emerald-600 text-white shadow-emerald-500/20'
                      : 'bg-primary text-primary-foreground hover:opacity-90'
                  }`}
                >
                  {copied ? (
                    <>
                      <CopyCheck className="h-3.5 w-3.5" />
                      <span>Copied!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="h-3.5 w-3.5" />
                      <span>Copy</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Permissions & Controls */}
            <div className="rounded-2xl border border-border/60 bg-muted/20 p-4 space-y-4">
              <h4 className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Access Permissions</h4>
              
              {/* Public Toggle */}
              <div className="flex items-center justify-between">
                <div className="space-y-0.5 pr-4">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-foreground">
                    {isPublic ? <Globe className="h-3.5 w-3.5 text-primary" /> : <Lock className="h-3.5 w-3.5 text-amber-500" />}
                    <span>Link Enabled</span>
                  </div>
                  <p className="text-[11px] text-muted-foreground leading-relaxed">
                    Allow anyone with this unique URL to view and practice this set.
                  </p>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={isPublic}
                  disabled={saving}
                  onClick={() => updateConfig({ is_public: !isPublic })}
                  className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                    isPublic ? 'bg-primary' : 'bg-muted'
                  }`}
                >
                  <span
                    className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                      isPublic ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>

              <div className="h-px bg-border/40" />

              {/* Allow Cloning / Saving Toggle */}
              <div className="flex items-center justify-between">
                <div className="space-y-0.5 pr-4">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-foreground">
                    <Sparkles className="h-3.5 w-3.5 text-amber-500" />
                    <span>Allow Saving to Library</span>
                  </div>
                  <p className="text-[11px] text-muted-foreground leading-relaxed">
                    Allow recipients to clone this deck into their personal account.
                  </p>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={allowCloning}
                  disabled={saving}
                  onClick={() => updateConfig({ allow_cloning: !allowCloning })}
                  className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                    allowCloning ? 'bg-primary' : 'bg-muted'
                  }`}
                >
                  <span
                    className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                      allowCloning ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="pt-1 flex items-center justify-end text-xs">
              <button
                type="button"
                onClick={() => onOpenChange(false)}
                className="rounded-xl px-4 py-2 text-xs font-semibold text-muted-foreground hover:bg-muted transition-colors"
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
