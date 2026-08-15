'use client';

import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { getJudgeByPin, getJudgeByDeviceToken } from '../../lib/firestore'; // getJudgeByDeviceToken added below
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

  // If a QR/link token is present, resolve the judge and skip to PIN confirm.
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
      // If arrived via token, still require the judge to confirm their PIN
      // matches, so a borrowed/lost phone can't be used by scanning alone.
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
    <form onSubmit={handleSubmit} className="flex flex-col gap-4 p-4">
      {tokenJudge && (
        <p className="text-sm text-gray-600">
          Confirm PIN for <span className="font-medium">{tokenJudge.name}</span>
        </p>
      )}
      <input
        type="password"
        inputMode="numeric"
        value={pin}
        onChange={(e) => setPin(e.target.value)}
        placeholder="4-digit PIN"
        maxLength={4}
        className="min-h-[56px] px-4 rounded-lg border border-gray-300 text-2xl text-center tracking-widest focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
      {error && (
        <p role="alert" className="text-red-600 text-sm">
          {error}
        </p>
      )}
      <button
        type="submit"
        disabled={loading || pin.length !== 4}
        className="min-h-[52px] bg-blue-600 text-white text-base font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50"
      >
        {loading ? 'Checking…' : 'Continue'}
      </button>
    </form>
  );
}