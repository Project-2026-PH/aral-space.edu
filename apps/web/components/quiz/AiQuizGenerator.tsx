'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  Loader2,
  Sparkles,
  AlertCircle,
  Plus,
  Brain,
  ArrowRight,
  FolderUp,
  FileText,
  UploadCloud,
  X,
  Trash2,
  CheckCircle2,
  FileUp,
  Layers,
  FileCode
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { AiPipelineMode, HandoutPage, IngestedFileInfo } from '@quiz-creator/types';
import { loadLocalAuthoringSignals } from '@/lib/authoringPreferences';
import NewSubjectModal from '../subject/NewSubjectModal';

export interface IngestedFlashcardPair {
  term: string;
  definition: string;
  source_pages: number[];
}

export interface IngestedFileState {
  id: string;
  name: string;
  size: number;
  pageCount: number;
  documentId?: string;
  contentHash?: string;
  generationJobId?: string;
  generationIdempotencyKey?: string;
  pages: HandoutPage[];
  pairs?: IngestedFlashcardPair[];
  model?: string;
  status: 'parsing' | 'ready' | 'error';
  error?: string;
}

export interface AiQuizGeneratorProps {
  subjects?: Array<{ id: string; name: string; color?: string }>;
  onGenerated?: (quizId: string) => void;
  onCancel?: () => void;
  isModal?: boolean;
}

interface AiQuizDraft {
  version: 1;
  updatedAt: string;
  title: string;
  selectedSubject: string;
  inputMode: 'upload' | 'text';
  outputMode: 'multiple_choice' | 'flashcard';
  text: string;
  files: IngestedFileState[];
}

export const EMPTY_SUBJECTS: Array<{ id: string; name: string; color?: string }> = [];
const AI_DRAFT_STORAGE_KEY = 'quiz-creator:ai-draft:v1';
const AI_DRAFT_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

function createGenerationIdempotencyKey(documentId: string, contentHash?: string): string {
  return globalThis.crypto?.randomUUID?.() || `${documentId}-${contentHash || Date.now()}`;
}

function parseAiQuizDraft(raw: string | null): AiQuizDraft | null {
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as Partial<AiQuizDraft>;
    const updatedAt = Date.parse(parsed.updatedAt || '');
    if (
      parsed.version !== 1 ||
      !Number.isFinite(updatedAt) ||
      Date.now() - updatedAt > AI_DRAFT_MAX_AGE_MS ||
      typeof parsed.title !== 'string' ||
      typeof parsed.selectedSubject !== 'string' ||
      (parsed.inputMode !== 'upload' && parsed.inputMode !== 'text') ||
      (parsed.outputMode !== undefined && parsed.outputMode !== 'multiple_choice' && parsed.outputMode !== 'flashcard') ||
      typeof parsed.text !== 'string' ||
      !Array.isArray(parsed.files)
    ) {
      return null;
    }

    return {
      version: 1,
      updatedAt: parsed.updatedAt as string,
      title: parsed.title,
      selectedSubject: parsed.selectedSubject,
      inputMode: parsed.inputMode,
      outputMode: parsed.outputMode === 'flashcard' ? 'flashcard' : 'multiple_choice',
      text: parsed.text,
      files: parsed.files as IngestedFileState[]
    };
  } catch {
    return null;
  }
}

