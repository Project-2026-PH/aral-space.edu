'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, FileText, Plus, Save, Trash2, BookOpen, Download, LoaderCircle } from 'lucide-react';
import FloatingBottomNav from '@/components/navigation/FloatingBottomNav';
import RichTextEditor from '@/components/editor/RichTextEditor';
import { createNote, loadNotes, saveNotes, type NoteDocument } from '@/lib/notes';
import { openPrintDocument, richTextToPlainText } from '@/lib/richText';

export default function NotesClient() {
  const [notes, setNotes] = useState<NoteDocument[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [savingReviewer, setSavingReviewer] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    const stored = loadNotes();
    setNotes(stored);
    setSelectedId(stored[0]?.id || null);
    setHydrated(true);
  }, []);

  const selectedNote = useMemo(() => notes.find((note) => note.id === selectedId) || null, [notes, selectedId]);

  function updateNote(patch: Partial<NoteDocument>) {
    if (!selectedId) return;
    setNotes((current) => current.map((note) => note.id === selectedId ? { ...note, ...patch, updatedAt: new Date().toISOString() } : note));
    setStatus(null);
  }

  function addNote() {
    const note = createNote();
    setNotes((current) => [note, ...current]);
    setSelectedId(note.id);
    setStatus(null);
  }

  function removeNote() {
    if (!selectedNote || !window.confirm('Delete this note?')) return;
    const remaining = notes.filter((note) => note.id !== selectedNote.id);
    setNotes(remaining);
    setSelectedId(remaining[0]?.id || null);
  }

  useEffect(() => {
    if (!hydrated) return;
    const timeout = window.setTimeout(() => saveNotes(notes), 350);
    return () => window.clearTimeout(timeout);
  }, [notes, hydrated]);

  async function saveAsReviewer() {
    if (!selectedNote) return;
    const plainText = richTextToPlainText(selectedNote.content);
    if (!plainText) {
      setStatus('Add some content before saving as a reviewer.');
      return;
    }
    setSavingReviewer(true);
    setStatus(null);
    const lines = plainText.split(/\n+/).map((line) => line.trim()).filter(Boolean);
    try {
      const response = await fetch('/api/quizzes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: selectedNote.title.trim() || 'Notes reviewer',
          description: plainText,
          source_model: 'notes',
          questions: lines.map((line) => ({
            question_text: `Recall: ${line}`,
            answer_text: line,
            question_type: 'typed_answer',
            options: [],
            correct_answer: 0,
            explanation: null
          }))
        })
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(data?.error || 'Could not save the reviewer.');
      setStatus('Reviewer saved. Opening it now...');
      window.location.assign(`/quizzes/${data.id}`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Could not save the reviewer.');
    } finally {
      setSavingReviewer(false);
    }
  }

  return (
    <div className="mx-auto max-w-6xl space-y-5 pb-24">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link href="/" className="inline-flex items-center gap-2 text-xs font-semibold text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4" />Back to Library</Link>
          <span className="h-5 w-px bg-border" />
          <div><p className="text-[11px] font-bold uppercase tracking-[0.18em] text-primary">Workspace</p><h1 className="text-xl font-extrabold tracking-tight text-foreground">Notes</h1></div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" onClick={addNote} className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-3.5 py-2.5 text-xs font-bold text-white shadow-lg shadow-primary/20 hover:bg-primary/90"><Plus className="h-3.5 w-3.5" />New note</button>
          {selectedNote && <>
            <button type="button" onClick={() => openPrintDocument(selectedNote.title, selectedNote.content)} className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-card px-3.5 py-2.5 text-xs font-bold text-foreground hover:bg-muted"><Download className="h-3.5 w-3.5" />Save as PDF</button>
            <button type="button" onClick={saveAsReviewer} disabled={savingReviewer} className="inline-flex items-center gap-1.5 rounded-xl border border-primary/30 bg-primary/10 px-3.5 py-2.5 text-xs font-bold text-primary hover:bg-primary hover:text-white disabled:opacity-60">{savingReviewer ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> : <BookOpen className="h-3.5 w-3.5" />}Save as reviewer</button>
          </>}
        </div>
      </div>

      {status && <div role="status" className="rounded-2xl border border-primary/20 bg-primary/5 px-4 py-3 text-xs font-semibold text-primary">{status}</div>}

      <div className="notes-workspace grid grid-cols-1 overflow-hidden rounded-3xl border border-border/80 bg-card shadow-sm lg:grid-cols-[240px_minmax(0,1fr)]">
        <aside className="border-b border-border/70 bg-card p-3 lg:border-b-0 lg:border-r">
          <div className="mb-3 flex items-center justify-between px-2"><span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Your notes</span><FileText className="h-3.5 w-3.5 text-muted-foreground" /></div>
          <div className="space-y-1">
            {notes.map((note) => <button key={note.id} type="button" onClick={() => setSelectedId(note.id)} className={`w-full rounded-xl px-3 py-2.5 text-left transition-colors ${selectedId === note.id ? 'bg-primary/10 text-primary' : 'text-foreground hover:bg-muted'}`}><span className="block truncate text-xs font-bold">{note.title || 'Untitled note'}</span><span className="mt-0.5 block truncate text-[10px] text-muted-foreground">{richTextToPlainText(note.content) || 'Empty note'}</span></button>)}
            {notes.length === 0 && <div className="rounded-xl border border-dashed border-border p-4 text-center text-[11px] text-muted-foreground">Create a note to start writing.</div>}
          </div>
        </aside>

        <section className="flex min-h-0 min-w-0 flex-col overflow-hidden bg-card p-4 sm:p-7">
          {selectedNote ? <>
            <div className="mb-5 flex items-center gap-3 border-b border-border/70 pb-4"><input value={selectedNote.title} onChange={(event) => updateNote({ title: event.target.value })} aria-label="Note title" className="min-w-0 flex-1 bg-transparent text-2xl font-extrabold tracking-tight text-foreground outline-none placeholder:text-muted-foreground" placeholder="Untitled note" /><button type="button" onClick={removeNote} aria-label="Delete note" className="rounded-xl p-2 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"><Trash2 className="h-4 w-4" /></button></div>
            <RichTextEditor value={selectedNote.content} onChange={(content) => updateNote({ content })} placeholder="Capture ideas, key concepts, lists, links, and code..." minHeight="0px" className="notes-editor" data-skip-clipboard-intercept="true" />
            <div className="mt-3 flex items-center justify-between text-[10px] font-semibold text-muted-foreground"><span className="inline-flex items-center gap-1"><Save className="h-3 w-3" />Saved locally on this device</span><span>{new Date(selectedNote.updatedAt).toLocaleString()}</span></div>
          </> : <div className="flex flex-1 flex-col items-center justify-center py-24 text-center"><FileText className="mb-3 h-10 w-10 text-primary/50" /><h2 className="text-lg font-extrabold text-foreground">Your notes workspace</h2><p className="mt-1 max-w-sm text-xs leading-relaxed text-muted-foreground">Create a Trello-style study document with headings, emphasis, lists, links, and code blocks.</p><button type="button" onClick={addNote} className="mt-5 inline-flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2.5 text-xs font-bold text-white"><Plus className="h-3.5 w-3.5" />Create your first note</button></div>}
        </section>
      </div>
          <FloatingBottomNav />
    </div>
  );
}
