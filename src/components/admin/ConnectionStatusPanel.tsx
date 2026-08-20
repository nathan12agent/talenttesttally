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
  const [, setTick] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => setTick((t) => t + 1), 5_000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (judges.length === 0) return;

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
    <div className="rounded-xl bg-stage-charcoal border border-ink-muted/10 overflow-hidden">
      <div className="px-4 py-3 border-b border-ink-muted/10">
        <h3 className="text-sm font-semibold text-ink-muted uppercase tracking-wider">
          Judge Connection Status
        </h3>
      </div>
      <table className="min-w-full text-sm">
        <thead className="border-b border-ink-muted/10">
          <tr>
            <th className="px-4 py-2 text-left font-medium text-ink-muted text-xs uppercase tracking-wider">Judge</th>
            <th className="px-4 py-2 text-center font-medium text-ink-muted text-xs uppercase tracking-wider">Status</th>
            <th className="px-4 py-2 text-right font-medium text-ink-muted text-xs uppercase tracking-wider">Last seen</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-ink-muted/10">
          {judges.length === 0 ? (
            <tr>
              <td colSpan={3} className="px-4 py-4 text-center text-ink-muted text-xs">
                No judges configured.
              </td>
            </tr>
          ) : (
            judges.map((judge) => {
              const p = presence[judge.id];
              const online = p?.online ?? false;
              const lastSeenAt = p?.lastSeenAt ?? null;

              return (
                <tr key={judge.id}>
                  <td className="px-4 py-3 font-medium text-ink">{judge.name}</td>
                  <td className="px-4 py-3 text-center">
                    <span className="inline-flex items-center gap-1.5 text-xs font-semibold">
                      <span
                        className={`w-2 h-2 rounded-full inline-block ${
                          online
                            ? 'bg-spotlight-gold animate-pulse'
                            : 'bg-ink-muted/40'
                        }`}
                        aria-hidden="true"
                      />
                      <span className={online ? 'text-spotlight-gold' : 'text-ink-muted'}>
                        {online ? 'Online' : 'Offline'}
                      </span>
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right text-ink-muted text-xs">
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
