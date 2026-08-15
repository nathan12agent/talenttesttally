'use client';

import { useEffect, useState } from 'react';

interface JudgeSession {
  judgeId: string;
  judgeName: string;
}

const SESSION_KEY = 'judgeSession';

export function useJudgeSession(): {
  judgeId: string | null;
  judgeName: string | null;
  setSession: (judgeId: string, judgeName: string) => void;
  clearSession: () => void;
} {
  const [judgeId, setJudgeId] = useState<string | null>(null);
  const [judgeName, setJudgeName] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const stored = sessionStorage.getItem(SESSION_KEY);
    if (stored) {
      try {
        const parsed: JudgeSession = JSON.parse(stored);
        setJudgeId(parsed.judgeId);
        setJudgeName(parsed.judgeName);
      } catch {
        // Ignore malformed data
        sessionStorage.removeItem(SESSION_KEY);
      }
    }
  }, []);

  const setSession = (newJudgeId: string, newJudgeName: string) => {
    const session: JudgeSession = { judgeId: newJudgeId, judgeName: newJudgeName };
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
    setJudgeId(newJudgeId);
    setJudgeName(newJudgeName);
  };

  const clearSession = () => {
    sessionStorage.removeItem(SESSION_KEY);
    setJudgeId(null);
    setJudgeName(null);
  };

  return { judgeId, judgeName, setSession, clearSession };
}