export default function AiQuizGenerator({
  subjects = EMPTY_SUBJECTS,
  onGenerated,
  onCancel,
  isModal = false
}: AiQuizGeneratorProps) {
  const router = useRouter();
  const [title, setTitle] = useState('');
  const [subjectList, setSubjectList] = useState<Array<{ id: string; name: string; color?: string }>>(subjects);
  const [selectedSubject, setSelectedSubject] = useState(subjects[0]?.id || '');
  const [showSubjectModal, setShowSubjectModal] = useState(false);
  const [outputMode, setOutputMode] = useState<'multiple_choice' | 'flashcard'>('multiple_choice');
  const pipelineMode: AiPipelineMode = 'auto';

  // Input source mode: 'upload' (folder/multi-file) or 'text' (raw notes)
  const [inputMode, setInputMode] = useState<'upload' | 'text'>('upload');
  const [text, setText] = useState('');
  const [files, setFiles] = useState<IngestedFileState[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessingFiles, setIsProcessingFiles] = useState(false);

  // Streaming generation state
  const [generating, setGenerating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [progressMessage, setProgressMessage] = useState('');
  const [progressDetail, setProgressDetail] = useState('');
  const [tokensCount, setTokensCount] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [draftRecovery, setDraftRecovery] = useState<AiQuizDraft | null>(null);
  const [draftHydrated, setDraftHydrated] = useState(false);
  const [draftStatus, setDraftStatus] = useState<'idle' | 'saved' | 'error'>('idle');

  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);
  const subjectsRef = useRef(subjects);

  useEffect(() => {
    if (subjects && subjects.length > 0) {
      const prevIds = subjectsRef.current?.map((s) => s.id).join(',');
      const nextIds = subjects.map((s) => s.id).join(',');
      if (prevIds !== nextIds) {
        subjectsRef.current = subjects;
        setSubjectList(subjects);
        setSelectedSubject((prev) => prev || subjects[0]?.id || '');
      }
      return;
    }

    let isMounted = true;
    async function loadSubjects() {
      try {
        const res = await fetch('/api/subjects');
        if (res.ok) {
          const data = await res.json();
          if (isMounted && Array.isArray(data.subjects) && data.subjects.length > 0) {
            setSubjectList(data.subjects);
            setSelectedSubject((prev) => prev || data.subjects[0]?.id || '');
          }
        }
      } catch (err) {
        console.error('Failed to load subjects:', err);
      }
    }
    loadSubjects();

    return () => {
      isMounted = false;
    };
  }, [subjects]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      setDraftHydrated(true);
      return;
    }

    const draft = parseAiQuizDraft(window.localStorage.getItem(AI_DRAFT_STORAGE_KEY));
    if (draft) {
      setDraftRecovery(draft);
    } else {
      window.localStorage.removeItem(AI_DRAFT_STORAGE_KEY);
      setDraftHydrated(true);
    }
  }, []);

  useEffect(() => {
    if (!draftHydrated || typeof window === 'undefined') return;

    const hasContent = Boolean(title.trim() || text.trim() || files.length > 0);
    if (!hasContent) return;

    const timeout = window.setTimeout(() => {
      try {
        const draft: AiQuizDraft = {
          version: 1,
          updatedAt: new Date().toISOString(),
          title,
          selectedSubject,
          inputMode,
          outputMode,
          text,
          files
        };
        window.localStorage.setItem(AI_DRAFT_STORAGE_KEY, JSON.stringify(draft));
        setDraftStatus('saved');
      } catch {
        setDraftStatus('error');
      }
    }, 500);

    return () => window.clearTimeout(timeout);
  }, [draftHydrated, title, selectedSubject, inputMode, outputMode, text, files]);

  function restoreDraft() {
    if (!draftRecovery) return;
    setTitle(draftRecovery.title);
    setSelectedSubject(draftRecovery.selectedSubject);
    setInputMode(draftRecovery.inputMode);
    setOutputMode(draftRecovery.outputMode || 'multiple_choice');
    setText(draftRecovery.text);
    setFiles(draftRecovery.files);
    setDraftRecovery(null);
    setDraftHydrated(true);
    setDraftStatus('saved');
  }

  function discardDraft() {
    if (typeof window !== 'undefined') {
      window.localStorage.removeItem(AI_DRAFT_STORAGE_KEY);
    }
    setDraftRecovery(null);
    setDraftHydrated(true);
    setDraftStatus('idle');
  }

  const totalPagesCount = files.reduce((acc, f) => acc + (f.status === 'ready' ? f.pageCount : 0), 0);
  const totalFlashcardCount = files.reduce((acc, f) => acc + (f.pairs?.length || 0), 0);
  const hasResumableReviewerJob = files.some((file) => Boolean(file.generationJobId));

  // Format file size for clean UI presentation
  function formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  }

  // Parse a single File into an IngestedFileState
  async function processSingleFile(file: File): Promise<IngestedFileState> {
    const fileId = `${file.name}-${file.size}-${Math.random().toString(36).slice(2, 7)}`;
    try {
      const isPdf = file.name.toLowerCase().endsWith('.pdf') || file.type === 'application/pdf';
      if (isPdf) {
        const MAX_BYTES = 25 * 1024 * 1024;
        if (file.size > MAX_BYTES) {
          throw new Error(
            `"${file.name}" (${(file.size / (1024 * 1024)).toFixed(1)}MB) exceeds the 25 MB PDF limit. Please upload a smaller PDF.`
          );
        }

        const formData = new FormData();
        formData.append('file', file);
        const res = await fetch('/api/source-documents', {
          method: 'POST',
          body: formData,
        });
        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.error || `Server returned ${res.status}`);
        }
        const data = await res.json();

        return {
          id: fileId,
          name: file.name,
          size: file.size,
          pageCount: typeof data.pageCount === 'number' ? data.pageCount : 0,
          documentId: typeof data.documentId === 'string' ? data.documentId : undefined,
          contentHash: typeof data.contentHash === 'string' ? data.contentHash : undefined,
          generationIdempotencyKey: typeof data.documentId === 'string'
            ? createGenerationIdempotencyKey(data.documentId, data.contentHash)
            : undefined,
          pages: [],
          status: 'ready'
        };
      } else {
        if (outputMode === 'flashcard') {
          throw new Error('Flashcard / Identification mode currently supports PDF uploads only.');
        }

        // Plain text / Markdown notes
        const textContent = await file.text();
        const lines = textContent.split('\n');
        const pages: HandoutPage[] = [];
        let curBuf: string[] = [];
        let curPage = 1;

        const flush = () => {
          if (curBuf.length > 0) {
            pages.push({
              pageNumber: curPage++,
              text: curBuf.join('\n'),
              chapterTitle: file.name
            });
            curBuf = [];
          }
        };

        for (const line of lines) {
          if (curBuf.length >= 50) {
            flush();
          }
          curBuf.push(line);
        }
        flush();

        const finalPages = pages.length > 0 ? pages : [{ pageNumber: 1, text: textContent, chapterTitle: file.name }];

        return {
          id: fileId,
          name: file.name,
          size: file.size,
          pageCount: finalPages.length,
          pages: finalPages,
          status: 'ready'
        };
      }
    } catch (err: any) {
      return {
        id: fileId,
        name: file.name,
        size: file.size,
        pageCount: 1,
        pages: [{ pageNumber: 1, text: `[Error parsing ${file.name}]`, chapterTitle: file.name }],
        status: 'error',
        error: err.message || 'Parsing failed'
      };
    }
  }

  // Handle incoming list of files (from file picker or drop)
  async function ingestFiles(newFiles: File[]) {
    if (newFiles.length === 0) return;
    setError(null);
    setIsProcessingFiles(true);

    // Filter to PDF, text, markdown
    const supported = newFiles.filter((f) =>
      f.name.endsWith('.pdf') ||
      f.type === 'application/pdf' ||
      f.name.endsWith('.txt') ||
      f.name.endsWith('.md')
    );

    if (supported.length === 0) {
      setError('Please select PDF handouts or text (.txt, .md) files.');
      setIsProcessingFiles(false);
      return;
    }

    if (supported.some((file) => file.name.toLowerCase().endsWith('.pdf') || file.type === 'application/pdf') && supported.length > 1) {
      setError('Select one PDF at a time. Each PDF is stored independently and can be generated or retried later.');
      setIsProcessingFiles(false);
      return;
    }

    try {
      const parsedItems = await Promise.all(supported.map((f) => processSingleFile(f)));
      setFiles((prev) => {
        // Avoid duplicate files with identical name and size
        const existingKeys = new Set(prev.map((item) => `${item.name}-${item.size}`));
        const filteredNew = parsedItems.filter((item) => !existingKeys.has(`${item.name}-${item.size}`));
        return [...prev, ...filteredNew];
      });

      // Auto-suggest quiz title if currently blank
      if (!title.trim()) {
        if (supported.length === 1) {
          setTitle(supported[0].name.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' '));
        } else {
          setTitle(`${supported.length} Chapters Comprehensive Review`);
        }
      }
    } finally {
      setIsProcessingFiles(false);
    }
  }

  // Recursive directory reader for folder drag-and-drop
  async function getFilesFromDataTransfer(dataTransfer: DataTransfer): Promise<File[]> {
    const fileList: File[] = [];
    const items = dataTransfer.items;

    if (!items || items.length === 0) {
      return Array.from(dataTransfer.files || []);
    }

    async function traverseEntry(entry: any) {
      if (!entry) return;
      if (entry.isFile) {
        const file = await new Promise<File>((resolve, reject) => entry.file(resolve, reject));
        if (
          file.name.endsWith('.pdf') ||
          file.type === 'application/pdf' ||
          file.name.endsWith('.txt') ||
          file.name.endsWith('.md')
        ) {
          fileList.push(file);
        }
      } else if (entry.isDirectory) {
        const dirReader = entry.createReader();
        const entries = await new Promise<any[]>((resolve, reject) => {
          dirReader.readEntries(resolve, reject);
        });
        for (const child of entries) {
          await traverseEntry(child);
        }
      }
    }

    const traversePromises: Promise<void>[] = [];
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const entry = item.webkitGetAsEntry ? item.webkitGetAsEntry() : null;
      if (entry) {
        traversePromises.push(traverseEntry(entry));
      } else {
        const file = item.getAsFile();
        if (file) fileList.push(file);
      }
    }

    await Promise.all(traversePromises);
    return fileList;
  }

  async function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setIsDragging(false);
    if (generating) return;

    try {
      const droppedFiles = await getFilesFromDataTransfer(e.dataTransfer);
      await ingestFiles(droppedFiles);
    } catch (err: any) {
      setError('Failed to process dropped items: ' + err.message);
    }
  }

  function handleFileSelectionChange(e: React.ChangeEvent<HTMLInputElement>) {
    if (e.target.files && e.target.files.length > 0) {
      ingestFiles(Array.from(e.target.files));
      e.target.value = '';
    }
  }

  function removeFile(id: string) {
    setFiles((prev) => prev.filter((f) => f.id !== id));
  }

  function clearAllFiles() {
    setFiles([]);
  }

  function handleOutputModeChange(nextMode: 'multiple_choice' | 'flashcard') {
    if (nextMode !== outputMode && files.length > 0) {
      setFiles([]);
      setError('The uploaded files were cleared because the extraction mode changed. Please upload them again.');
    }
    if (nextMode === 'flashcard') setInputMode('upload');
    setOutputMode(nextMode);
  }

  async function handleGenerate() {
    // Check if input is provided in current mode
    const hasFiles = inputMode === 'upload' && files.length > 0;
    const hasText = inputMode === 'text' && text.trim().length > 0;

    if (inputMode === 'upload' && files.some((file) => file.status !== 'ready')) {
      setError('One or more files could not be read. Please remove them and upload a text-based PDF or run OCR before trying again.');
      return;
    }

    if (!hasFiles && !hasText && !title.trim()) {
      setError(
        inputMode === 'upload'
          ? 'Please drop or select at least one chapter PDF / folder.'
          : 'Please paste your study material/notes or enter a title.'
      );
      return;
    }

    setGenerating(true);
    setProgress(5);
    setProgressMessage('Preparing generation job...');
    setProgressDetail(
      outputMode === 'flashcard'
        ? 'The stored PDF will produce source-grounded short-answer cards after you start generation.'
        : 'The stored PDF will be parsed and source-grounded reviewer items will be generated on the server.'
    );
    setError(null);

    try {
      const generatedTitle = title.trim() || (
        hasFiles
          ? (files.length > 1 ? `${files.length} Chapters Comprehensive Review` : files[0].name.replace(/\.[^/.]+$/, ''))
          : 'AI Generated Exam Reviewer'
      );

      const uploadedDocuments = files.filter((file) => file.documentId);
      if (uploadedDocuments.length > 0) {
        if (uploadedDocuments.length !== 1) {
          throw new Error('Generate one PDF at a time. Each uploaded PDF is stored independently so it can be parsed and retried on demand.');
        }

        const sourceDocument = uploadedDocuments[0];
        const questionTypes = outputMode === 'flashcard' ? ['short_answer'] : ['multiple_choice'];
        const generationIdempotencyKey = sourceDocument.generationIdempotencyKey
          || createGenerationIdempotencyKey(sourceDocument.documentId!, sourceDocument.contentHash);
        let jobId = sourceDocument.generationJobId;

        setProgress(8);
        setProgressMessage(jobId ? 'Resuming generation job...' : 'Creating generation job...');
        setProgressDetail(jobId
          ? 'The stored PDF already has a durable generation job. Checking its current status.'
          : 'The PDF is stored. Server-side parsing begins now, only because you clicked Generate with AI.');

        if (!jobId) {
          const response = await fetch(`/api/source-documents/${encodeURIComponent(sourceDocument.documentId!)}/reviewer-sets/generate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              title: generatedTitle,
              subjectId: selectedSubject || undefined,
              questionTypes,
              difficulty: 'mixed',
              questionCount: 30,
              idempotencyKey: generationIdempotencyKey
            })
          });
          const data = await response.json().catch(() => ({}));
          if (!response.ok) throw new Error(data.error || `Server returned ${response.status}`);
          if (!data.jobId) throw new Error('The generation job was created without an id.');
          jobId = data.jobId;
          setFiles((previous) => previous.map((file) => file.id === sourceDocument.id
            ? { ...file, generationJobId: jobId, generationIdempotencyKey }
            : file));
        }

        if (!jobId) throw new Error('The generation job was not available for polling.');
        const activeJobId = jobId;

        for (let attempt = 0; attempt < 180; attempt++) {
          const statusResponse = await fetch(`/api/reviewer-generation/jobs/${encodeURIComponent(activeJobId)}`, {
            cache: 'no-store'
          });
          const status = await statusResponse.json().catch(() => ({}));
          if (!statusResponse.ok) throw new Error(status.error || `Status request returned ${statusResponse.status}`);
          if (typeof status.progressPercent === 'number') setProgress(status.progressPercent);
          if (status.message) setProgressMessage(status.message);
          if (status.stage) setProgressDetail(`Stage: ${status.stage}`);

          if (status.status === 'published' && status.quizId) {
            setProgress(100);
            setProgressMessage('Reviewer ready');
            if (typeof window !== 'undefined') window.localStorage.removeItem(AI_DRAFT_STORAGE_KEY);
            if (onGenerated) onGenerated(status.quizId);
            else router.push(`/quizzes/${encodeURIComponent(status.quizId)}`);
            return;
          }
          if (status.status === 'failed') {
            setFiles((previous) => previous.map((file) => file.id === sourceDocument.id
              ? {
                ...file,
                generationJobId: undefined,
                generationIdempotencyKey: createGenerationIdempotencyKey(sourceDocument.documentId!, sourceDocument.contentHash)
              }
              : file));
            throw new Error(status.errorMessage || 'Reviewer generation failed. Click Generate with AI to retry.');
          }
          await new Promise((resolve) => window.setTimeout(resolve, attempt < 5 ? 1000 : 2500));
        }
        throw new Error('Reviewer generation is taking longer than expected. The job is saved locally; click Generate with AI again to resume it.');
      }

      if (outputMode === 'flashcard') {
        throw new Error('Identification generation requires a stored PDF. Select a PDF and try again.');
      }

      let aggregatedPages: HandoutPage[] = [];
      let filesSummary: IngestedFileInfo[] | undefined;

      if (hasFiles) {
        let cumulativePageNumber = 1;
        for (const file of files) {
          for (const p of file.pages) {
            aggregatedPages.push({
              pageNumber: cumulativePageNumber++,
              text: p.text,
              chapterTitle: p.chapterTitle || file.name
            });
          }
        }
        const totalExtractedChars = aggregatedPages.reduce((sum, p) => sum + (p.text?.trim().length || 0), 0);
        if (totalExtractedChars === 0) {
          setError('The uploaded PDF appears to be a scanned image or contains no selectable text. Please upload a searchable PDF or paste notes directly.');
          setGenerating(false);
          return;
        }
        filesSummary = files.map((f) => ({
          fileName: f.name,
          pageCount: f.pageCount,
          fileSize: f.size
        }));
      }

      console.log(`[Frontend] Submitting generate-quiz request:`, {
        pipelineMode,
        title: generatedTitle,
        totalPages: aggregatedPages.length,
        filesSummary
      });

      const response = await fetch('/api/generate-quiz', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: generatedTitle,
          subjectId: selectedSubject || null,
          text: hasText ? text.trim() : undefined,
          pdfPages: aggregatedPages.length > 0 ? aggregatedPages : undefined,
          filesSummary,
          pipelineMode,
          authoringSignals: loadLocalAuthoringSignals({ subjectId: selectedSubject || null })
        }),
      });

      if (!response.body) throw new Error('ReadableStream not supported');

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let done = false;
      let finalQuizId: string | null = null;
      let finalQuizSlug: string | null = null;

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
                if (data.quizSlug) finalQuizSlug = data.quizSlug;
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
        if (typeof window !== 'undefined') {
          window.localStorage.removeItem(AI_DRAFT_STORAGE_KEY);
        }
        if (onGenerated) {
          onGenerated(finalQuizId);
        } else {
          router.push(`/quizzes/${encodeURIComponent(finalQuizSlug || finalQuizId)}`);
        }
      }
    } catch (err: any) {
      setError(err.message || 'Quiz generation failed.');
    } finally {
      setGenerating(false);
    }
  }

  return (
    <div className="space-y-5">
      {draftRecovery && (
        <div className="flex flex-col gap-3 rounded-2xl border border-primary/30 bg-primary/5 p-4 text-xs sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="font-bold text-foreground">Unsaved AI draft found</p>
            <p className="mt-0.5 text-muted-foreground">
              Restore your title, notes, and parsed source files to continue generating.
            </p>
          </div>
          <div className="flex shrink-0 gap-2">
            <button
              type="button"
              onClick={discardDraft}
              className="rounded-xl px-3 py-1.5 font-semibold text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              Discard
            </button>
            <button
              type="button"
              onClick={restoreDraft}
              className="rounded-xl bg-primary px-3 py-1.5 font-bold text-white transition-colors hover:bg-primary/90"
            >
              Restore draft
            </button>
          </div>
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2 rounded-2xl border border-destructive/30 bg-destructive/10 p-3.5 text-xs font-semibold text-destructive animate-in fade-in duration-200">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Adaptive Exam Engine Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3.5 rounded-2xl border border-primary/20 bg-primary/5 shadow-2xs">
        <div className="flex items-center gap-2.5 text-xs font-bold text-primary">
          <div className="p-1.5 rounded-xl bg-primary/10">
            <Brain className="h-4 w-4" />
          </div>
          <div>
            <div>Reviewer Generator</div>
            <div className="text-[11px] font-normal text-muted-foreground">
              {outputMode === 'flashcard'
                ? 'Verbatim term/definition extraction with deterministic identification cards'
                : 'Auto-routes material size, cross-chapter distribution & distractor rigor'}
            </div>
          </div>
        </div>
      </div>

      {/* Output Format */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground">
            Reviewer Format
          </label>
          <div className="inline-flex p-0.5 rounded-xl border border-border bg-muted/50 text-[11px]">
            <button
              type="button"
              onClick={() => handleOutputModeChange('multiple_choice')}
              disabled={generating || hasResumableReviewerJob}
              className={`px-3 py-1 rounded-lg font-bold transition-all cursor-pointer ${outputMode === 'multiple_choice'
                ? 'bg-card text-foreground shadow-xs'
                : 'text-muted-foreground hover:text-foreground'
                }`}
            >
              Multiple Choice
            </button>
            <button
              type="button"
              onClick={() => handleOutputModeChange('flashcard')}
              disabled={generating || hasResumableReviewerJob}
              className={`px-3 py-1 rounded-lg font-bold transition-all cursor-pointer ${outputMode === 'flashcard'
                ? 'bg-card text-foreground shadow-xs'
                : 'text-muted-foreground hover:text-foreground'
                }`}
            >
              Flashcard / Identification
            </button>
          </div>
        </div>
        <p className="text-[11px] text-muted-foreground">
          {outputMode === 'flashcard'
            ? 'PDF definitions are copied verbatim into identification cards. No paraphrasing or multiple-choice generation.'
            : 'Gemini generates multiple-choice questions with distractors from your source material.'}
        </p>
      </div>

      {/* Quiz Title */}
      <div>
        <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1.5">
          Reviewer Title
        </label>
        <input
          type="text"
          placeholder="e.g. Midterm Review: Cell Biology & Genetics (Auto-filled on upload)"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          disabled={generating || hasResumableReviewerJob}
          className="w-full rounded-2xl border border-border bg-background px-4 py-2.5 text-xs text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary shadow-2xs"
        />
      </div>

      {/* Subject Category */}
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
          disabled={generating || hasResumableReviewerJob}
          className="w-full rounded-2xl border border-border bg-background px-4 py-2.5 text-xs text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary shadow-2xs"
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


      {/* Input Source Segmented Control */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground">
            Study Material Source
          </label>
          <div className="inline-flex p-0.5 rounded-xl border border-border bg-muted/50 text-[11px]">
            <button
              type="button"
              onClick={() => setInputMode('upload')}
              disabled={generating}
              className={`px-3 py-1 rounded-lg font-bold transition-all cursor-pointer flex items-center gap-1.5 ${inputMode === 'upload'
                ? 'bg-card text-foreground shadow-xs'
                : 'text-muted-foreground hover:text-foreground'
                }`}
            >
              <FolderUp className="h-3 w-3" />
              <span>Multi-File / Folder</span>
            </button>
            <button
              type="button"
              onClick={() => setInputMode('text')}
              disabled={generating}
              className={`px-3 py-1 rounded-lg font-bold transition-all cursor-pointer flex items-center gap-1.5 ${inputMode === 'text'
                ? 'bg-card text-foreground shadow-xs'
                : 'text-muted-foreground hover:text-foreground'
                }`}
            >
              <FileCode className="h-3 w-3" />
              <span>Paste Notes</span>
            </button>
          </div>
        </div>

        {inputMode === 'upload' ? (
          <div className="space-y-3">
            {/* Hidden native file and directory inputs */}
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,application/pdf,.txt,.md"
              multiple
              className="hidden"
              onChange={handleFileSelectionChange}
            />
            <input
              ref={folderInputRef}
              type="file"
              {...({ webkitdirectory: '', directory: '' } as any)}
              multiple
              className="hidden"
              onChange={handleFileSelectionChange}
            />

            {/* Drag & Drop Zone */}
            <div
              onDragOver={(e) => {
                e.preventDefault();
                if (!generating) setIsDragging(true);
              }}
              onDragLeave={(e) => {
                e.preventDefault();
                setIsDragging(false);
              }}
              onDrop={handleDrop}
              className={`relative rounded-3xl border-2 border-dashed p-6 text-center transition-all duration-200 ${isDragging
                ? 'border-primary bg-primary/10 scale-[1.005] shadow-md shadow-primary/10'
                : 'border-border/90 bg-muted/20 hover:border-primary/50 hover:bg-muted/40'
                } ${generating ? 'opacity-60 pointer-events-none' : ''}`}
            >
              <div className="flex flex-col items-center justify-center space-y-3">
                <div
                  className={`p-3 rounded-2xl transition-colors ${isDragging ? 'bg-primary text-white scale-110' : 'bg-primary/10 text-primary'
                    }`}
                >
                  <UploadCloud className="h-6 w-6" />
                </div>

                <div className="space-y-1">
                  <h3 className="text-xs font-bold text-foreground">
                    Drag & drop chapter PDFs or an entire folder here
                  </h3>
                  <p className="text-[11px] text-muted-foreground max-w-sm mx-auto leading-relaxed">
                    {outputMode === 'flashcard'
                      ? 'Upload one PDF up to 25 MB. It is stored securely now; server-side extraction starts only when you generate.'
                      : 'Upload one PDF up to 25 MB. The original file is stored now and parsing, OCR, and AI generation wait until Generate with AI.'}
                  </p>
                </div>

                <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => folderInputRef.current?.click()}
                    disabled={generating || isProcessingFiles}
                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl border border-primary/30 bg-primary/5 text-primary text-xs font-bold hover:bg-primary/15 transition-colors cursor-pointer"
                  >
                    <FolderUp className="h-3.5 w-3.5" />
                    <span>Select Folder</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={generating || isProcessingFiles}
                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl border border-border bg-card text-foreground text-xs font-bold hover:bg-muted transition-colors cursor-pointer shadow-2xs"
                  >
                    <FileUp className="h-3.5 w-3.5" />
                    <span>Browse PDFs</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Ingestion Loading Indicator */}
            {isProcessingFiles && (
              <div className="flex items-center gap-2.5 p-3 rounded-2xl border border-primary/20 bg-primary/5 text-xs text-primary font-semibold animate-pulse">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Uploading PDF securely. Parsing starts only after you click Generate with AI...</span>
              </div>
            )}

            {/* Ingested Files List */}
            {files.length > 0 && (
              <div className="rounded-2xl border border-border/80 bg-card p-4 space-y-3 shadow-2xs">
                {/* Header Summary Banner */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-border/60">
                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-primary/10 text-primary font-extrabold text-xs">
                      <Layers className="h-3.5 w-3.5" />
                      <span>{files.length} {files.length === 1 ? 'Chapter' : 'Chapters'}</span>
                    </div>
                    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-muted font-bold text-xs text-foreground font-mono">
                      <span>{files.some((file) => file.documentId)
                        ? 'PDF stored'
                        : outputMode === 'flashcard' ? `${totalFlashcardCount} Flashcards` : `${totalPagesCount} Total Pages`}</span>
                    </div>
                    <div className="hidden sm:flex items-center gap-1 px-2.5 py-1 rounded-xl bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 text-[10px] font-bold">
                      <CheckCircle2 className="h-3 w-3" />
                      <span>{files.some((file) => file.documentId) ? (files.some((file) => file.generationJobId) ? 'Generation saved' : 'Ready to generate') : outputMode === 'flashcard' ? 'Verbatim Source Preserved' : 'Proportionally Balanced'}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 self-end sm:self-auto">
                    <button
                      type="button"
                      onClick={clearAllFiles}
                      disabled={generating}
                      className="text-[11px] font-bold text-muted-foreground hover:text-destructive transition-colors flex items-center gap-1"
                    >
                      <Trash2 className="h-3 w-3" />
                      <span>Clear All</span>
                    </button>
                  </div>
                </div>

                {/* File items list */}
                <div className="max-h-56 overflow-y-auto space-y-1.5 pr-1">
                  {files.map((file, idx) => (
                    <div
                      key={file.id}
                      className="group flex items-center justify-between p-2.5 rounded-xl border border-border/60 bg-background hover:border-border hover:bg-muted/30 transition-all text-xs"
                    >
                      <div className="flex items-center gap-2.5 min-w-0 pr-2">
                        <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-primary/10 text-primary shrink-0">
                          <FileText className="h-3.5 w-3.5" />
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-foreground truncate max-w-[200px] sm:max-w-xs" title={file.name}>
                              {file.name}
                            </span>
                            <span className="text-[10px] font-mono text-muted-foreground shrink-0">
                              ({formatBytes(file.size)})
                            </span>
                          </div>
                          <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                            <span className="text-primary font-semibold">Ch. {idx + 1}</span>
                            <span>•</span>
                            <span>{file.documentId
                              ? (file.pageCount > 0 ? `${file.pageCount} ${file.pageCount === 1 ? 'page' : 'pages'}` : 'Page count after generation')
                              : `${file.pageCount} ${file.pageCount === 1 ? 'page' : 'pages'}`}</span>
                            {file.documentId && (
                              <>
                                <span>•</span>
                                <span>{file.generationJobId ? 'Generation saved — click Generate to resume' : 'Ready to generate'}</span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        {file.status === 'ready' ? (
                          <span className="inline-flex items-center rounded-lg bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold text-emerald-600 border border-emerald-500/20">
                            {file.documentId ? (file.generationJobId ? 'Resume generation' : 'Ready to generate') : `${file.pageCount}p ready`}
                          </span>
                        ) : (
                          <span className="inline-flex items-center rounded-lg bg-destructive/10 px-2 py-0.5 text-[10px] font-bold text-destructive">
                            Error
                          </span>
                        )}
                        <button
                          type="button"
                          onClick={() => removeFile(file.id)}
                          disabled={generating}
                          className="p-1 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                          title="Remove file"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          /* Plain Text / Notes Input */
          <div>
            <textarea
              rows={isModal ? 6 : 8}
              placeholder="Paste textbook excerpt, lecture transcripts, or bullet points here..."
              value={text}
              onChange={(e) => setText(e.target.value)}
              disabled={generating}
              className="w-full rounded-2xl border border-border bg-background p-3.5 text-xs text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary resize-none leading-relaxed font-mono shadow-2xs"
            />
          </div>
        )}
      </div>

      {/* SSE Progress Bar */}
      {generating && (
        <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4 space-y-3 animate-in fade-in duration-300 shadow-sm">
          <div className="flex items-center justify-between text-xs font-bold">
            <div className="flex items-center gap-2 text-primary">
              <Loader2 className="h-4 w-4 animate-spin shrink-0" />
              <span className="truncate">{progressMessage || 'Generating reviewer...'}</span>
            </div>
            <span className="text-muted-foreground font-mono shrink-0">{progress}%</span>
          </div>

          <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
            <div
              className="h-full bg-primary transition-all duration-300 ease-out"
              style={{ width: `${progress}%` }}
            />
          </div>

          <div className="flex flex-wrap items-center justify-between gap-1 text-[11px] text-muted-foreground">
            <span className="truncate">{progressDetail}</span>
            <div className="flex items-center gap-2 shrink-0">
              {tokensCount > 0 && <span className="font-mono">{tokensCount} tokens</span>}
              <span className="inline-flex items-center gap-1 font-semibold text-primary/80 bg-primary/10 px-2 py-0.5 rounded-md text-[10px]">
                Adaptive Engine
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center justify-end gap-2.5 pt-2">
        {draftStatus === 'saved' && (
          <span className="mr-auto text-[11px] font-semibold text-muted-foreground">Draft saved locally</span>
        )}
        {draftStatus === 'error' && (
          <span className="mr-auto text-[11px] font-semibold text-amber-600 dark:text-amber-400">Draft could not be saved</span>
        )}
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            disabled={generating}
            className="rounded-xl px-4 py-2 text-xs font-semibold text-muted-foreground hover:bg-muted transition-colors"
          >
            Cancel
          </button>
        )}
        <button
          type="button"
          onClick={handleGenerate}
          disabled={generating || isProcessingFiles}
          className="flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-xs font-bold text-white hover:bg-primary/90 transition-all active:scale-95 disabled:opacity-50 shadow-md shadow-primary/20 cursor-pointer"
        >
          {generating ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Generating ({progress}%)...</span>
            </>
          ) : (
            <>
              <Sparkles className="h-4 w-4" />
              <span>
                {outputMode === 'flashcard'
                  ? `Create Flashcards${files.length > 0 ? ` (${totalFlashcardCount} cards)` : ''}`
                  : inputMode === 'upload' && files.length > 0
                    ? `${files.some((file) => file.generationJobId) ? 'Resume' : 'Generate'} Reviewer(${files.length} ${files.length === 1 ? 'file' : 'chapters'}, ${totalPagesCount}p)`
                    : 'Generate Reviewer'}
              </span>
              <ArrowRight className="h-3.5 w-3.5" />
            </>
          )}
        </button>
      </div>
    </div>
  );
}
