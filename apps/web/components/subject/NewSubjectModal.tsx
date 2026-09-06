'use client';

import React, { useState } from 'react';
import Modal from '../ui/Modal';
import StickyActionDock from '../ui/StickyActionDock';
import { Check } from 'lucide-react';

export interface SubjectColor {
  name: string;
  hex: string;
  textColor: string;
}

export const SUBJECT_PALETTE: SubjectColor[] = [
  { name: 'Yellow', hex: '#FDE047', textColor: '#854D0E' },
  { name: 'Red', hex: '#FB7185', textColor: '#9F1239' },
  { name: 'Blue', hex: '#93C5FD', textColor: '#1E40AF' },
  { name: 'Green', hex: '#86EFAC', textColor: '#166534' },
  { name: 'Pink', hex: '#F472B6', textColor: '#9D174D' },
  { name: 'Purple', hex: '#C4B5FD', textColor: '#5B21B6' },
  { name: 'Orange', hex: '#FB923C', textColor: '#9A3412' }
];

interface NewSubjectModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (subject: { id: string; name: string; color: string }) => void;
}

export default function NewSubjectModal({
  open,
  onOpenChange,
  onCreated
}: NewSubjectModalProps) {
  const [name, setName] = useState('');
  const [selectedColor, setSelectedColor] = useState<SubjectColor>(SUBJECT_PALETTE[3]); // Joy / Mint by default
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleCreate(e?: React.FormEvent) {
    e?.preventDefault();
    if (!name.trim()) {
      setError('Please enter a subject name.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/subjects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          color: selectedColor.hex
        })
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Failed to create subject');
      }

      const created = await res.json();
      setName('');
      setSelectedColor(SUBJECT_PALETTE[3]);
      onCreated(created);
      onOpenChange(false);
    } catch (err: any) {
      setError(err.message || 'Failed to create subject');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title="Create New Subject"
      description="Add a course or subject category with custom palette styling."
      maxWidth="max-w-md"
    >
      <form onSubmit={handleCreate} className="space-y-5">
        {error && (
          <div className="rounded-xl border-2 border-destructive bg-destructive/10 p-3 text-xs font-black text-destructive shadow-brutal-sm">
            {error}
          </div>
        )}

        <div>
          <label className="block text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5">
            Subject Name
          </label>
          <input
            type="text"
            placeholder="e.g. Molecular Genetics, Ancient History..."
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoFocus
            className="w-full rounded-xl border-2 border-slate-900 dark:border-white/40 bg-white dark:bg-card px-4 py-2.5 text-xs font-black text-foreground shadow-brutal-sm focus:border-primary focus:outline-none"
          />
        </div>

        <div>
          <label className="block text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-2">
            Select Color Tone
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {SUBJECT_PALETTE.map((c) => {
              const isSelected = selectedColor.hex === c.hex;
              return (
                <button
                  key={c.hex}
                  type="button"
                  onClick={() => setSelectedColor(c)}
                  style={{ backgroundColor: c.hex }}
                  className={`relative flex items-center justify-between px-3 py-2.5 rounded-xl border-2 border-slate-900 shadow-brutal-sm transition-all cursor-pointer font-black text-xs ${
                    isSelected
                      ? 'scale-[1.03] shadow-[4px_4px_0px_#0f172a] ring-2 ring-slate-900'
                      : 'hover:-translate-y-0.5 hover:shadow-brutal active:translate-x-0.5 active:translate-y-0.5 active:shadow-none'
                  }`}
                >
                  <span style={{ color: c.textColor }} className="font-black text-[11px] tracking-tight">
                    {c.name}
                  </span>
                  {isSelected && (
                    <div
                      style={{ backgroundColor: c.textColor }}
                      className="w-4 h-4 rounded-full border border-slate-900 flex items-center justify-center text-white shrink-0 shadow-xs"
                    >
                      <Check className="w-2.5 h-2.5 stroke-[3]" />
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Live Subject Badge Preview */}
        <div className="rounded-2xl border-2 border-slate-900 dark:border-white/40 bg-slate-50 dark:bg-slate-900/60 p-3.5 shadow-brutal-sm flex items-center justify-between">
          <span className="text-xs font-bold text-muted-foreground">Category Preview:</span>
          <span
            style={{
              backgroundColor: selectedColor.hex,
              color: selectedColor.textColor
            }}
            className="px-3.5 py-1.5 rounded-lg border-2 border-slate-900 text-xs font-black shadow-brutal-sm"
          >
            {name.trim() || 'Sample Subject'}
          </span>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="rounded-xl border-2 border-slate-900 bg-white dark:bg-slate-800 px-4 py-2 text-xs font-black text-slate-900 dark:text-white shadow-brutal-sm hover:-translate-y-0.5 hover:shadow-brutal active:translate-x-0.5 active:translate-y-0.5 active:shadow-none transition-all cursor-pointer"
          >
            Cancel
          </button>
        </div>
      </form>
      <StickyActionDock
        onAction={() => void handleCreate()}
        disabled={loading || !name.trim()}
        ariaLabel="Create subject"
        message="Create this subject and add it to your library"
        buttonText={loading ? 'Creating...' : 'Create Subject'}
      />
    </Modal>
  );
}
