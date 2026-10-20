'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Check, ChevronDown, Search, X } from 'lucide-react';

export type SearchableSelectOption = {
  value: string;
  label: string;
  description?: string;
};

type SearchableSelectProps = {
  id?: string;
  value: string;
  options: SearchableSelectOption[];
  onChange: (value: string) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyMessage?: string;
  maxVisible?: number;
  disabled?: boolean;
  className?: string;
};

export default function SearchableSelect({
  id,
  value,
  options,
  onChange,
  placeholder = 'Select an option',
  searchPlaceholder = 'Search options...',
  emptyMessage = 'No matching options',
  maxVisible = 5,
  disabled = false,
  className = '',
}: SearchableSelectProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const selected = options.find((option) => option.value === value);

  const filteredOptions = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase();
    const matches = normalizedQuery
      ? options.filter((option) => `${option.label} ${option.description || ''}`.toLocaleLowerCase().includes(normalizedQuery))
      : options;
    return matches.slice(0, Math.max(1, maxVisible));
  }, [maxVisible, options, query]);

  useEffect(() => {
    if (!open) return;
    const handlePointerDown = (event: PointerEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) setOpen(false);
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    searchRef.current?.focus();
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open]);

  const selectOption = (nextValue: string) => {
    onChange(nextValue);
    setQuery('');
    setOpen(false);
  };

  return (
    <div ref={containerRef} className={`relative min-w-0 ${className}`}>
      <button
        id={id}
        type="button"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
        className="flex w-full items-center gap-2 rounded-lg bg-transparent px-1 py-1 text-left text-[11px] font-black text-slate-700 outline-none transition hover:bg-white focus-visible:ring-2 focus-visible:ring-primary/40 disabled:cursor-not-allowed disabled:opacity-50 dark:text-slate-200 dark:hover:bg-white/10"
      >
        <span className="min-w-0 flex-1 truncate">{selected?.label || placeholder}</span>
        <ChevronDown className={`h-3.5 w-3.5 shrink-0 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`} aria-hidden="true" />
      </button>

      {open && (
        <div className="absolute bottom-[calc(100%+0.5rem)] left-0 z-20 w-[min(280px,calc(100vw-3rem))] overflow-hidden rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl ring-1 ring-slate-900/5 dark:border-white/15 dark:bg-card dark:ring-white/5">
          <div className="flex items-center gap-1.5 rounded-lg bg-slate-100 px-2 dark:bg-white/10">
            <Search className="h-3.5 w-3.5 shrink-0 text-slate-400" aria-hidden="true" />
            <input
              ref={searchRef}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={searchPlaceholder}
              aria-label={searchPlaceholder}
              className="min-w-0 flex-1 bg-transparent py-2 text-[11px] font-semibold text-slate-800 outline-none placeholder:text-slate-400 dark:text-white"
            />
            {query && (
              <button type="button" onClick={() => setQuery('')} aria-label="Clear search" className="text-slate-400 hover:text-slate-700 dark:hover:text-white">
                <X className="h-3 w-3" aria-hidden="true" />
              </button>
            )}
          </div>

          <div role="listbox" aria-label={placeholder} className="mt-1 max-h-52 overflow-y-auto">
            {filteredOptions.length > 0 ? filteredOptions.map((option) => (
              <button
                key={option.value}
                type="button"
                role="option"
                aria-selected={option.value === value}
                onClick={() => selectOption(option.value)}
                className="flex w-full items-start gap-2 rounded-lg px-2 py-2 text-left transition hover:bg-primary/10 focus-visible:bg-primary/10 focus-visible:outline-none"
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[11px] font-black text-slate-800 dark:text-white">{option.label}</span>
                  {option.description && <span className="block truncate text-[10px] font-semibold text-slate-400">{option.description}</span>}
                </span>
                {option.value === value && <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" aria-hidden="true" />}
              </button>
            )) : (
              <p className="px-2 py-3 text-center text-[10px] font-bold text-slate-400">{emptyMessage}</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
