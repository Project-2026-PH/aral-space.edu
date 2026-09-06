'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Bold, Italic, Strikethrough, Code2, Link2, ChevronDown, List, ListOrdered, Pilcrow, Minus, IndentIncrease, IndentDecrease, Undo2, Redo2 } from 'lucide-react';

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

const COLOR_OPTIONS: Array<{ label: string; value: string; bg: string; border?: boolean }> = [
  { label: 'Default', value: 'inherit', bg: 'transparent', border: true },
  { label: 'Dark Gray', value: '#374151', bg: '#374151' },
  { label: 'Muted Gray', value: '#6b7280', bg: '#6b7280' },
  { label: 'Red', value: '#ef4444', bg: '#ef4444' },
  { label: 'Orange', value: '#f97316', bg: '#f97316' },
  { label: 'Amber', value: '#f59e0b', bg: '#f59e0b' },
  { label: 'Emerald', value: '#10b981', bg: '#10b981' },
  { label: 'Teal', value: '#14b8a6', bg: '#14b8a6' },
  { label: 'Blue', value: '#3b82f6', bg: '#3b82f6' },
  { label: 'Indigo', value: '#6366f1', bg: '#6366f1' },
  { label: 'Purple', value: '#8b5cf6', bg: '#8b5cf6' },
  { label: 'Pink', value: '#ec4899', bg: '#ec4899' },
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
  if (editorRef.current) {
    editorRef.current.focus();
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0 || !editorRef.current.contains(sel.anchorNode)) {
      const range = document.createRange();
      range.selectNodeContents(editorRef.current);
      range.collapse(false);
      sel?.removeAllRanges();
      sel?.addRange(range);
    }
  }
  try {
    document.execCommand('styleWithCSS', false, 'true');
  } catch {
    // Ignore unsupported
  }
  document.execCommand(command, false, value ?? '');
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
  const [colorOpen, setColorOpen] = useState(false);
  const [activeColor, setActiveColor] = useState<string | null>(null);

  const toolbarRef = React.useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!styleOpen && !moreOpen && !listOpen && !colorOpen) return;
    function handleClickOutside(event: MouseEvent) {
      if (toolbarRef.current && !toolbarRef.current.contains(event.target as Node)) {
        closeMenus();
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [styleOpen, moreOpen, listOpen, colorOpen]);

  function runEditorCommand(command: string, value?: string) {
    runCommand(editorRef, command, value, selectionRef);
  }

  function closeMenus() {
    setStyleOpen(false);
    setMoreOpen(false);
    setListOpen(false);
    setColorOpen(false);
  }

  function setBlock(tag: BlockStyle) {
    runEditorCommand('formatBlock', tag);
    closeMenus();
  }

  function setFontColor(color: string) {
    if (color === 'inherit') {
      runEditorCommand('foreColor', 'inherit');
      setActiveColor(null);
    } else {
      runEditorCommand('foreColor', color);
      setActiveColor(color);
    }
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
    <div
      ref={toolbarRef}
      className={`rich-text-toolbar flex flex-wrap items-center gap-1 border-b border-border/70 bg-muted/30 p-2 ${floating ? 'rich-text-toolbar-floating' : ''}`}
      onMouseDown={(event) => event.preventDefault()}
    >
      <button
        type="button"
        title="Undo (Ctrl+Z)"
        aria-label="Undo"
        onClick={() => runEditorCommand('undo')}
        className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-foreground hover:bg-muted active:scale-95"
      >
        <Undo2 className="h-4 w-4" />
      </button>
      <button
        type="button"
        title="Redo (Ctrl+Y / Ctrl+Shift+Z)"
        aria-label="Redo"
        onClick={() => runEditorCommand('redo')}
        className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-foreground hover:bg-muted active:scale-95"
      >
        <Redo2 className="h-4 w-4" />
      </button>
      <div className="mx-0.5 h-4 w-[1px] bg-border/70" aria-hidden="true" />

      <div className="relative">
        <button
          type="button"
          title="Text style"
          aria-label="Text style"
          aria-expanded={styleOpen}
          onClick={() => { setStyleOpen((value) => !value); setMoreOpen(false); setListOpen(false); setColorOpen(false); }}
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
        <button
          type="button"
          title="Font color"
          aria-label="Font color"
          aria-expanded={colorOpen}
          onClick={() => {
            setColorOpen((value) => !value);
            setStyleOpen(false);
            setMoreOpen(false);
            setListOpen(false);
          }}
          className={`inline-flex h-8 items-center gap-1 rounded-lg px-2 text-foreground hover:bg-muted ${colorOpen ? 'bg-muted' : ''}`}
        >
          <div className="flex flex-col items-center justify-center">
            <span className="text-xs font-bold leading-none">A</span>
            <span
              className="mt-0.5 h-[3px] w-3 rounded-full border border-border/40"
              style={{ backgroundColor: activeColor && activeColor !== 'inherit' ? activeColor : 'currentColor' }}
            />
          </div>
          <ChevronDown className="h-3 w-3" />
        </button>

        {colorOpen && (
          <div
            className="absolute left-0 top-9 z-30 w-56 rounded-xl border border-border bg-card p-2.5 shadow-xl"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className="mb-2 flex items-center justify-between px-0.5">
              <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Text color</span>
              <button
                type="button"
                onClick={() => setFontColor('inherit')}
                className="text-[10px] font-semibold text-primary hover:underline"
              >
                Reset
              </button>
            </div>

            <div className="grid grid-cols-6 gap-1.5 pb-2">
              {COLOR_OPTIONS.map((item) => (
                <button
                  key={item.value}
                  type="button"
                  title={item.label}
                  aria-label={item.label}
                  onClick={() => setFontColor(item.value)}
                  className="group flex h-7 w-7 items-center justify-center rounded-lg border border-border/60 hover:scale-110 transition-transform active:scale-95"
                >
                  <span
                    className={`h-4 w-4 rounded-full ${item.border ? 'border border-foreground/40 bg-foreground/10' : ''}`}
                    style={{ backgroundColor: item.bg !== 'transparent' ? item.bg : undefined }}
                  />
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2 border-t border-border/70 pt-2">
              <label htmlFor="custom-font-color" className="text-xs font-medium text-foreground">Custom</label>
              <input
                id="custom-font-color"
                type="color"
                value={activeColor && activeColor !== 'inherit' ? activeColor : '#3b82f6'}
                onChange={(e) => setFontColor(e.target.value)}
                className="h-6 w-8 cursor-pointer rounded border border-border bg-transparent p-0"
              />
              <span className="truncate text-[11px] text-muted-foreground">
                {activeColor && activeColor !== 'inherit' ? activeColor : 'Auto'}
              </span>
            </div>
          </div>
        )}
      </div>

      <div className="relative">
        <button type="button" title="Additional formatting" aria-label="Additional formatting" aria-expanded={moreOpen} onClick={() => { setMoreOpen((value) => !value); setStyleOpen(false); setListOpen(false); setColorOpen(false); }} className={`inline-flex h-8 w-8 items-center justify-center rounded-lg text-sm font-bold text-foreground hover:bg-muted ${moreOpen ? 'bg-muted' : ''}`}>•••</button>
        {moreOpen && <div className="absolute left-0 top-9 z-30 min-w-60 rounded-xl border border-border bg-card p-1.5 shadow-xl">
          <MenuItem label="Strikethrough" shortcut="Ctrl+Shift+S" icon={<Strikethrough className="h-3.5 w-3.5" />} onClick={() => { runEditorCommand('strikeThrough'); closeMenus(); }} />
          <MenuItem label="Code" shortcut="Ctrl+Shift+M" icon={<Code2 className="h-3.5 w-3.5" />} onClick={() => { runEditorCommand('formatBlock', 'pre'); closeMenus(); }} />
          <MenuItem label="Clear formatting" shortcut={'Ctrl+\\'} onClick={clearFormatting} />
          <div className="my-1 border-t border-border/70" aria-hidden="true" />
          <MenuItem label="Horizontal line" shortcut="Ctrl+Shift+-" icon={<Minus className="h-3.5 w-3.5" />} onClick={() => { runEditorCommand('insertHorizontalRule'); closeMenus(); }} />
        </div>}
      </div>

      <div className="relative">
        <button type="button" title="List formatting" aria-label="List formatting" aria-expanded={listOpen} onClick={() => { setListOpen((value) => !value); setStyleOpen(false); setMoreOpen(false); setColorOpen(false); }} className={`inline-flex h-8 items-center gap-1 rounded-lg px-2 text-foreground hover:bg-muted ${listOpen ? 'bg-muted' : ''}`}><List className="h-4 w-4" /><ChevronDown className="h-3 w-3" /></button>
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
