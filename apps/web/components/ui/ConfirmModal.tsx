'use client';

import React from 'react';
import Modal from './Modal';
import { AlertCircle } from 'lucide-react';

interface ConfirmModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  destructive?: boolean;
}

export default function ConfirmModal({
  open,
  onOpenChange,
  onConfirm,
  title,
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  destructive = false
}: ConfirmModalProps) {
  return (
    <Modal open={open} onOpenChange={onOpenChange} maxWidth="max-w-md">
      <div className="flex items-start gap-4">
        <div className={`p-3 rounded-2xl shrink-0 ${destructive ? 'bg-destructive/10 text-destructive' : 'bg-primary/10 text-primary'}`}>
          <AlertCircle className="h-6 w-6" />
        </div>
        <div>
          <h4 className="text-base font-bold text-foreground">{title}</h4>
          <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{message}</p>
        </div>
      </div>
      <div className="mt-6 flex justify-end gap-3">
        <button
          type="button"
          onClick={() => onOpenChange(false)}
          className="rounded-xl px-4 py-2 text-xs font-semibold text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
        >
          {cancelText}
        </button>
        <button
          type="button"
          onClick={() => {
            onConfirm();
            onOpenChange(false);
          }}
          className={`rounded-xl px-4 py-2 text-xs font-bold text-white transition-all active:scale-95 ${
            destructive ? 'bg-destructive hover:bg-destructive/90' : 'bg-primary hover:bg-primary/90'
          }`}
        >
          {confirmText}
        </button>
      </div>
    </Modal>
  );
}
