'use client';

import React, { useEffect, useRef } from 'react';
import RichTextToolbar from './RichTextToolbar';
import { normalizeRichTextHtml, sanitizeRichTextHtml } from '@/lib/richText';

interface RichTextEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  minHeight?: string;
  className?: string;
  onPaste?: React.ClipboardEventHandler<HTMLDivElement>;
  'data-skip-clipboard-intercept'?: string;
}

export default function RichTextEditor({ value, onChange, placeholder = 'Start writing...', minHeight = '150px', className = '', ...props }: RichTextEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null);
  const lastValue = useRef(value);

  useEffect(() => {
    if (!editorRef.current) return;
    const normalized = normalizeRichTextHtml(value);
    if (value === lastValue.current && editorRef.current.innerHTML === normalized) return;
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

    const anchorElement = selection.anchorNode?.nodeType === Node.ELEMENT_NODE
      ? selection.anchorNode as HTMLElement
      : selection.anchorNode?.parentElement;
    const block = anchorElement?.closest('p,div,h1,h2,h3,h4,h5,h6,blockquote,pre') as HTMLElement | null;
    if (!block || block === editor || !editor.contains(block) || block.closest('li') || block.textContent?.trim() !== '-') {
      return false;
    }

    const list = document.createElement('ul');
    const item = document.createElement('li');
    item.appendChild(document.createElement('br'));
    list.appendChild(item);
    block.replaceWith(list);

    const range = document.createRange();
    range.selectNodeContents(item);
    range.collapse(false);
    selection.removeAllRanges();
    selection.addRange(range);
    handleInput();
    return true;
  }

  function handleShortcut(event: React.KeyboardEvent<HTMLDivElement>) {
    if (event.key === ' ' && handleAutoBullet()) {
      event.preventDefault();
      return;
    }

    const hasCtrl = event.ctrlKey && !event.metaKey;
    if (!hasCtrl) return;

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
    <div className={`overflow-hidden rounded-2xl border border-border bg-background focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/10 ${className}`}>
      <RichTextToolbar editorRef={editorRef} />
      <div
        ref={editorRef}
        contentEditable
        suppressContentEditableWarning
        role="textbox"
        aria-multiline="true"
        data-placeholder={placeholder}
        onInput={handleInput}
        onBlur={handleInput}
        onKeyDown={handleShortcut}
        onPaste={props.onPaste}
        className="rich-text-editor rich-text-content px-4 py-3 text-sm font-medium text-foreground outline-none"
        style={{ minHeight }}
        {...props}
      />
    </div>
  );
}
