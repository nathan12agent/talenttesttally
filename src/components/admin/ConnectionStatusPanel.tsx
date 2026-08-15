'use client';

import { useEffect, useState } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import type { JudgeDoc } from '../../types';

interface JudgePresence {
  id: string;
  name: string;
  lastSeenAt: string | null;
  online: boolean;
}

/** A judge is considered "online" if their last heartbeat was within 30 seconds */
const ONLINE_THRESHOLD_MS = 30_000;

function formatRelative(isoString: string | null): string {
  if (!isoString) return 'Never';
  const diff = Date.now() - new Date(isoString).getTime();
  if (diff < 5_000) return 'Just now';
  if (diff < 60_000) return `${Math.floor(diff / 1000)}s ago`;
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  return new Date(isoString).toLocaleTimeString();
}

interface ConnectionStatusPanelProps {
  judges: JudgeDoc[];
}

export function ConnectionStatusPanel({ judges }: ConnectionStatusPanelProps) {
  const [presence, setPresence] = useState<Record<string, JudgePresence>>({});
  // Tick every 5s to refresh "X seconds ago" display
  const [, setTick] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => setTick((t) => t + 1), 5_000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (judges.length === 0) return;

    // Subscribe to the full judges collection for lastSeenAt updates
    const unsubscribe = onSnapshot(collection(db, 'judges'), (snap) => {
      const next: Record<string, JudgePresence> = {};
      snap.docs.forEach((d) => {
        const data = d.data() as Partial<JudgeDoc & { lastSeenAt: string }>;
        const lastSeenAt = data.lastSeenAt ?? null;
        const online = lastSeenAt
          ? Date.now() - new Date(lastSeenAt).getTime() < ONLINE_THRESHOLD_MS
          : false;
        next[d.id] = {
          id: d.id,
          name: data.name ?? d.id,
          lastSeenAt,
          online,
        };
      });
      setPresence(next);
    });

    return unsubscribe;
  }, [judges]);

  return (
    <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-100 bg-gray-50">
        <h3 className="text-sm font-semibold text-gray-700">Judge Connection Status</h3>
      </div>
      <table className="min-w-full text-sm">
        <thead className="bg-gray-50 border-b border-gray-200">
          <tr>
            <th className="px-4 py-2 text-left font-medium text-gray-600">Judge</th>
            <th className="px-4 py-2 text-center font-medium text-gray-600">Status</th>
            <th className="px-4 py-2 text-right font-medium text-gray-600">Last seen</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {judges.length === 0 ? (
            <tr>
              <td colSpan={3} className="px-4 py-4 text-center text-gray-400">
                No judges configured.
              </td>
            </tr>
          ) : (
            judges.map((judge) => {
              const p = presence[judge.id];
              const online = p?.online ?? false;
              const lastSeenAt = p?.lastSeenAt ?? null;

              return (
                <tr key={judge.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-800">{judge.name}</td>
                  <td className="px-4 py-3 text-center">
                    <span
                      className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2 py-0.5 rounded-full ${
                        online
                          ? 'bg-green-100 text-green-700'
                          : 'bg-gray-100 text-gray-500'
                      }`}
                    >
                      <span
                        className={`w-2 h-2 rounded-full inline-block ${
                          online ? 'bg-green-500 animate-pulse' : 'bg-gray-400'
                        }`}
                      />
                      {online ? 'Online' : 'Offline'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right text-gray-500 text-xs">
                    {formatRelative(lastSeenAt)}
                  </td>
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
}
