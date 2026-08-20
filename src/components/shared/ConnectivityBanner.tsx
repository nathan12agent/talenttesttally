'use client';

import { useOnlineStatus } from '../../hooks/useOnlineStatus';

export function ConnectivityBanner() {
  const isOnline = useOnlineStatus();

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed top-3 right-3 z-50 flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-stage-charcoal border border-ink-muted/30 shadow-lg text-xs select-none"
    >
      {isOnline ? (
        <>
          <span
            className="w-2 h-2 rounded-full bg-spotlight-gold shrink-0"
            aria-hidden="true"
          />
          <span className="text-ink-muted font-medium">Live</span>
        </>
      ) : (
        <>
          <span
            className="w-2 h-2 rounded-full bg-amber-400 shrink-0 animate-pulse"
            aria-hidden="true"
          />
          <span className="text-ink font-medium">Reconnecting…</span>
        </>
      )}
    </div>
  );
}
