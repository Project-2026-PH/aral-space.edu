'use client';

import React, { useState } from 'react';
import { Bold, Italic, Strikethrough, Code2, Link2, ChevronDown, List, ListOrdered, Pilcrow, Minus, IndentIncrease, IndentDecrease } from 'lucide-react';

interface RichTextToolbarProps {
  editorRef: React.RefObject<HTMLDivElement | null>;
  selectionRef?: React.MutableRefObject<Range | null>;
  floating?: boolean;
}

type BlockStyle = 'p' | 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6';

const STYLE_OPTIONS: Array<{ tag: BlockStyle; label: string; shortcut: string }> = [
  { tag: 'p', label: 'Normal text', shortcut: 'Ctrl+Alt+0' },
  { tag: 'h1', label: 'Heading 1', shortcut: 'Ctrl+Alt+1' },
  { tag: 'h2', label: 'Heading 2', shortcut: 'Ctrl+Alt+2' },
  { tag: 'h3', label: 'Heading 3', shortcut: 'Ctrl+Alt+3' },
  { tag: 'h4', label: 'Heading 4', shortcut: 'Ctrl+Alt+4' },
  { tag: 'h5', label: 'Heading 5', shortcut: 'Ctrl+Alt+5' },
  { tag: 'h6', label: 'Heading 6', shortcut: 'Ctrl+Alt+6' },
];

function restoreSelection(selectionRef?: React.MutableRefObject<Range | null>) {
  const range = selectionRef?.current;
  if (!range) return;
  const selection = window.getSelection();
  if (!selection) return;
  selection.removeAllRanges();
  selection.addRange(range.cloneRange());
}

function runCommand(
  editorRef: React.RefObject<HTMLDivElement | null>,
  command: string,
  value?: string,
  selectionRef?: React.MutableRefObject<Range | null>
) {
  restoreSelection(selectionRef);
  editorRef.current?.focus();
  document.execCommand(command, false, value);
  editorRef.current?.dispatchEvent(new Event('input', { bubbles: true }));
}

function MenuItem({ label, shortcut, icon, onClick, disabled = false }: {
  label: string;
  shortcut?: string;
  icon?: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-xs font-semibold text-foreground transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-40"
    >
      {icon && <span className="flex h-4 w-4 shrink-0 items-center justify-center text-muted-foreground">{icon}</span>}
      <span className="min-w-0 flex-1">{label}</span>
      {shortcut && <kbd className="shrink-0 rounded bg-muted px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground">{shortcut}</kbd>}
    </button>
  );
}

