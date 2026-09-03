'use client';

import React, { useState, useEffect, useRef } from 'react';
import { UserCheck, Shield, Copy, Check, RotateCcw, HelpCircle, X } from 'lucide-react';

interface AnonSessionData {
  anonId: string;
  isAnonymous: boolean;
  label: string;
}

function getClientAnonCookie(): string | null {
  if (typeof document === 'undefined') return null;
  const match = document.cookie.match(/(?:^|;\s*)quizmaster_anon_id=([^;]+)/);
  return match ? decodeURIComponent(match[1]) : null;
}

export default function AnonymousSessionBadge() {
  const [session, setSession] = useState<AnonSessionData | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [resetting, setResetting] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const existingCookie = getClientAnonCookie();
    if (existingCookie) {
      setSession({
        anonId: existingCookie,
        isAnonymous: true,
        label: `Guest-${existingCookie.replace('anon_', '').slice(0, 6)}`
      });
      return;
    }

    async function fetchSession() {
      try {
        const res = await fetch('/api/anonymous');
        if (res.ok) {
          const data = await res.json();
          setSession(data);
        }
      } catch (err) {
        console.error('Failed to load anonymous session:', err);
      }
    }
    fetchSession();
  }, []);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (popoverRef.current && !popoverRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  async function handleCopy() {
    if (!session?.anonId) return;
    try {
      await navigator.clipboard.writeText(session.anonId);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback
    }
  }

  async function handleReset() {
    if (!confirm('Start a new anonymous session? Your current guest quizzes will remain under previous session ID.')) {
      return;
    }
    setResetting(true);
    try {
      const res = await fetch('/api/anonymous', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'reset' })
      });
      if (res.ok) {
        window.location.reload();
      }
    } catch (err) {
      console.error('Reset failed:', err);
      setResetting(false);
    }
  }

  return (
    <div className="relative" ref={popoverRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 rounded-full border border-border/80 bg-card/80 px-3 py-1.5 text-xs font-semibold text-foreground backdrop-blur-md hover:border-primary/50 hover:bg-muted/50 transition-all shadow-2xs group"
        title="Anonymous Guest Profile (No Login Required)"
      >
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
        </span>
        <UserCheck className="h-3.5 w-3.5 text-primary group-hover:scale-110 transition-transform" />
        <span className="text-[11px] font-bold text-foreground/90">
          {session ? session.label : 'Guest Mode'}
        </span>
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 rounded-3xl border border-border bg-card p-5 shadow-xl backdrop-blur-xl z-50 animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="flex items-start justify-between pb-3 border-b border-border/50">
            <div className="flex items-center gap-2">
              <div className="flex items-center justify-center w-8 h-8 rounded-xl bg-primary/10 text-primary">
                <Shield className="h-4 w-4" />
              </div>
              <div>
                <h4 className="text-xs font-extrabold text-foreground">Anonymous Session</h4>
                <span className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">100% Login-Free</span>
              </div>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="text-muted-foreground hover:text-foreground p-1 rounded-lg transition-colors"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>

          <div className="py-3 space-y-2.5 text-xs text-muted-foreground">
            <p className="leading-relaxed text-[11px]">
              No password or account required. All created quizzes, questions, and Leitner spaced-repetition progress are isolated to this guest device session.
            </p>

            <div className="rounded-2xl border border-border/60 bg-muted/40 p-2.5 space-y-1">
              <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                Guest Device ID
              </div>
              <div className="flex items-center justify-between gap-2 font-mono text-[11px] text-foreground font-semibold">
                <span className="truncate">{session?.anonId || 'Loading...'}</span>
                <button
                  onClick={handleCopy}
                  className="p-1 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors shrink-0"
                  title="Copy ID"
                >
                  {copied ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
                </button>
              </div>
            </div>
          </div>

          <div className="pt-2 border-t border-border/50 flex items-center justify-between gap-2">
            <button
              onClick={handleReset}
              disabled={resetting}
              className="flex items-center gap-1.5 rounded-xl border border-border/80 bg-background px-3 py-1.5 text-[11px] font-bold text-muted-foreground hover:text-destructive hover:border-destructive/40 transition-all disabled:opacity-50"
            >
              <RotateCcw className="h-3 w-3" />
              <span>{resetting ? 'Resetting...' : 'New Guest Session'}</span>
            </button>

            <button
              onClick={() => setIsOpen(false)}
              className="rounded-xl bg-primary px-3 py-1.5 text-[11px] font-bold text-white hover:bg-primary/90 transition-all"
            >
              Got it
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
