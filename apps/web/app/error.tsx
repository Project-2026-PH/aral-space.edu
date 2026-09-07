'use client';

import { useEffect } from 'react';
import { AlertCircle, RefreshCw, ArrowLeft } from 'lucide-react';
import Link from 'next/link';

export default function RootErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const isChunkError =
    /Loading chunk [\d]+ failed|ChunkLoadError|Failed to fetch dynamically imported module/i.test(
      error?.message || ''
    );

  useEffect(() => {
    if (isChunkError) {
      const reloadKey = 'chunk_reload_attempted';
      const lastReload = parseInt(sessionStorage.getItem(reloadKey) || '0', 10);
      const now = Date.now();
      // Auto-reload once if not attempted in the last 15 seconds
      if (now - lastReload > 15000) {
        sessionStorage.setItem(reloadKey, String(now));
        window.location.reload();
      }
    }
  }, [isChunkError]);

  return (
    <div className="min-h-[50vh] flex flex-col items-center justify-center px-4 py-16 text-center">
      <div className="p-3 rounded-2xl bg-destructive/10 text-destructive mb-4">
        <AlertCircle className="w-8 h-8" />
      </div>

      <h2 className="text-xl font-bold tracking-tight text-foreground sm:text-2xl">
        {isChunkError ? 'Updating to Latest Version...' : 'Something went wrong'}
      </h2>

      <p className="text-sm text-muted-foreground mt-2 max-w-md leading-relaxed">
        {isChunkError
          ? 'A newer version was deployed. Refreshing the application to load updated components...'
          : (error?.message || 'An unexpected error occurred while rendering this page.')}
      </p>

      <div className="flex items-center gap-3 mt-6">
        <button
          type="button"
          onClick={() => (isChunkError ? window.location.reload() : reset())}
          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-primary-foreground bg-primary hover:bg-primary/90 rounded-xl transition-all shadow-sm active:scale-95 cursor-pointer"
        >
          <RefreshCw className="w-4 h-4" />
          {isChunkError ? 'Reload Now' : 'Try Again'}
        </button>

        <Link
          href="/library"
          className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted rounded-xl transition-all"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Library
        </Link>
      </div>
    </div>
  );
}
