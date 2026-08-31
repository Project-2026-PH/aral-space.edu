'use client';

import React, { useState } from 'react';
import Modal from '../ui/Modal';
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

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
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
          <div className="rounded-2xl border border-destructive/30 bg-destructive/10 p-3 text-xs font-semibold text-destructive">
            {error}
          </div>
        )}

        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1.5">
            Subject Name
          </label>
          <input
            type="text"
            placeholder="e.g. Molecular Genetics, Ancient History..."
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoFocus
            className="w-full rounded-2xl border border-border bg-background px-4 py-2.5 text-xs font-medium text-foreground focus:border-primary focus:outline-none"
          />
        </div>

        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">
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
                  className={`relative flex items-center justify-between px-3 py-2.5 rounded-2xl border transition-all cursor-pointer font-bold text-xs shadow-xs ${
                    isSelected
                      ? 'ring-2 ring-foreground/40 scale-[1.03] border-transparent'
                      : 'border-black/5 hover:scale-[1.01] opacity-90 hover:opacity-100'
                  }`}
                >
                  <span style={{ color: c.textColor }} className="font-extrabold text-[11px] tracking-tight">
                    {c.name}
                  </span>
                  {isSelected && (
                    <div
                      style={{ backgroundColor: c.textColor }}
                      className="w-4 h-4 rounded-full flex items-center justify-center text-white shrink-0"
                    >
                      <Check className="w-2.5 h-2.5" />
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Live Subject Badge Preview */}
        <div className="rounded-2xl border border-border/60 bg-muted/20 p-3 flex items-center justify-between">
          <span className="text-xs text-muted-foreground font-medium">Category Preview:</span>
          <span
            style={{
              backgroundColor: selectedColor.hex,
              color: selectedColor.textColor
            }}
            className="px-3 py-1 rounded-full text-xs font-extrabold shadow-2xs"
          >
            {name.trim() || 'Sample Subject'}
          </span>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="rounded-xl px-4 py-2 text-xs font-semibold text-muted-foreground hover:bg-muted transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={loading || !name.trim()}
            className="rounded-xl bg-primary px-5 py-2 text-xs font-bold text-white hover:bg-primary/90 transition-all active:scale-95 disabled:opacity-50"
          >
            {loading ? 'Creating...' : 'Create Subject'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
