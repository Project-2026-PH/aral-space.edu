'use client';

import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

interface ModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
  description?: string;
  children: React.ReactNode;
  maxWidth?: string;
  className?: string;
  contentClassName?: string;
}

export default function Modal({
  open,
  onOpenChange,
  title,
  description,
  children,
  maxWidth = 'max-w-xl',
  className = '',
  contentClassName = ''
}: ModalProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;

    const prevBodyOverflow = document.body.style.overflow;
    const prevHtmlOverflow = document.documentElement.style.overflow;

    document.body.style.overflow = 'hidden';
    document.documentElement.style.overflow = 'hidden';

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onOpenChange(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = prevBodyOverflow;
      document.documentElement.style.overflow = prevHtmlOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [open, onOpenChange]);

  if (!open || !mounted) return null;

  return createPortal(
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-3 sm:p-4">
      <div
        className="fixed inset-0 bg-background/80 backdrop-blur-md transition-opacity"
        onClick={() => onOpenChange(false)}
      />
      <div className={`relative z-10 w-full ${maxWidth} max-h-[calc(100dvh-2rem)] sm:max-h-[85vh] flex flex-col rounded-2xl sm:rounded-3xl border-3 border-slate-900 dark:border-white/40 bg-white dark:bg-[#0c0f1d] p-4 sm:p-6 shadow-brutal animate-fade-in ${className}`}>
        <div className="flex items-start justify-between pb-3 sm:pb-4 border-b-2 border-slate-900/20 dark:border-white/20 gap-3 shrink-0">
          <div className="min-w-0 pr-1">
            {title && <h3 className="text-base sm:text-lg font-black text-slate-900 dark:text-white truncate sm:whitespace-normal">{title}</h3>}
            {description && <p className="text-xs font-medium text-muted-foreground mt-0.5">{description}</p>}
          </div>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="shrink-0 rounded-xl border-2 border-slate-900 bg-white dark:bg-slate-800 p-1.5 text-slate-900 dark:text-white shadow-brutal-sm hover:-translate-y-0.5 hover:shadow-brutal active:translate-x-0.5 active:translate-y-0.5 active:shadow-none transition-all cursor-pointer"
          >
            <X className="h-4 w-4 stroke-[2.5]" />
          </button>
        </div>
        <div className={`mt-3.5 sm:mt-4 flex-1 min-h-0 overflow-y-auto overscroll-contain custom-scrollbar pr-1 ${contentClassName}`}>{children}</div>
      </div>
    </div>,
    document.body
  );
}
