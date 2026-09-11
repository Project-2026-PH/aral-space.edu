'use client';

import React, { useEffect, useState } from 'react';
import { Subject } from '@quiz-creator/types';
import Modal from '../ui/Modal';
import { Check, Pipette } from 'lucide-react';
import { SUBJECT_PALETTE, SubjectColor } from './NewSubjectModal';
import { publishLibraryMutation } from '@/lib/libraryMutationStore';

function getAccessibleTextColor(hex: string): string {
  const cleanHex = hex.replace('#', '');
  if (cleanHex.length !== 6) return '#0f172a';
  const r = parseInt(cleanHex.substring(0, 2), 16);
  const g = parseInt(cleanHex.substring(2, 4), 16);
  const b = parseInt(cleanHex.substring(4, 6), 16);
  const yiq = (r * 299 + g * 587 + b * 114) / 1000;
  return yiq >= 140 ? '#0f172a' : '#ffffff';
}

function resolveColor(hex: string): SubjectColor {
  const match = SUBJECT_PALETTE.find((c) => c.hex.toLowerCase() === hex.toLowerCase());
  if (match) return match;
  return {
    name: 'Custom',
    hex,
    textColor: getAccessibleTextColor(hex)
  };
}

interface EditSubjectModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  subject: Subject | null;
  onUpdated: (subject: Subject) => void;
}