export default function RichTextToolbar({ editorRef, selectionRef, floating = false }: RichTextToolbarProps) {
  const [styleOpen, setStyleOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [listOpen, setListOpen] = useState(false);

  function runEditorCommand(command: string, value?: string) {
    runCommand(editorRef, command, value, selectionRef);
  }

  function closeMenus() {
    setStyleOpen(false);
    setMoreOpen(false);
    setListOpen(false);
  }

  function setBlock(tag: BlockStyle) {
    runEditorCommand('formatBlock', tag);
    closeMenus();
  }

  function addLink() {
    const url = window.prompt('Paste a link URL');
    if (url?.trim()) runEditorCommand('createLink', url.trim());
  }

  function clearFormatting() {
    runEditorCommand('removeFormat');
    runEditorCommand('formatBlock', 'p');
    closeMenus();
  }

  return (
    <div className={`rich-text-toolbar flex flex-wrap items-center gap-1 border-b border-border/70 bg-muted/30 p-2 ${floating ? 'rich-text-toolbar-floating' : ''}`} onMouseDown={(event) => event.preventDefault()}>
      <div className="relative">
        <button
          type="button"
          title="Text style"
          aria-label="Text style"
          aria-expanded={styleOpen}
          onClick={() => { setStyleOpen((value) => !value); setMoreOpen(false); setListOpen(false); }}
          className={`inline-flex h-8 items-center gap-1 rounded-lg px-2 text-xs font-bold text-foreground hover:bg-muted ${styleOpen ? 'bg-muted' : ''}`}
        >
          <span className="text-sm">Tt</span><ChevronDown className="h-3 w-3" />
        </button>
        {styleOpen && (
          <div className="absolute left-0 top-9 z-30 min-w-60 rounded-xl border border-border bg-card p-1.5 shadow-xl">
            {STYLE_OPTIONS.map((option) => (
              <MenuItem key={option.tag} label={option.label} shortcut={option.shortcut} onClick={() => setBlock(option.tag)} />
            ))}
          </div>
        )}
      </div>

      <button type="button" title="Bold" aria-label="Bold" onClick={() => runEditorCommand('bold')} className="inline-flex h-8 w-8 items-center justify-center rounded-lg font-bold text-foreground hover:bg-muted"><Bold className="h-4 w-4" /></button>
      <button type="button" title="Italic" aria-label="Italic" onClick={() => runEditorCommand('italic')} className="inline-flex h-8 w-8 items-center justify-center rounded-lg font-serif italic text-foreground hover:bg-muted"><Italic className="h-4 w-4" /></button>

      <div className="relative">
        <button type="button" title="Additional formatting" aria-label="Additional formatting" aria-expanded={moreOpen} onClick={() => { setMoreOpen((value) => !value); setStyleOpen(false); setListOpen(false); }} className={`inline-flex h-8 w-8 items-center justify-center rounded-lg text-sm font-bold text-foreground hover:bg-muted ${moreOpen ? 'bg-muted' : ''}`}>•••</button>
        {moreOpen && <div className="absolute left-0 top-9 z-30 min-w-60 rounded-xl border border-border bg-card p-1.5 shadow-xl">
          <MenuItem label="Strikethrough" shortcut="Ctrl+Shift+S" icon={<Strikethrough className="h-3.5 w-3.5" />} onClick={() => { runEditorCommand('strikeThrough'); closeMenus(); }} />
          <MenuItem label="Code" shortcut="Ctrl+Shift+M" icon={<Code2 className="h-3.5 w-3.5" />} onClick={() => { runEditorCommand('formatBlock', 'pre'); closeMenus(); }} />
          <MenuItem label="Clear formatting" shortcut={'Ctrl+\\'} onClick={clearFormatting} />
          <div className="my-1 border-t border-border/70" aria-hidden="true" />
          <MenuItem label="Horizontal line" shortcut="Ctrl+Shift+-" icon={<Minus className="h-3.5 w-3.5" />} onClick={() => { runEditorCommand('insertHorizontalRule'); closeMenus(); }} />
        </div>}
      </div>

      <div className="relative">
        <button type="button" title="List formatting" aria-label="List formatting" aria-expanded={listOpen} onClick={() => { setListOpen((value) => !value); setStyleOpen(false); setMoreOpen(false); }} className={`inline-flex h-8 items-center gap-1 rounded-lg px-2 text-foreground hover:bg-muted ${listOpen ? 'bg-muted' : ''}`}><List className="h-4 w-4" /><ChevronDown className="h-3 w-3" /></button>
        {listOpen && <div className="absolute left-0 top-9 z-30 min-w-60 rounded-xl border border-border bg-card p-1.5 shadow-xl">
          <MenuItem label="Bullet list" shortcut="Ctrl+Shift+8" icon={<List className="h-3.5 w-3.5" />} onClick={() => { runEditorCommand('insertUnorderedList'); closeMenus(); }} />
          <MenuItem label="Numbered list" shortcut="Ctrl+Shift+7" icon={<ListOrdered className="h-3.5 w-3.5" />} onClick={() => { runEditorCommand('insertOrderedList'); closeMenus(); }} />
          <div className="my-1 border-t border-border/70" aria-hidden="true" />
          <MenuItem label="Indent / Sub-bullet" shortcut="Tab" icon={<IndentIncrease className="h-3.5 w-3.5" />} onClick={() => { runEditorCommand('indent'); closeMenus(); }} />
          <MenuItem label="Outdent" shortcut="Shift+Tab" icon={<IndentDecrease className="h-3.5 w-3.5" />} onClick={() => { runEditorCommand('outdent'); closeMenus(); }} />
        </div>}
      </div>

      <button type="button" title="Add link" aria-label="Add link" onClick={addLink} className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-foreground hover:bg-muted"><Link2 className="h-4 w-4" /></button>
      <span className="ml-auto hidden items-center gap-1 text-[10px] font-semibold text-muted-foreground sm:inline-flex"><Pilcrow className="h-3 w-3" />Rich text</span>
    </div>
  );
}
