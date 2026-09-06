'use client';

import React, { useEffect, useState, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { GrammarIssue } from '@/lib/grammar/types';
import { extractTextWithOffsets, createRangeFromOffsets } from '@/lib/grammar/domOffsetMapper';

interface HighlightItem {
  issue: GrammarIssue;
  top: number;
  left: number;
  width: number;
  clientRect: DOMRect;
}

interface GrammarOverlayProps {
  editorRef: React.RefObject<HTMLDivElement | null>;
  containerRef?: React.RefObject<HTMLDivElement | null>;
  issues: GrammarIssue[];
  activeIssueId: string | null;
  onSelectIssue: (issue: GrammarIssue, clientRect: DOMRect) => void;
}

export default function GrammarOverlay({
  editorRef,
  issues,
  activeIssueId,
  onSelectIssue
}: GrammarOverlayProps) {
  const [highlights, setHighlights] = useState<HighlightItem[]>([]);
  const [mounted, setMounted] = useState(false);
  const animFrameRef = useRef<number | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  const calculatePositions = useCallback(() => {
    const editor = editorRef.current;
    if (!editor || issues.length === 0) {
      setHighlights([]);
      return;
    }

    const editorRect = editor.getBoundingClientRect();
    if (editorRect.width === 0 && editorRect.height === 0) return;

    const { entries } = extractTextWithOffsets(editor);
    const newHighlights: HighlightItem[] = [];

    for (const issue of issues) {
      const range = createRangeFromOffsets(entries, issue.from, issue.to, issue.originalText);
      if (!range) continue;

      const rects = range.getClientRects();
      for (let i = 0; i < rects.length; i++) {
        const rect = rects[i];
        if (rect.width === 0 || rect.height === 0) continue;

        // Clip strictly to visible editor viewport area
        if (
          rect.bottom < editorRect.top + 2 ||
          rect.top > editorRect.bottom - 2 ||
          rect.right < editorRect.left + 2 ||
          rect.left > editorRect.right - 2
        ) {
          continue;
        }

        const baselineOffset = Math.max(2, Math.round(rect.height * 0.15));
        const top = Math.round(rect.bottom - baselineOffset);
        const left = Math.round(rect.left);

        newHighlights.push({
          issue,
          top,
          left,
          width: Math.round(rect.width),
          clientRect: rect
        });
      }
    }

    setHighlights(newHighlights);
  }, [editorRef, issues]);

  const scheduleUpdate = useCallback(() => {
    if (animFrameRef.current !== null) {
      cancelAnimationFrame(animFrameRef.current);
    }
    animFrameRef.current = requestAnimationFrame(calculatePositions);
  }, [calculatePositions]);

  useEffect(() => {
    scheduleUpdate();
  }, [scheduleUpdate]);

  useEffect(() => {
    const editor = editorRef.current;
    if (!editor) return;

    const handleUpdate = () => scheduleUpdate();
    editor.addEventListener('scroll', handleUpdate, { passive: true });
    window.addEventListener('scroll', handleUpdate, true);
    window.addEventListener('resize', handleUpdate);

    // Watch for internal mutations
    const observer = new MutationObserver(() => scheduleUpdate());
    observer.observe(editor, { childList: true, subtree: true, characterData: true });

    return () => {
      editor.removeEventListener('scroll', handleUpdate);
      window.removeEventListener('scroll', handleUpdate, true);
      window.removeEventListener('resize', handleUpdate);
      observer.disconnect();
      if (animFrameRef.current !== null) {
        cancelAnimationFrame(animFrameRef.current);
      }
    };
  }, [editorRef, scheduleUpdate]);

  if (!mounted || highlights.length === 0 || typeof document === 'undefined') return null;

  return createPortal(
    <div
      className="pointer-events-none fixed inset-0 z-40 overflow-hidden"
      aria-hidden="true"
    >
      {highlights.map((item, idx) => {
        const isSpelling = item.issue.ruleType === 'spelling';
        const isGrammar = item.issue.ruleType === 'grammar';
        const isActive = activeIssueId === item.issue.id;

        return (
          <span
            key={`${item.issue.id}-${idx}`}
            role="button"
            tabIndex={0}
            aria-label={`${item.issue.ruleType} issue: ${item.issue.originalText}`}
            onClick={(e) => {
              e.stopPropagation();
              e.preventDefault();
              onSelectIssue(item.issue, item.clientRect);
            }}
            onPointerDown={(e) => {
              // Prevent editor from taking focus on pointerdown before click
              e.stopPropagation();
            }}
            className={`grammar-squiggle ${
              isSpelling
                ? 'grammar-squiggle-spelling'
                : isGrammar
                ? 'grammar-squiggle-grammar'
                : 'grammar-squiggle-style'
            } ${isActive ? 'grammar-squiggle-active' : ''}`}
            style={{
              top: `${item.top}px`,
              left: `${item.left}px`,
              width: `${item.width}px`
            }}
          />
        );
      })}
    </div>,
    document.body
  );
}