export default function EditSubjectModal({
  open,
  onOpenChange,
  subject,
  onUpdated
}: EditSubjectModalProps) {
  const [name, setName] = useState('');
  const [selectedColor, setSelectedColor] = useState<SubjectColor>(SUBJECT_PALETTE[0]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !subject) return;
    setName(subject.name);
    setSelectedColor(resolveColor(subject.color || '#FDE047'));
    setError(null);
    setLoading(false);
  }, [open, subject]);

  async function handleUpdate(e?: React.FormEvent) {
    e?.preventDefault();
    if (!subject) return;

    const trimmed = name.trim();
    if (!trimmed) {
      setError('Please enter a subject name.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/subjects/${subject.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: trimmed,
          color: selectedColor.hex
        })
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || 'Failed to update subject');
      }

      publishLibraryMutation({ type: 'subject-updated', subject: data });
      onUpdated(data);
      onOpenChange(false);
    } catch (err: any) {
      setError(err.message || 'Failed to update subject');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title="Edit Subject"
      description={subject ? `Update details and styling for “${subject.name}”.` : 'Update subject details.'}
      maxWidth="max-w-md"
    >
      <form onSubmit={handleUpdate} className="space-y-3.5">
        {error && (
          <div className="rounded-xl border-2 border-destructive bg-destructive/10 p-2.5 text-xs font-black text-destructive shadow-brutal-sm">
            {error}
          </div>
        )}

        <div>
          <label htmlFor="edit-subject-name" className="block text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1">
            Subject Name
          </label>
          <input
            id="edit-subject-name"
            type="text"
            placeholder="e.g. Molecular Genetics, Ancient History..."
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoFocus
            className="w-full rounded-xl border-2 border-slate-900 dark:border-white/40 bg-white dark:bg-card px-3.5 py-2 text-xs font-black text-foreground shadow-brutal-sm focus:border-primary focus:outline-none"
          />
        </div>

        <div>
          <label className="block text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5">
            Select Color Tone
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
            {SUBJECT_PALETTE.map((c) => {
              const isSelected = selectedColor.hex.toLowerCase() === c.hex.toLowerCase();
              return (
                <button
                  key={c.hex}
                  type="button"
                  onClick={() => setSelectedColor(c)}
                  style={{ backgroundColor: c.hex }}
                  className={`relative flex items-center justify-between px-2.5 py-2 rounded-xl border-2 border-slate-900 shadow-brutal-sm transition-all cursor-pointer font-black text-xs ${
                    isSelected
                      ? 'scale-[1.02] shadow-[3px_3px_0px_#0f172a] ring-2 ring-slate-900'
                      : 'hover:-translate-y-0.5 hover:shadow-brutal active:translate-x-0.5 active:translate-y-0.5 active:shadow-none'
                  }`}
                >
                  <span style={{ color: c.textColor }} className="font-black text-[11px] tracking-tight">
                    {c.name}
                  </span>
                  {isSelected && (
                    <div
                      style={{ backgroundColor: c.textColor }}
                      className="w-3.5 h-3.5 rounded-full border border-slate-900 flex items-center justify-center text-white shrink-0 shadow-xs"
                    >
                      <Check className="w-2 h-2 stroke-[3]" />
                    </div>
                  )}
                </button>
              );
            })}

            {/* Custom Color Tile with Color Picker */}
            <label
              style={{ backgroundColor: selectedColor.hex }}
              className={`relative flex items-center justify-between px-2.5 py-2 rounded-xl border-2 border-slate-900 shadow-brutal-sm transition-all cursor-pointer font-black text-xs ${
                !SUBJECT_PALETTE.some((p) => p.hex.toLowerCase() === selectedColor.hex.toLowerCase())
                  ? 'scale-[1.02] shadow-[3px_3px_0px_#0f172a] ring-2 ring-slate-900'
                  : 'hover:-translate-y-0.5 hover:shadow-brutal active:translate-x-0.5 active:translate-y-0.5 active:shadow-none'
              }`}
            >
              <div className="flex items-center gap-1.5 min-w-0">
                <Pipette style={{ color: selectedColor.textColor }} className="w-3.5 h-3.5 stroke-[2.5] shrink-0" />
                <span style={{ color: selectedColor.textColor }} className="font-black text-[11px] tracking-tight truncate">
                  Custom
                </span>
              </div>
              <input
                type="color"
                aria-label="Custom color picker"
                value={selectedColor.hex}
                onChange={(e) => {
                  const hex = e.target.value;
                  setSelectedColor({
                    name: 'Custom',
                    hex,
                    textColor: getAccessibleTextColor(hex)
                  });
                }}
                className="opacity-0 absolute inset-0 w-full h-full cursor-pointer"
              />
              {!SUBJECT_PALETTE.some((p) => p.hex.toLowerCase() === selectedColor.hex.toLowerCase()) && (
                <div
                  style={{ backgroundColor: selectedColor.textColor }}
                  className="w-3.5 h-3.5 rounded-full border border-slate-900 flex items-center justify-center text-white shrink-0 shadow-xs"
                >
                  <Check className="w-2 h-2 stroke-[3]" />
                </div>
              )}
            </label>
          </div>
        </div>

        {/* Live Subject Badge Preview */}
        <div className="rounded-xl border-2 border-slate-900 dark:border-white/40 bg-slate-50 dark:bg-slate-900/60 px-3 py-2 shadow-brutal-sm flex items-center justify-between">
          <span className="text-xs font-bold text-muted-foreground">Category Preview:</span>
          <span
            style={{
              backgroundColor: selectedColor.hex,
              color: selectedColor.textColor
            }}
            className="px-3 py-1 rounded-lg border-2 border-slate-900 text-xs font-black shadow-brutal-sm truncate max-w-[200px]"
          >
            {name.trim() || 'Sample Subject'}
          </span>
        </div>

        <div className="flex items-center justify-end gap-2 pt-2 border-t-2 border-slate-900/10 dark:border-white/10">
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            disabled={loading}
            className="rounded-xl border-2 border-slate-900 bg-white dark:bg-slate-800 px-3.5 py-2 text-xs font-black text-slate-900 dark:text-white shadow-brutal-sm hover:-translate-y-0.5 hover:shadow-brutal active:translate-x-0.5 active:translate-y-0.5 active:shadow-none transition-all cursor-pointer disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={loading || !name.trim()}
            className="rounded-xl border-2 border-slate-900 bg-primary px-4 py-2 text-xs font-black text-white shadow-brutal-sm hover:-translate-y-0.5 hover:shadow-brutal active:translate-x-0.5 active:translate-y-0.5 active:shadow-none transition-all cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
