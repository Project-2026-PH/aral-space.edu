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
import { PdfExtractionService } from '@quiz-creator/core';
import NewSubjectModal from '../subject/NewSubjectModal';

export interface IngestedFileState {
  id: string;
  name: string;
  size: number;
  pageCount: number;
  pages: HandoutPage[];
  status: 'parsing' | 'ready' | 'error';
  error?: string;
}

export interface AiQuizGeneratorProps {
  subjects?: Array<{ id: string; name: string; color?: string }>;
  onGenerated?: (quizId: string) => void;
  onCancel?: () => void;
  isModal?: boolean;
}

export default function AiQuizGenerator({
  subjects = [],
  onGenerated,
  onCancel,
  isModal = false
}: AiQuizGeneratorProps) {
  const router = useRouter();
  const [title, setTitle] = useState('');
  const [subjectList, setSubjectList] = useState<Array<{ id: string; name: string; color?: string }>>(subjects);
  const [selectedSubject, setSelectedSubject] = useState(subjects[0]?.id || '');
  const [showSubjectModal, setShowSubjectModal] = useState(false);
  const [pipelineMode] = useState<AiPipelineMode>('auto');

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

  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setSubjectList(subjects);
    if (!selectedSubject && subjects.length > 0) {
      setSelectedSubject(subjects[0].id);
    }
  }, [subjects]);

  const totalPagesCount = files.reduce((acc, f) => acc + (f.status === 'ready' ? f.pageCount : 0), 0);

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
      if (file.name.endsWith('.pdf') || file.type === 'application/pdf') {
        const arrayBuffer = await file.arrayBuffer();
        const { pages, pageCount } = await PdfExtractionService.parsePdf(arrayBuffer, file.name);
        return {
          id: fileId,
          name: file.name,
          size: file.size,
          pageCount,
          pages,
          status: 'ready'
        };
      } else {
        // Plain text / Markdown notes
        const textContent = await file.text();
        const pages = PdfExtractionService.extractTextFromMockOrPlain(textContent, file.name);
        return {
          id: fileId,
          name: file.name,
          size: file.size,
          pageCount: pages.length,
          pages,
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

  async function handleGenerate() {
    // Check if input is provided in current mode
    const hasFiles = inputMode === 'upload' && files.length > 0;
    const hasText = inputMode === 'text' && text.trim().length > 0;

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
    setProgressMessage('Analyzing study material...');
    setProgressDetail('Configuring optimal pedagogy strategy & authoring style...');
    setError(null);

    try {
      let aggregatedPages: HandoutPage[] = [];
      let filesSummary: IngestedFileInfo[] | undefined;

      if (hasFiles) {
        aggregatedPages = PdfExtractionService.aggregateMultiFilePages(
          files.map((f) => ({ name: f.name, pages: f.pages }))
        );
        filesSummary = files.map((f) => ({
          fileName: f.name,
          pageCount: f.pageCount,
          fileSize: f.size
        }));
      }

      const generatedTitle = title.trim() || (
        hasFiles
          ? (files.length > 1 ? `${files.length} Chapters Comprehensive Review` : files[0].name.replace(/\.[^/.]+$/, ''))
          : 'AI Generated Exam Reviewer'
      );

      const response = await fetch('/api/generate-quiz', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: generatedTitle,
          subjectId: selectedSubject || null,
          text: hasText ? text.trim() : undefined,
          pdfPages: aggregatedPages.length > 0 ? aggregatedPages : undefined,
          filesSummary,
          pipelineMode: 'auto'
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
        if (onGenerated) {
          onGenerated(finalQuizId);
        } else {
          router.push(`/quizzes/${finalQuizId}`);
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
            <div>Adaptive Exam Reviewer Engine</div>
            <div className="text-[11px] font-normal text-muted-foreground">
              Auto-routes material size, cross-chapter distribution & distractor rigor
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1.5 text-[10px] font-bold text-emerald-600 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 rounded-xl self-start sm:self-auto">
          <CheckCircle2 className="h-3 w-3" />
          <span>Auto-Optimized</span>
        </div>
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
          disabled={generating}
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
          disabled={generating}
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
                    Supports multiple chapter PDFs, handouts, or course directories. Multi-chapter reviewer automatically balances questions across every file.
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
                <span>Parsing and categorizing chapter pages into streams...</span>
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
                      <span>{totalPagesCount} Total Pages</span>
                    </div>
                    <div className="hidden sm:flex items-center gap-1 px-2.5 py-1 rounded-xl bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 text-[10px] font-bold">
                      <CheckCircle2 className="h-3 w-3" />
                      <span>Proportionally Balanced</span>
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
                            <span>{file.pageCount} {file.pageCount === 1 ? 'page' : 'pages'}</span>
                            {totalPagesCount > 0 && (
                              <>
                                <span>•</span>
                                <span>~{Math.round((file.pageCount / totalPagesCount) * 100)}% weight</span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        {file.status === 'ready' ? (
                          <span className="inline-flex items-center rounded-lg bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold text-emerald-600 border border-emerald-500/20">
                            {file.pageCount}p ready
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
                {inputMode === 'upload' && files.length > 0
                  ? `Generate Reviewer(${files.length} ${files.length === 1 ? 'file' : 'chapters'}, ${totalPagesCount}p)`
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
