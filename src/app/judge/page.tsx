'use client';

import { useEffect, useState, Suspense } from 'react';
import { signInAnonymouslyWithRetry } from '../../lib/auth';
import { useJudgeSession } from '../../hooks/useJudgeSession';
import { useJudgeHeartbeat } from '../../hooks/useJudgeHeartbeat';
import { PinEntry } from '../../components/judge/PinEntry';
import { RoundList } from '../../components/judge/RoundList';

// Force dynamic rendering — this page uses Firebase (browser-only)
export const dynamic = 'force-dynamic';

export default function JudgePage() {
  const { judgeId, judgeName, setSession } = useJudgeSession();
  useJudgeHeartbeat(judgeId);
  const [authLoading, setAuthLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function signIn() {
      try {
        await signInAnonymouslyWithRetry();
        if (!cancelled) setAuthError(null);
      } catch (err) {
        if (!cancelled) {
          setAuthError(err instanceof Error ? err.message : 'Failed to connect. Please retry.');
        }
      } finally {
        if (!cancelled) setAuthLoading(false);
      }
    }

    signIn();
    return () => { cancelled = true; };
  }, []);

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="flex flex-col items-center gap-3">
          <svg className="animate-spin h-10 w-10 text-blue-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" aria-label="Loading">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
          </svg>
          <p className="text-sm text-gray-500">Connecting…</p>
        </div>
      </div>
    );
  }

  if (authError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-6">
        <div className="w-full max-w-sm text-center">
          <p className="text-red-600 mb-4">{authError}</p>
          <button
            onClick={() => {
              setAuthError(null);
              setAuthLoading(true);
              signInAnonymouslyWithRetry()
                .then(() => setAuthError(null))
                .catch((err) => setAuthError(err instanceof Error ? err.message : 'Failed to connect.'))
                .finally(() => setAuthLoading(false));
            }}
            className="min-h-[48px] px-6 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!judgeId) {
    return (
      <Suspense fallback={
        <div className="min-h-screen flex items-center justify-center bg-gray-50">
          <p className="text-sm text-gray-500">Loading…</p>
        </div>
      }>
        <PinEntry onSuccess={(judge) => setSession(judge.id, judge.name)} />
      </Suspense>
    );
  }

  return <RoundList judgeId={judgeId} judgeName={judgeName ?? ''} />;
}
