'use client';

import { useEffect, useRef, useState } from 'react';

interface PdfHandoutViewerProps {
  sourceUrl: string;
  title: string;
  className?: string;
}

export default function PdfHandoutViewer({ sourceUrl, title, className = '' }: PdfHandoutViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRefs = useRef<Record<number, HTMLCanvasElement | null>>({});
  const renderVersionRef = useRef(0);
  const [pdfDocument, setPdfDocument] = useState<any>(null);
  const [pageCount, setPageCount] = useState(0);
  const [containerWidth, setContainerWidth] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isRendering, setIsRendering] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const updateWidth = () => setContainerWidth(container.clientWidth);
    updateWidth();

    const observer = new ResizeObserver(updateWidth);
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    let cancelled = false;
    let loadingTask: any = null;
    let loadedDocument: any = null;
    const abortController = new AbortController();

    setPdfDocument(null);
    setPageCount(0);
    setIsLoading(true);
    setIsRendering(false);
    setError(null);
    canvasRefs.current = {};

    const loadDocument = async () => {
      try {
        const response = await fetch(sourceUrl, {
          credentials: 'include',
          signal: abortController.signal,
        });
        if (!response.ok) throw new Error(`Unable to load source PDF (${response.status})`);

        const data = new Uint8Array(await response.arrayBuffer());
        const pdfjs = await import('pdfjs-dist/build/pdf.mjs');
        pdfjs.GlobalWorkerOptions.workerSrc = new URL(
          'pdfjs-dist/build/pdf.worker.mjs',
          import.meta.url
        ).toString();

        loadingTask = pdfjs.getDocument({ data });
        loadedDocument = await loadingTask.promise;
        if (cancelled) return;

        setPdfDocument(loadedDocument);
        setPageCount(loadedDocument.numPages);
        setIsLoading(false);
      } catch (loadError: any) {
        if (cancelled || loadError?.name === 'AbortError') return;
        console.error('Unable to render source PDF:', loadError);
        setError('This source could not be rendered here.');
        setIsLoading(false);
      }
    };

    void loadDocument();

    return () => {
      cancelled = true;
      abortController.abort();
      void loadingTask?.destroy?.();
      void loadedDocument?.destroy?.();
    };
  }, [sourceUrl]);

  useEffect(() => {
    if (!pdfDocument || !pageCount || !containerWidth) return;

    const renderVersion = ++renderVersionRef.current;
    setIsRendering(true);

    const renderPages = async () => {
      try {
        const availableWidth = Math.max(containerWidth - 16, 240);
        const deviceScale = Math.min(window.devicePixelRatio || 1, 2);

        for (let pageNumber = 1; pageNumber <= pageCount; pageNumber += 1) {
          if (renderVersion !== renderVersionRef.current) return;

          const canvas = canvasRefs.current[pageNumber];
          if (!canvas) continue;

          const page = await pdfDocument.getPage(pageNumber);
          const baseViewport = page.getViewport({ scale: 1 });
          const scale = availableWidth / baseViewport.width;
          const viewport = page.getViewport({ scale });

          canvas.width = Math.ceil(viewport.width * deviceScale);
          canvas.height = Math.ceil(viewport.height * deviceScale);
          canvas.style.width = `${Math.ceil(viewport.width)}px`;
          canvas.style.height = `${Math.ceil(viewport.height)}px`;

          const context = canvas.getContext('2d');
          if (!context) continue;

          await page.render({
            canvasContext: context,
            viewport,
            transform: deviceScale === 1 ? undefined : [deviceScale, 0, 0, deviceScale, 0, 0],
          }).promise;
          page.cleanup();
        }

        if (renderVersion === renderVersionRef.current) setIsRendering(false);
      } catch (renderError) {
        if (renderVersion !== renderVersionRef.current) return;
        console.error('Unable to render source PDF pages:', renderError);
        setError('This source could not be rendered here.');
        setIsRendering(false);
      }
    };

    void renderPages();
  }, [containerWidth, pageCount, pdfDocument]);

  return (
    <div
      ref={containerRef}
      className={`relative min-h-0 overflow-y-auto overscroll-contain bg-muted/40 p-2 [touch-action:pan-y] ${className}`}
      aria-label={title}
    >
      {(isLoading || isRendering) && !error && (
        <div className="sticky top-2 z-10 mx-auto w-fit rounded-full border border-border/70 bg-card/95 px-3 py-1.5 text-[11px] font-semibold text-muted-foreground shadow-sm">
          {isLoading ? 'Loading source…' : 'Rendering pages…'}
        </div>
      )}

      {error ? (
        <div className="flex min-h-full items-center justify-center p-6 text-center">
          <div className="max-w-xs space-y-3">
            <p className="text-xs font-semibold text-foreground">{error}</p>
            <a
              href={sourceUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex rounded-xl bg-primary px-3 py-2 text-xs font-bold text-primary-foreground hover:bg-primary/90"
            >
              Open source PDF
            </a>
          </div>
        </div>
      ) : (
        <div className="mx-auto flex w-full max-w-4xl flex-col items-center gap-3">
          {Array.from({ length: pageCount }, (_, index) => {
            const pageNumber = index + 1;
            return (
              <canvas
                key={pageNumber}
                ref={(canvas) => {
                  canvasRefs.current[pageNumber] = canvas;
                }}
                aria-label={`${title}, page ${pageNumber}`}
                className="block h-auto max-w-full rounded-sm bg-white shadow-sm"
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
