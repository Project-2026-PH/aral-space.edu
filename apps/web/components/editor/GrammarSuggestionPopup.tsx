'use client';

import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { GrammarIssue } from '@/lib/grammar/types';
import { Check, X, ArrowRight, SpellCheck, Sparkles, AlertCircle } from 'lucide-react';

interface GrammarSuggestionPopupProps {
  issue: GrammarIssue;
  position: { top: number; left: number; isAbove?: boolean; arrowLeft?: number };
  onApply: (issue: GrammarIssue, replacement: string) => void;
  onIgnore: (issue: GrammarIssue) => void;
  onClose: () => void;
}

export default function GrammarSuggestionPopup({
  issue,
  position,
  onApply,
  onIgnore,
  onClose
}: GrammarSuggestionPopupProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const isSpelling = issue.ruleType === 'spelling';
  const isGrammar = issue.ruleType === 'grammar';

  const firstChar = issue.originalText.trim().charAt(0);
  const isFirstUpper = firstChar === firstChar.toUpperCase() && firstChar !== firstChar.toLowerCase();
  const formatWord = (word: string) =>
    isFirstUpper && word.length > 0 ? word.charAt(0).toUpperCase() + word.slice(1) : word;

  if (!mounted || typeof document === 'undefined') return null;

  return createPortal(
    <div
      role="dialog"
      aria-label="Grammar suggestion"
      className="fixed z-50 w-72 rounded-2xl border border-border bg-card p-3 shadow-xl animate-in fade-in zoom-in-95 duration-150"
      style={{ top: `${position.top}px`, left: `${position.left}px` }}
      onPointerDown={(e) => e.stopPropagation()}
    >
      {/* Target word pointer arrow */}
      <div
        className={`absolute h-2.5 w-2.5 rotate-45 border-border bg-card ${
          position.isAbove ? '-bottom-1.5 border-b border-r' : '-top-1.5 border-t border-l'
        }`}
        style={{ left: `${position.arrowLeft ?? 36}px` }}
      />
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border/60 pb-2">
        <div className="flex items-center gap-1.5">
          {isSpelling ? (
            <SpellCheck className="h-3.5 w-3.5 text-rose-500" />
          ) : isGrammar ? (
            <Sparkles className="h-3.5 w-3.5 text-blue-500" />
          ) : (
            <AlertCircle className="h-3.5 w-3.5 text-amber-500" />
          )}
          <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
            {isSpelling ? 'Spelling' : isGrammar ? 'Grammar' : 'Style suggestion'}
          </span>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close popup"
          className="rounded-lg p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <X className="h-3 w-3" />
        </button>
      </div>

      {/* Suggestion Chips */}
      <div className="mt-2.5">
        <div className="mb-1.5 flex items-center gap-2 text-xs">
          <span className="line-through text-muted-foreground font-medium">{issue.originalText}</span>
          <ArrowRight className="h-3 w-3 text-muted-foreground" />
          {issue.replacements.length > 0 && (
            <span className="font-bold text-primary">{formatWord(issue.replacements[0])}</span>
          )}
        </div>

        {issue.replacements.length > 0 ? (
          <div className="flex flex-wrap gap-1.5 mt-2">
            {issue.replacements.map((replacement, i) => {
              const formatted = formatWord(replacement);
              return (
                <button
                  key={i}
                  type="button"
                  onClick={() => onApply(issue, formatted)}
                  className={`inline-flex items-center gap-1 rounded-xl px-2.5 py-1 text-xs font-semibold transition-colors ${
                    i === 0
                      ? 'bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm'
                      : 'bg-muted text-foreground hover:bg-accent'
                  }`}
                >
                  {i === 0 && <Check className="h-3 w-3" />}
                  {formatted}
                </button>
              );
            })}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground italic">No automatic replacement available</p>
        )}
      </div>

      {/* Explanation message */}
      <p className="mt-2.5 text-[11px] leading-relaxed text-muted-foreground">
        {issue.message}
      </p>

      {/* Bottom Actions */}
      <div className="mt-3 flex items-center justify-between border-t border-border/60 pt-2 text-[11px]">
        <button
          type="button"
          onClick={() => onIgnore(issue)}
          className="text-muted-foreground hover:text-foreground font-medium"
        >
          Ignore
        </button>
        {issue.replacements.length > 0 && (
          <button
            type="button"
            onClick={() => onApply(issue, formatWord(issue.replacements[0]))}
            className="font-bold text-primary hover:underline"
          >
            Apply suggestion
          </button>
        )}
      </div>
    </div>,
    document.body
  );
}
