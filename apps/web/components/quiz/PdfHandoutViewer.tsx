'use client';

import { useEffect, useRef, useState } from 'react';

const MIN_ZOOM = 0.75;
const MAX_ZOOM = 2.5;
const ZOOM_STEP = 0.25;

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
  const [zoom, setZoom] = useState(1);
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
    setZoom(1);
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
        const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
        // Brave on iPadOS uses WebKit and can fail to start the module worker.
        // Keep PDF parsing/rendering on the main thread for reliable mobile display.
        loadingTask = pdfjs.getDocument({
          data,
          disableWorker: true,
          useSystemFonts: true,
          isEvalSupported: false,
        });
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
          const scale = (availableWidth / baseViewport.width) * zoom;
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
  }, [containerWidth, pageCount, pdfDocument, zoom]);

  return (
    <div
      ref={containerRef}
      className={`relative min-h-0 overflow-auto overscroll-contain bg-muted/40 p-2 [touch-action:pan-x_pan-y_pinch-zoom] ${className}`}
      aria-label={title}
    >
      <div className="sticky top-2 z-10 mx-auto flex w-fit items-center gap-1 rounded-full border border-border/70 bg-card/95 p-1 shadow-sm backdrop-blur">
        <button
          type="button"
          onClick={() => setZoom((current) => Math.max(MIN_ZOOM, current - ZOOM_STEP))}
          disabled={zoom <= MIN_ZOOM || Boolean(error)}
          className="flex h-7 w-7 items-center justify-center rounded-full text-sm font-black text-foreground transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-40"
          aria-label="Zoom out of source PDF"
        >
          −
        </button>
        <button
          type="button"
          onClick={() => setZoom(1)}
          disabled={zoom === 1 || Boolean(error)}
          className="min-w-14 rounded-full px-2 py-1 text-[11px] font-bold text-muted-foreground transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-40"
          aria-label="Reset source PDF zoom"
        >
          {Math.round(zoom * 100)}%
        </button>
        <button
          type="button"
          onClick={() => setZoom((current) => Math.min(MAX_ZOOM, current + ZOOM_STEP))}
          disabled={zoom >= MAX_ZOOM || Boolean(error)}
          className="flex h-7 w-7 items-center justify-center rounded-full text-sm font-black text-foreground transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-40"
          aria-label="Zoom in on source PDF"
        >
          +
        </button>
        {(isLoading || isRendering) && !error && (
          <span className="pl-1 pr-2 text-[11px] font-semibold text-muted-foreground" aria-live="polite">
            {isLoading ? 'Loading…' : 'Rendering…'}
          </span>
        )}
      </div>

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
        <div className="mx-auto flex w-max min-w-full flex-col items-center gap-3">
          {Array.from({ length: pageCount }, (_, index) => {
            const pageNumber = index + 1;
            return (
              <canvas
                key={pageNumber}
                ref={(canvas) => {
                  canvasRefs.current[pageNumber] = canvas;
                }}
                aria-label={`${title}, page ${pageNumber}`}
                className="block h-auto shrink-0 rounded-sm bg-white shadow-sm"
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
