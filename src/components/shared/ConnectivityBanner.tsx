'use client';

import { useConnectionStatus } from '../../hooks/useConnectionStatus';

export function ConnectivityBanner() {
  const isConnected = useConnectionStatus();

  return (
    <div
      role="status"
      className={`sticky top-0 z-10 text-center text-sm font-medium py-1.5 ${
        isConnected ? 'bg-green-50 text-green-700' : 'bg-amber-50 text-amber-800'
      }`}
    >
      {isConnected ? '● Online' : '⏳ Offline — scores will sync when reconnected'}
    </div>
  );
}