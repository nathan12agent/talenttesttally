'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { signInAnonymouslyWithRetry } from '../../../lib/auth';
import { getJudgeByDeviceToken } from '../../../lib/firestore';
import { useJudgeSession } from '../../../hooks/useJudgeSession';
import { PinEntry } from '../../../components/judge/PinEntry';

/**
 * /judge-link/[token] — QR-code onboarding endpoint.
 *
 * Flow:
 * 1. Resolve judge from deviceLinkToken.
 * 2. If judge found, show PinEntry pre-filled with judge context.
 *    Judge enters their PIN to confirm identity → redirected to /judge.
 * 3. If token invalid, show error.
 *
 * Re-showing the QR always works — this is not a one-shot link.
 */
export default function JudgeLinkPage() {
  const params = useParams();
  const router = useRouter();
  const token = typeof params?.token === 'string' ? params.token : '';

  const { setSession } = useJudgeSession();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [judgeId, setJudgeId] = useState<string | null>(null);
  const [judgeName, setJudgeName] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      setError('Invalid link — no token found.');
      setLoading(false);
      return;
    }

    async function resolve() {
      try {
        await signInAnonymouslyWithRetry();
        const judge = await getJudgeByDeviceToken(token);
        if (!judge) {
          setError('This link is not recognised. Please ask the admin to regenerate your QR code.');
        } else {
          setJudgeId(judge.id);
          setJudgeName(judge.name);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to connect. Please retry.');
      } finally {
        setLoading(false);
      }
    }

    resolve();
  }, [token]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <p className="text-sm text-gray-500">Resolving your link…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-6">
        <div className="text-center max-w-sm">
          <p className="text-red-600 mb-4">{error}</p>
          <button
            onClick={() => router.push('/judge')}
            className="min-h-[48px] px-6 bg-blue-600 text-white rounded-lg font-medium"
          >
            Go to judge login
          </button>
        </div>
      </div>
    );
  }

  // Judge found — confirm PIN, then redirect to /judge
  return (
    <div className="min-h-screen bg-gray-50">
      {judgeName && (
        <div className="max-w-sm mx-auto px-4 pt-8 pb-2">
          <p className="text-sm text-gray-500 text-center mb-4">
            Hi, <strong>{judgeName}</strong>! Confirm your PIN to continue.
          </p>
        </div>
      )}
      <PinEntry
        onSuccess={(judge) => {
          // Only accept a PIN that matches this judge (extra guard)
          if (judgeId && judge.id !== judgeId) return;
          setSession(judge.id, judge.name);
          router.push('/judge');
        }}
      />
    </div>
  );
}
