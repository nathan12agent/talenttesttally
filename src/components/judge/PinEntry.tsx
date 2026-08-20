'use client';

import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { getJudgeByPin, getJudgeByDeviceToken } from '../../lib/firestore';
import type { JudgeDoc } from '../../types';

interface PinEntryProps {
  onSuccess: (judge: JudgeDoc) => void;
}

export function PinEntry({ onSuccess }: PinEntryProps) {
  const searchParams = useSearchParams();
  const token = searchParams.get('token');

  const [pin, setPin] = useState('');
  const [tokenJudge, setTokenJudge] = useState<JudgeDoc | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!token) return;
    getJudgeByDeviceToken(token).then((judge) => {
      if (judge) setTokenJudge(judge);
    });
  }, [token]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const judge = tokenJudge ?? (await getJudgeByPin(pin));
      if (!judge) {
        setError('Invalid PIN. Please try again.');
        return;
      }
      if (tokenJudge && tokenJudge.pin !== pin) {
        setError('PIN does not match this device link.');
        return;
      }
      onSuccess(judge);
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-stage-black flex flex-col items-center justify-center px-6">
      <div className="w-full max-w-sm flex flex-col items-center gap-8">
        {/* Logo / title */}
        <div className="text-center">
          <p className="font-display text-spotlight-gold text-6xl tracking-widest leading-none">
            JUDGE
          </p>
          <p className="font-display text-ink text-4xl tracking-widest leading-none mt-1">
            LOGIN
          </p>
        </div>

        <form onSubmit={handleSubmit} className="w-full flex flex-col gap-4">
          {tokenJudge && (
            <p className="text-sm text-ink-muted text-center">
               Confirm password for{' '}
              <span className="font-medium text-ink">{tokenJudge.name}</span>
            </p>
          )}

          <input
            type="password"
            value={pin}
            onChange={(e) => setPin(e.target.value)}
            placeholder="Password"
            disabled={loading}
            aria-label="Judge Password"
            className="w-full min-h-[64px] px-4 rounded-xl bg-paper text-stage-black text-3xl text-center tracking-[0.3em] focus:outline-none focus:ring-2 focus:ring-spotlight-gold disabled:opacity-50"
          />

          {error && (
            <p role="alert" className="text-curtain-red text-sm text-center font-medium">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading || pin.length === 0}
            className="w-full min-h-[56px] bg-spotlight-gold text-stage-black text-lg font-bold rounded-xl hover:opacity-90 active:opacity-80 disabled:opacity-40 disabled:cursor-not-allowed transition-opacity focus:outline-none focus:ring-2 focus:ring-spotlight-gold focus:ring-offset-2 focus:ring-offset-stage-black"
          >
            {loading ? 'Checking…' : 'Continue'}
          </button>
        </form>
      </div>
    </div>
  );
}
