'use client';

import React, { useEffect, useRef, useState } from 'react';
import RichTextToolbar from './RichTextToolbar';
import { normalizeRichTextHtml, sanitizeRichTextHtml } from '@/lib/richText';

interface RichTextEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  minHeight?: string;
  className?: string;
  floatingToolbar?: boolean;
  onPaste?: React.ClipboardEventHandler<HTMLDivElement>;
  'data-skip-clipboard-intercept'?: string;
}

export default function RichTextEditor({ value, onChange, placeholder = 'Start writing...', minHeight = '150px', className = '', floatingToolbar = false, ...props }: RichTextEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<HTMLDivElement>(null);
  const savedSelectionRef = useRef<Range | null>(null);
  const [selectionToolbarPosition, setSelectionToolbarPosition] = useState<{ top: number; left: number } | null>(null);
  const lastValue = useRef(value);

  function hideSelectionToolbar() {
    savedSelectionRef.current = null;
    setSelectionToolbarPosition(null);
  }

  function updateSelectionToolbar() {
    if (!floatingToolbar || typeof window === 'undefined') return;
    if (window.matchMedia('(max-width: 1023px)').matches || ('ontouchstart' in window && navigator.maxTouchPoints > 0)) {
      hideSelectionToolbar();
      return;
    }

    const editor = editorRef.current;
    const selection = window.getSelection();
    if (!editor || !selection || selection.rangeCount === 0 || selection.isCollapsed) {
      hideSelectionToolbar();
      return;
    }

    const anchorNode = selection.anchorNode;
    const focusNode = selection.focusNode;
    if (!anchorNode || !focusNode || !editor.contains(anchorNode) || !editor.contains(focusNode) || !selection.toString().trim()) {
      hideSelectionToolbar();
      return;
    }

    const range = selection.getRangeAt(0);
    const rect = range.getBoundingClientRect();
    if (rect.width === 0 && rect.height === 0) {
      hideSelectionToolbar();
      return;
    }

    savedSelectionRef.current = range.cloneRange();
    const toolbarWidth = Math.min(300, window.innerWidth - 16);
    const toolbarHeight = 42;
    const left = Math.max(8, Math.min(
      window.innerWidth - toolbarWidth - 8,
      rect.left + (rect.width / 2) - (toolbarWidth / 2)
    ));
    const aboveTop = rect.top - toolbarHeight - 8;
    const top = aboveTop >= 8
      ? aboveTop
      : Math.min(window.innerHeight - toolbarHeight - 8, rect.bottom + 8);

    setSelectionToolbarPosition({ top: Math.max(8, top), left });
  }

  useEffect(() => {
    if (!floatingToolbar) {
      hideSelectionToolbar();
      return;
    }

    const refreshPosition = () => window.requestAnimationFrame(updateSelectionToolbar);
    const handlePointerDown = (event: PointerEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) hideSelectionToolbar();
    };

    document.addEventListener('selectionchange', refreshPosition);
    document.addEventListener('pointerdown', handlePointerDown);
    window.addEventListener('resize', refreshPosition);
    window.addEventListener('scroll', refreshPosition, true);

    return () => {
      document.removeEventListener('selectionchange', refreshPosition);
      document.removeEventListener('pointerdown', handlePointerDown);
      window.removeEventListener('resize', refreshPosition);
      window.removeEventListener('scroll', refreshPosition, true);
    };
  }, [floatingToolbar]);

  useEffect(() => {
    if (!editorRef.current) return;
    if (value === lastValue.current) return;
    const normalized = normalizeRichTextHtml(value);
    if (editorRef.current.innerHTML === normalized) {
      lastValue.current = value;
      return;
    }
    editorRef.current.innerHTML = normalized;
    lastValue.current = value;
  }, [value]);

  function handleInput() {
    if (!editorRef.current) return;
    const next = sanitizeRichTextHtml(editorRef.current.innerHTML);
    lastValue.current = next;
    onChange(next);
  }

  function handleAutoBullet(): boolean {
    const editor = editorRef.current;
    const selection = window.getSelection();
    if (!editor || !selection || selection.rangeCount === 0 || !selection.isCollapsed) return false;

    const anchorNode = selection.anchorNode;
    const anchorElement = anchorNode?.nodeType === Node.ELEMENT_NODE
      ? anchorNode as HTMLElement
      : anchorNode?.parentElement;
    if (!anchorElement || !editor.contains(anchorElement)) return false;

    const li = anchorElement.closest('li') as HTMLElement | null;
    if (li && editor.contains(li)) {
      const rawText = (li.textContent || '').replace(/\u00a0/g, ' ').trim();
      const matchBullet = rawText.match(/^[-*]\s*(.*)$/);
      if (matchBullet) {
        const remainingText = matchBullet[1];
        if (remainingText) {
          li.textContent = remainingText;
        } else {
          li.innerHTML = '<br>';
        }
        const range = document.createRange();
        range.selectNodeContents(li);
        range.collapse(false);
        selection.removeAllRanges();
        selection.addRange(range);
        document.execCommand('indent');
        handleInput();
        return true;
      }
      return false;
    }

    const block = anchorElement.closest('p,div,h1,h2,h3,h4,h5,h6,blockquote,pre') as HTMLElement | null;
    if (!block || block === editor || !editor.contains(block)) {
      return false;
    }

    const rawText = (block.textContent || '').replace(/\u00a0/g, ' ').trim();
    const matchBullet = rawText.match(/^[-*]\s*(.*)$/);
    if (matchBullet) {
      const remainingText = matchBullet[1];
      if (remainingText) {
        block.textContent = remainingText;
      } else {
        block.innerHTML = '<br>';
      }
      const range = document.createRange();
      range.selectNodeContents(block);
      range.collapse(false);
      selection.removeAllRanges();
      selection.addRange(range);
      document.execCommand('insertUnorderedList');
      handleInput();
      return true;
    }

    const matchOrdered = rawText.match(/^1[.)]\s*(.*)$/);
    if (matchOrdered) {
      const remainingText = matchOrdered[1];
      if (remainingText) {
        block.textContent = remainingText;
      } else {
        block.innerHTML = '<br>';
      }
      const range = document.createRange();
      range.selectNodeContents(block);
      range.collapse(false);
      selection.removeAllRanges();
      selection.addRange(range);
      document.execCommand('insertOrderedList');
      handleInput();
      return true;
    }

    return false;
  }

  function handleShortcut(event: React.KeyboardEvent<HTMLDivElement>) {
    if (event.key === ' ' && handleAutoBullet()) {
      event.preventDefault();
      return;
    }

    if (event.key === 'Tab') {
      const selection = window.getSelection();
      const anchorNode = selection?.anchorNode;
      const anchorElement = anchorNode?.nodeType === Node.ELEMENT_NODE
        ? anchorNode as HTMLElement
        : anchorNode?.parentElement;
      const li = anchorElement?.closest('li');
      if (li && editorRef.current?.contains(li)) {
        event.preventDefault();
        if (event.shiftKey) {
          document.execCommand('outdent');
        } else {
          document.execCommand('indent');
        }
        handleInput();
        return;
      }
    }

    if (event.key === 'Backspace') {
      const selection = window.getSelection();
      if (selection && selection.isCollapsed && selection.rangeCount > 0) {
        const anchorNode = selection.anchorNode;
        const anchorElement = anchorNode?.nodeType === Node.ELEMENT_NODE
          ? anchorNode as HTMLElement
          : anchorNode?.parentElement;
        const li = anchorElement?.closest('li');
        if (li && editorRef.current?.contains(li)) {
          const isNested = Boolean(li.parentElement?.closest('li'));
          const text = (li.textContent || '').replace(/\u00a0/g, ' ').trim();
          if (isNested && text === '') {
            event.preventDefault();
            document.execCommand('outdent');
            handleInput();
            return;
          }
        }
      }
    }

    const hasCtrl = event.ctrlKey || event.metaKey;

    if (hasCtrl && !event.altKey && event.key.toLowerCase() === 'z') {
      event.preventDefault();
      document.execCommand(event.shiftKey ? 'redo' : 'undo');
      handleInput();
      return;
    }

    if (hasCtrl && !event.altKey && !event.shiftKey && event.key.toLowerCase() === 'y') {
      event.preventDefault();
      document.execCommand('redo');
      handleInput();
      return;
    }

    const hasCtrlOnly = event.ctrlKey && !event.metaKey;
    if (!hasCtrlOnly) return;

    let command: string | null = null;
    let value: string | undefined;

    if (event.altKey && !event.shiftKey && /^Digit[0-6]$/.test(event.code)) {
      const level = event.code.slice(-1);
      command = 'formatBlock';
      value = level === '0' ? 'p' : `h${level}`;
    } else if (event.shiftKey && !event.altKey && event.key.toLowerCase() === 's') {
      command = 'strikeThrough';
    } else if (event.shiftKey && !event.altKey && event.key.toLowerCase() === 'm') {
      command = 'formatBlock';
      value = 'pre';
    } else if (event.shiftKey && !event.altKey && event.code === 'Minus') {
      command = 'insertHorizontalRule';
    } else if (!event.altKey && !event.shiftKey && event.code === 'Backslash') {
      document.execCommand('removeFormat');
      document.execCommand('formatBlock', false, 'p');
    } else if (event.shiftKey && !event.altKey && event.code === 'Digit8') {
      command = 'insertUnorderedList';
    } else if (event.shiftKey && !event.altKey && event.code === 'Digit7') {
      command = 'insertOrderedList';
    }

    if (!command && !(event.code === 'Backslash' && !event.altKey && !event.shiftKey)) return;
    event.preventDefault();
    if (command) document.execCommand(command, false, value);
    handleInput();
  }

  return (
    <div ref={containerRef} className={`overflow-hidden rounded-2xl border border-border bg-background focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/10 ${className}`}>
      <RichTextToolbar editorRef={editorRef} />
      {floatingToolbar && selectionToolbarPosition && (
        <div
          className="rich-text-selection-toolbar"
          role="toolbar"
          aria-label="Formatting for selected text"
          style={selectionToolbarPosition}
        >
          <RichTextToolbar editorRef={editorRef} selectionRef={savedSelectionRef} floating />
        </div>
      )}
      <div
        ref={editorRef}
        contentEditable
        suppressContentEditableWarning
        role="textbox"
        aria-multiline="true"
        data-placeholder={placeholder}
        onInput={handleInput}
        onBlur={handleInput}
        onSelect={floatingToolbar ? updateSelectionToolbar : undefined}
        onContextMenu={(event) => {
          if ('ontouchstart' in window || navigator.maxTouchPoints > 0) {
            event.preventDefault();
          }
        }}
        onKeyDown={handleShortcut}
        onPaste={props.onPaste}
        className="rich-text-editor rich-text-content px-4 py-3 text-sm font-medium text-foreground outline-none"
        style={{ minHeight }}
        {...props}
      />
    </div>
  );
}
