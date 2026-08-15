'use client';

import { useState } from 'react';
import { signInAnonymouslyWithRetry } from '../../lib/auth';
import { setAdminSession } from '../../lib/firestore';

// Next.js statically inlines NEXT_PUBLIC_* variables at the module level.
// Referencing inside a function body can sometimes prevent inlining.
const ADMIN_PIN = process.env.NEXT_PUBLIC_ADMIN_PIN ?? '';

interface AdminPinEntryProps {
  onSuccess: () => void;
}

export function AdminPinEntry({ onSuccess }: AdminPinEntryProps) {
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    if (!ADMIN_PIN) {
      setError('Admin PIN not configured. Check NEXT_PUBLIC_ADMIN_PIN in .env.local.');
      return;
    }

    if (pin !== ADMIN_PIN) {
      setError('Incorrect admin PIN');
      return;
    }

    setLoading(true);
    try {
      const credential = await signInAnonymouslyWithRetry();
      const uid = credential.user.uid;
      await setAdminSession(uid);
      onSuccess();
    } catch {
      setError('Failed to create admin session. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 p-6">
      <div className="w-full max-w-sm">
        <h1 className="text-2xl font-semibold text-gray-900 text-center mb-8">
          Admin Login
        </h1>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <input
            type="password"
            inputMode="numeric"
            value={pin}
            onChange={(e) => setPin(e.target.value)}
            placeholder="Enter PIN"
            className="w-full min-h-[48px] px-4 rounded-lg border border-gray-300 text-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            disabled={loading}
            aria-label="Admin PIN"
          />
          {error && (
            <p role="alert" className="text-red-600 text-sm text-center">
              {error}
            </p>
          )}
          <button
            type="submit"
            disabled={loading || pin.length === 0}
            className="w-full min-h-[48px] bg-blue-600 text-white text-lg font-medium rounded-lg hover:bg-blue-700 active:bg-blue-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? 'Signing in…' : 'Enter'}
          </button>
        </form>
      </div>
    </div>
  );
}
