'use client';
import { SyncStatus } from '../../types';

interface SyncStatusBadgeProps {
  syncStatus: SyncStatus;
}

export function SyncStatusBadge({ syncStatus }: SyncStatusBadgeProps) {
  if (syncStatus === 'synced') {
    return (
      <span className="flex items-center justify-center min-h-[48px] min-w-[48px] text-green-600 text-sm font-medium">
        Saved ✓
      </span>
    );
  }

  if (syncStatus === 'pending') {
    return (
      <span className="flex items-center justify-center min-h-[48px] min-w-[48px] text-yellow-600 text-sm font-medium">
        Pending ⏳
      </span>
    );
  }

  return (
    <span className="flex items-center justify-center min-h-[48px] min-w-[48px] text-red-600 text-sm font-medium">
      Failed ✗
    </span>
  );
}
