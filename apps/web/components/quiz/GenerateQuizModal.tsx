'use client';

import React, { useState, useEffect } from 'react';
import Modal from '../ui/Modal';
import { Loader2, Sparkles, AlertCircle, FileText, CheckCircle2, Plus, Tag } from 'lucide-react';
import { useRouter } from 'next/navigation';
import NewSubjectModal from '../subject/NewSubjectModal';

interface GenerateQuizModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  subjects?: Array<{ id: string; name: string; color?: string }>;
  onGenerated?: (quizId: string) => void;
}

export default function GenerateQuizModal({
  open,
  onOpenChange,
  subjects = [],
  onGenerated
}: GenerateQuizModalProps) {
  const router = useRouter();
  const [title, setTitle] = useState('');
  const [subjectList, setSubjectList] = useState<Array<{ id: string; name: string; color?: string }>>(subjects);
  const [selectedSubject, setSelectedSubject] = useState(subjects[0]?.id || '');
  const [showSubjectModal, setShowSubjectModal] = useState(false);

  useEffect(() => {
    setSubjectList(subjects);
    if (!selectedSubject && subjects.length > 0) {
      setSelectedSubject(subjects[0].id);
    }
  }, [subjects]);
  const [text, setText] = useState('');
  const [generating, setGenerating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [progressMessage, setProgressMessage] = useState('');
  const [progressDetail, setProgressDetail] = useState('');
  const [tokensCount, setTokensCount] = useState(0);
  const [error, setError] = useState<string | null>(null);

  async function handleGenerate() {
    if (!text.trim() && !title.trim()) {
      setError('Please provide a title or paste course material/notes.');
      return;
    }

    setGenerating(true);
    setProgress(5);
    setProgressMessage('Connecting to AI Generator...');
    setProgressDetail('Initializing prompt stream...');
    setError(null);

    try {
      const response = await fetch('/api/generate-quiz', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim() || 'AI Generated Quiz',
          subjectId: selectedSubject || null,
          text: text.trim()
        }),
      });

      if (!response.body) throw new Error('ReadableStream not supported');

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let done = false;
      let finalQuizId: string | null = null;

      while (!done) {
        const { value, done: doneReading } = await reader.read();
        done = doneReading;
        if (value) {
          const chunk = decoder.decode(value, { stream: true });
          const lines = chunk.split('\n');
          for (const line of lines) {
            if (line.startsWith('data: ')) {
              try {
                const data = JSON.parse(line.slice(6));
                if (data.progress !== undefined) setProgress(data.progress);
                if (data.message) setProgressMessage(data.message);
                if (data.detail) setProgressDetail(data.detail);
                if (data.tokensCount) setTokensCount(data.tokensCount);
                if (data.quizId) finalQuizId = data.quizId;
                if (data.message === 'Error') {
                  throw new Error(data.detail || 'Generation failed');
                }
              } catch (e: any) {
                if (e.message !== 'Unexpected end of JSON input') {
                  console.warn('SSE Parse error', e);
                }
              }
            }
          }
        }
      }

      if (finalQuizId) {
        onOpenChange(false);
        if (onGenerated) onGenerated(finalQuizId);
        else router.push(`/quizzes/${finalQuizId}`);
      }
    } catch (err: any) {
      setError(err.message || 'Quiz generation failed.');
    } finally {
      setGenerating(false);
    }
  }

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title="AI Quiz Generation Studio"
      description="Paste lecture notes, study guides, or topic summaries to auto-generate questions."
    >
      <div className="space-y-4">
        {error && (
          <div className="flex items-center gap-2 rounded-2xl border border-destructive/30 bg-destructive/10 p-3 text-xs font-semibold text-destructive">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1.5">
            Quiz Title
          </label>
          <input
            type="text"
            placeholder="e.g. Chapter 4: Photosynthesis & Cellular Respiration"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            disabled={generating}
            className="w-full rounded-2xl border border-border bg-background px-4 py-2.5 text-xs text-foreground focus:border-primary focus:outline-none"
          />
        </div>

        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Subject Category
            </label>
            <button
              type="button"
              onClick={() => setShowSubjectModal(true)}
              className="text-[11px] font-bold text-primary hover:underline flex items-center gap-1 transition-all"
            >
              <Plus className="h-3 w-3" />
              <span>New Subject</span>
            </button>
          </div>
          <select
            value={selectedSubject}
            onChange={(e) => setSelectedSubject(e.target.value)}
            disabled={generating}
            className="w-full rounded-2xl border border-border bg-background px-4 py-2.5 text-xs text-foreground focus:border-primary focus:outline-none"
          >
            <option value="">General (No subject)</option>
            {subjectList.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>

        <NewSubjectModal
          open={showSubjectModal}
          onOpenChange={setShowSubjectModal}
          onCreated={(created) => {
            setSubjectList((prev) => [...prev, created]);
            setSelectedSubject(created.id);
          }}
        />

        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1.5">
            Study Material / Notes (Paste Text)
          </label>
          <textarea
            rows={6}
            placeholder="Paste textbook excerpt, lecture transcripts, or bullet points here..."
            value={text}
            onChange={(e) => setText(e.target.value)}
            disabled={generating}
            className="w-full rounded-2xl border border-border bg-background p-3 text-xs text-foreground focus:border-primary focus:outline-none resize-none leading-relaxed font-mono"
          />
        </div>

        {generating && (
          <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4 space-y-3">
            <div className="flex items-center justify-between text-xs font-bold">
              <span className="flex items-center gap-2 text-primary">
                <Loader2 className="h-4 w-4 animate-spin" />
                {progressMessage || 'Generating questions...'}
              </span>
              <span className="text-muted-foreground">{progress}%</span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
              <div
                className="h-full bg-primary transition-all duration-300 ease-out"
                style={{ width: `${progress}%` }}
              />
            </div>
            <div className="flex items-center justify-between text-[11px] text-muted-foreground">
              <span>{progressDetail}</span>
              {tokensCount > 0 && <span>{tokensCount} tokens</span>}
            </div>
          </div>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            disabled={generating}
            className="rounded-xl px-4 py-2 text-xs font-semibold text-muted-foreground hover:bg-muted transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleGenerate}
            disabled={generating}
            className="flex items-center gap-2 rounded-xl bg-primary px-5 py-2 text-xs font-bold text-white hover:bg-primary/90 transition-all active:scale-95 disabled:opacity-50 shadow-md shadow-primary/20"
          >
            {generating ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Generating...</span>
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4" />
                <span>Generate Questions</span>
              </>
            )}
          </button>
        </div>
      </div>
    </Modal>
  );
}
