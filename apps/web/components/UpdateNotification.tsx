'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import { usePathname } from 'next/navigation';
import { Sparkles, RefreshCw, X } from 'lucide-react';

const CHECK_COOLDOWN_MS = 60 * 1000; // Throttle checks to once every 60 seconds
const CURRENT_VERSION = process.env.NEXT_PUBLIC_APP_VERSION;

interface VersionResponse {
  version?: string;
  builtAt?: string;
}

export default function UpdateNotification() {
  const pathname = usePathname();
  const [hasUpdate, setHasUpdate] = useState(false);
  const [newVersion, setNewVersion] = useState<string | null>(null);
  const [dismissedVersion, setDismissedVersion] = useState<string | null>(null);
  const [isUpdating, startUpdateTransition] = useTransition();
  const lastCheckRef = useRef<number>(0);

  const checkForUpdate = async () => {
    // Only check if client has an initialized version hash
    if (!CURRENT_VERSION) return;

    const now = Date.now();
    if (now - lastCheckRef.current < CHECK_COOLDOWN_MS) {
      return;
    }
    lastCheckRef.current = now;

    try {
      const res = await fetch(`/version.json?_t=${now}`, {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache, no-store',
        },
      });

      if (!res.ok) return;

      const data: VersionResponse = await res.json();
      if (data.version && data.version !== CURRENT_VERSION) {
        setNewVersion(data.version);
        if (data.version !== dismissedVersion) {
          setHasUpdate(true);
        }
      }
    } catch {
      // Network hiccup or offline; silently swallow
    }
  };

  // 1. Initial delayed check after initial render
  useEffect(() => {
    const timer = setTimeout(() => {
      checkForUpdate();
    }, 5000);
    return () => clearTimeout(timer);
  }, []);

  // 2. Tab refocus / visibility check
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        checkForUpdate();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleVisibilityChange);
    };
  }, [dismissedVersion]);

  // 3. Next.js route navigation check
  useEffect(() => {
    checkForUpdate();
  }, [pathname]);

  // Intercept ChunkLoadError / dynamic import failure globally for automatic recovery
  useEffect(() => {
    const isChunkFailure = (msg?: string) =>
      /Loading chunk [\d]+ failed|ChunkLoadError|Failed to fetch dynamically imported module/i.test(msg || '');

    const tryAutoReload = () => {
      const reloadKey = 'chunk_reload_attempted';
      const lastReload = parseInt(sessionStorage.getItem(reloadKey) || '0', 10);
      const now = Date.now();
      if (now - lastReload > 15000) {
        sessionStorage.setItem(reloadKey, String(now));
        window.location.reload();
      }
    };

    const handleError = (event: ErrorEvent) => {
      if (isChunkFailure(event.message) || isChunkFailure(event.error?.message)) {
        tryAutoReload();
      }
    };

    const handleRejection = (event: PromiseRejectionEvent) => {
      const reason = event.reason;
      const msg = typeof reason === 'string' ? reason : reason?.message;
      if (isChunkFailure(msg)) {
        tryAutoReload();
      }
    };

    window.addEventListener('error', handleError);
    window.addEventListener('unhandledrejection', handleRejection);

    return () => {
      window.removeEventListener('error', handleError);
      window.removeEventListener('unhandledrejection', handleRejection);
    };
  }, []);

  const handleUpdateNow = () => {
    startUpdateTransition(() => {
      window.location.reload();
    });
  };

  const handleDismiss = () => {
    if (newVersion) {
      setDismissedVersion(newVersion);
    }
    setHasUpdate(false);
  };

  if (!hasUpdate) return null;

  return (
    <aside
      aria-live="polite"
      role="status"
      className="fixed bottom-[calc(6.5rem+env(safe-area-inset-bottom))] right-5 z-50 max-w-sm w-[calc(100vw-2.5rem)] sm:bottom-5 sm:w-auto p-4 rounded-2xl bg-card/95 dark:bg-card/90 backdrop-blur-md border border-border shadow-2xl shadow-primary/10 transition-all duration-300 animate-in fade-in slide-in-from-bottom-5"
    >
      <div className="flex items-start gap-3">
        <div className="p-2 rounded-xl bg-primary/10 text-primary shrink-0 mt-0.5">
          <Sparkles className="w-5 h-5 animate-pulse" />
        </div>

        <div className="flex-1 min-w-0 pr-1">
          <h4 className="text-sm font-semibold text-foreground tracking-tight">
            Update Available
          </h4>
          <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
            A new version of Aral Space is ready with improvements.
          </p>

          <div className="flex items-center gap-2 mt-3">
            <button
              type="button"
              onClick={handleUpdateNow}
              disabled={isUpdating}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-primary-foreground bg-primary hover:bg-primary/90 active:scale-95 transition-all rounded-lg shadow-sm disabled:opacity-70 cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isUpdating ? 'animate-spin' : ''}`} />
              {isUpdating ? 'Updating...' : 'Update Now'}
            </button>

            <button
              type="button"
              onClick={handleDismiss}
              className="px-2.5 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted active:scale-95 transition-all rounded-lg cursor-pointer"
            >
              Later
            </button>
          </div>
        </div>

        <button
          type="button"
          onClick={handleDismiss}
          aria-label="Dismiss update notification"
          className="p-1 text-muted-foreground hover:text-foreground rounded-lg hover:bg-muted transition-colors cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </aside>
  );
}
