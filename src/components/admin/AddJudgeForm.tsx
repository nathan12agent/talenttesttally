'use client';

import { useState } from 'react';
import { collection, addDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase';

function randomToken(): string {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export function AddJudgeForm() {
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [status, setStatus] = useState<'idle' | 'saving' | 'error'>('idle');
  const [error, setError] = useState('');
  const [lastAdded, setLastAdded] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    if (!name.trim() || !password.trim()) {
      setError('Enter both a name and a password.');
      return;
    }

    setStatus('saving');
    try {
      await addDoc(collection(db, 'judges'), {
        name: name.trim(),
        pin: password.trim(),
        deviceLinkToken: randomToken(),
      });
      setLastAdded(name.trim());
      setName('');
      setPassword('');
      setStatus('idle');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add judge');
      setStatus('error');
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3 max-w-sm">
      <div className="flex flex-col gap-1">
        <label htmlFor="judge-name" className="text-sm font-medium text-gray-700">
          Judge Name
        </label>
        <input
          id="judge-name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Judge Alice"
          disabled={status === 'saving'}
          className="min-h-[48px] px-4 rounded-lg border border-gray-300 text-base bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
        />
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="judge-password" className="text-sm font-medium text-gray-700">
          Password
        </label>
        <input
          id="judge-password"
          type="text"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Any password"
          disabled={status === 'saving'}
          className="min-h-[48px] px-4 rounded-lg border border-gray-300 text-base bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
        />
      </div>

      {error && <p className="text-red-600 text-sm">{error}</p>}
      {lastAdded && !error && (
        <p className="text-green-600 text-sm">✓ Added judge: {lastAdded}</p>
      )}

      <button
        type="submit"
        disabled={status === 'saving'}
        className="min-h-[48px] px-6 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed self-start transition-colors"
      >
        {status === 'saving' ? 'Adding…' : 'Add Judge'}
      </button>
    </form>
  );
}