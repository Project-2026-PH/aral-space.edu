'use client';

import { useState } from 'react';
import type { Quiz, QuizQuestion } from '@quiz-creator/types';
import { ChevronDown, Download, FileJson, FileSpreadsheet, FileText } from 'lucide-react';
import {
  buildQuizCsv,
  buildQuizJson,
  buildQuizPrintDocument,
  downloadQuizText,
  getQuizExportFilename
} from '@/lib/quizExport';

interface QuizExportMenuProps {
  quiz: Quiz;
  questions: QuizQuestion[];
}

type ExportFormat = 'json' | 'csv' | 'pdf';

export default function QuizExportMenu({ quiz, questions }: QuizExportMenuProps) {
  const [open, setOpen] = useState(false);

  function exportQuiz(format: ExportFormat) {
    setOpen(false);

    if (format === 'json') {
      downloadQuizText(
        buildQuizJson(quiz, questions),
        getQuizExportFilename(quiz.title, 'json'),
        'application/json'
      );
      return;
    }

    if (format === 'csv') {
      downloadQuizText(
        buildQuizCsv(quiz, questions),
        getQuizExportFilename(quiz.title, 'csv'),
        'text/csv'
      );
      return;
    }

    const printWindow = window.open('', '_blank', 'width=900,height=700');
    if (!printWindow) {
      window.alert('Please allow pop-ups to export the quiz as a PDF.');
      return;
    }

    printWindow.document.open();
    printWindow.document.write(buildQuizPrintDocument(quiz, questions));
    printWindow.document.close();
    printWindow.focus();
    printWindow.onafterprint = () => printWindow.close();
    window.setTimeout(() => printWindow.print(), 250);
  }

  return (
    <div className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="flex items-center gap-1.5 rounded-2xl border border-border bg-card px-3 sm:px-4 py-2.5 text-xs font-bold text-foreground hover:bg-muted transition-all active:scale-95 shadow-2xs"
        title="Export Quiz"
      >
        <Download className="h-3.5 w-3.5 shrink-0" />
        <span className="hidden sm:inline">Export</span>
        <ChevronDown className={`h-3.5 w-3.5 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div
          role="menu"
          aria-label="Export quiz"
          className="absolute left-0 sm:left-auto sm:right-0 top-full z-30 mt-2 min-w-44 rounded-2xl border border-border bg-card p-1.5 shadow-xl"
        >
          <button
            type="button"
            role="menuitem"
            onClick={() => exportQuiz('json')}
            className="flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left text-xs font-semibold text-foreground hover:bg-muted transition-colors"
          >
            <FileJson className="h-4 w-4 text-primary" />
            <span>Export JSON</span>
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={() => exportQuiz('csv')}
            className="flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left text-xs font-semibold text-foreground hover:bg-muted transition-colors"
          >
            <FileSpreadsheet className="h-4 w-4 text-emerald-600" />
            <span>Export CSV</span>
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={() => exportQuiz('pdf')}
            className="flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left text-xs font-semibold text-foreground hover:bg-muted transition-colors"
          >
            <FileText className="h-4 w-4 text-rose-500" />
            <span>Export PDF</span>
          </button>
        </div>
      )}
    </div>
  );
}
