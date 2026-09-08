'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Smartphone, ArrowRightLeft, Check, AlertCircle, Loader2, X, Sparkles } from 'lucide-react';
import { extractPairingParams, ParsedPairingParams } from '@/lib/pairingUrl';

const PAIRING_CONNECTION_STORAGE_KEY = 'quizmaster_pairing_connection';

export default function AutoPairModal() {
  const [params, setParams] = useState<ParsedPairingParams | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [syncMode, setSyncMode] = useState<'merge' | 'replace'>('merge');
  const [linking, setLinking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const cleanUrlParams = useCallback(() => {
    if (typeof window !== 'undefined') {
      try {
        const url = new URL(window.location.href);
        url.searchParams.delete('sync');
        url.searchParams.delete('ticketId');
        url.searchParams.delete('ticket');
        url.searchParams.delete('passcode');
        url.searchParams.delete('pass');
        url.searchParams.delete('pair');
        url.searchParams.delete('code');
        const cleanSearch = url.searchParams.toString();
        const nextUrl = url.pathname + (cleanSearch ? `?${cleanSearch}` : '') + url.hash;
        window.history.replaceState({}, '', nextUrl);
      } catch {
        // Safe fallback if history API fails
      }
    }
  }, []);

  const handleDismiss = useCallback(() => {
    setIsOpen(false);
    cleanUrlParams();
  }, [cleanUrlParams]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const parsed = extractPairingParams(window.location.search);
    if (parsed) {
      setParams(parsed);
      setIsOpen(true);
    }
  }, []);

  // Keyboard shortcut (Escape to close)
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape' && isOpen && !linking) {
        handleDismiss();
      }
    }
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
      const originalOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        window.removeEventListener('keydown', handleKeyDown);
        document.body.style.overflow = originalOverflow;
      };
    }
  }, [isOpen, linking, handleDismiss]);

  async function handleConnect() {
    if (!params) return;

    setLinking(true);
    setError(null);
    setSuccess(null);

    try {
      const res = await fetch('/api/anonymous/pair/redeem', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ticketId: params.ticketId,
          passcode: params.passcode,
          mode: syncMode,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to sync session');
      }

      try {
        window.localStorage.setItem(PAIRING_CONNECTION_STORAGE_KEY, 'true');
      } catch {
        // Connection marker is optional browser state
      }

      cleanUrlParams();
      setSuccess(data.message || (syncMode === 'merge' ? 'Quizzes merged successfully!' : 'Session connected!'));

      setTimeout(() => {
        window.location.reload();
      }, 1000);
    } catch (err: any) {
      setError(err.message || 'Unable to connect device session');
      setLinking(false);
    }
  }

  if (!isOpen || !params) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-background/80 dark:bg-black/75 backdrop-blur-md animate-in fade-in duration-200"
        onClick={linking ? undefined : handleDismiss}
        aria-hidden="true"
      />

      {/* Modal Dialog */}
      <div className="relative w-full max-w-md rounded-3xl border border-border/80 bg-card/95 p-6 shadow-2xl backdrop-blur-2xl animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-start justify-between pb-4 border-b border-border/50">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-10 h-10 rounded-2xl bg-primary/10 text-primary shadow-2xs">
              <Smartphone className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <h3 className="text-base font-extrabold text-foreground tracking-tight">Connect Synced Device</h3>
                <span className="flex items-center gap-1 rounded-full bg-primary/10 text-primary px-2 py-0.5 text-[10px] font-bold">
                  <Sparkles className="h-3 w-3" />
                  Scanned
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                QR code detected from another session
              </p>
            </div>
          </div>

          <button
            onClick={handleDismiss}
            disabled={linking}
            className="text-muted-foreground hover:text-foreground p-1.5 rounded-xl hover:bg-muted/50 transition-colors disabled:opacity-40"
            title="Dismiss"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Content Body */}
        <div className="py-4 space-y-4">
          {/* Scanned credentials badge */}
          <div className="rounded-2xl border border-border/80 bg-muted/20 p-3 flex items-center justify-around gap-2 text-center">
            <div>
              <span className="text-[10px] font-bold uppercase text-muted-foreground block mb-0.5">Sync ID</span>
              <span className="font-mono text-base font-black text-foreground px-2.5 py-1 rounded-lg bg-card border border-border/70 shadow-2xs tracking-wider">
                {params.ticketId}
              </span>
            </div>
            <span className="text-muted-foreground font-bold text-lg mt-3">-</span>
            <div>
              <span className="text-[10px] font-bold uppercase text-muted-foreground block mb-0.5">Passcode</span>
              <span className="font-mono text-base font-black text-foreground px-2.5 py-1 rounded-lg bg-card border border-border/70 shadow-2xs tracking-widest">
                {params.passcode.slice(0, 3)} {params.passcode.slice(3)}
              </span>
            </div>
          </div>

          {error && (
            <div className="flex items-center gap-2 p-3 rounded-2xl bg-destructive/10 text-destructive text-xs font-medium animate-in fade-in duration-150">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {success && (
            <div className="flex items-center gap-2 p-3 rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-xs font-medium animate-in fade-in duration-150">
              <Check className="h-4 w-4 shrink-0" />
              <span>{success}</span>
            </div>
          )}

          {/* Sync Mode Radio Options */}
          <div className="space-y-2">
            <div className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
              Choose Sync Method
            </div>

            <label className={`flex items-start gap-3 p-3.5 rounded-2xl border transition-all cursor-pointer ${
              syncMode === 'merge'
                ? 'border-primary bg-primary/5 shadow-xs'
                : 'border-border/70 bg-card hover:bg-muted/30'
            }`}>
              <input
                type="radio"
                name="autoPairSyncMode"
                value="merge"
                checked={syncMode === 'merge'}
                onChange={() => setSyncMode('merge')}
                disabled={linking || Boolean(success)}
                className="mt-0.5 text-primary focus:ring-0"
              />
              <div className="text-xs">
                <div className="font-bold text-foreground flex items-center gap-1.5">
                  Merge quizzes
                  <span className="rounded-md bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 px-1.5 py-0.5 text-[9px] font-extrabold uppercase">
                    Recommended
                  </span>
                </div>
                <div className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed">
                  Keep this device&apos;s guest ID and combine its quizzes with the scanned device.
                </div>
              </div>
            </label>

            <label className={`flex items-start gap-3 p-3.5 rounded-2xl border transition-all cursor-pointer ${
              syncMode === 'replace'
                ? 'border-primary bg-primary/5 shadow-xs'
                : 'border-border/70 bg-card hover:bg-muted/30'
            }`}>
              <input
                type="radio"
                name="autoPairSyncMode"
                value="replace"
                checked={syncMode === 'replace'}
                onChange={() => setSyncMode('replace')}
                disabled={linking || Boolean(success)}
                className="mt-0.5 text-primary focus:ring-0"
              />
              <div className="text-xs">
                <div className="font-bold text-foreground">Replace session</div>
                <div className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed">
                  Switch completely to the scanned device&apos;s session.
                </div>
              </div>
            </label>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="pt-2 border-t border-border/50 flex items-center justify-end gap-2.5">
          <button
            type="button"
            onClick={handleDismiss}
            disabled={linking}
            className="rounded-xl border border-border/80 bg-background px-4 py-2.5 text-xs font-bold text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-all disabled:opacity-50"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={handleConnect}
            disabled={linking || Boolean(success)}
            className="flex items-center justify-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-xs font-bold text-white hover:bg-primary/90 transition-all shadow-xs disabled:opacity-50"
          >
            {linking ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Connecting...</span>
              </>
            ) : (
              <>
                <ArrowRightLeft className="h-4 w-4" />
                <span>Connect &amp; Sync</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
