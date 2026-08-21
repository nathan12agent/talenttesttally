'use client';

import { useState, useEffect } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { signInAnonymouslyWithRetry } from '../../lib/auth';
import { setAdminSession } from '../../lib/firestore';
import { ParticipantImport } from '../../components/admin/ParticipantImport';
import { ParticipantTable } from '../../components/admin/ParticipantTable';
import { EventBuilder } from '../../components/admin/EventBuilder';
import { AdminRoundList } from '../../components/admin/RoundList';
import { RoundBuilder } from '../../components/admin/RoundBuilder';
import { ScheduleImport } from '../../components/admin/ScheduleImport';
import { LiveControl } from '../../components/admin/LiveControl';
import { ConnectionStatusPanel } from '../../components/admin/ConnectionStatusPanel';
import { ResultsDashboard } from '../../components/admin/ResultsDashboard';
import { ExportButton } from '../../components/admin/ExportButton';
import { PointsDashboard } from '../../components/admin/PointsDashboard';
import { PointsConfigEditor } from '../../components/admin/PointsConfigEditor';
import { OffStageJudgeAssignments } from '../../components/admin/OffStageJudgeAssignments';
import { AddJudgeDevice } from '../../components/admin/AddJudgeDevice';
import { ClearDataButton } from '../../components/admin/ClearDataButton';
import { AddJudgeForm } from '../../components/admin/AddJudgeForm';
import type { Group, EventDoc, JudgeDoc, RoundDoc, ScoreDoc, ParticipantDoc } from '../../types';

type ActiveTab = 'participants' | 'rounds' | 'control' | 'results' | 'points' | 'settings';

const TABS: { id: ActiveTab; label: string }[] = [
  { id: 'participants', label: 'Participants' },
  { id: 'rounds', label: 'Events & Rounds' },
  { id: 'control', label: 'Live Control' },
  { id: 'results', label: 'Results' },
  { id: 'points', label: 'Points' },
  { id: 'settings', label: 'Settings' },
];

const GROUP_OPTIONS: Array<Group | 'all'> = ['all', 'Sub Jr', 'Jr', 'Intermediate', 'Senior'];

interface AdminShellProps {
  adminPin: string;
}

// ── PIN entry screen ──────────────────────────────────────────────────────────

function PinScreen({
  adminPin,
  onSuccess,
}: {
  adminPin: string;
  onSuccess: () => void;
}) {
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    if (!adminPin) {
      setError('Admin PIN not configured. Check NEXT_PUBLIC_ADMIN_PIN in .env.local.');
      return;
    }

    if (pin.trim() !== adminPin.trim()) {
      setError('Incorrect admin PIN');
      return;
    }

    setLoading(true);
    try {
      const credential = await signInAnonymouslyWithRetry();
      const uid = credential.user.uid;
      await setAdminSession(uid);
      localStorage.setItem('adminSession', '1');
      onSuccess();
    } catch {
      setError('Failed to create admin session. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-stage-black p-6">
      <div className="w-full max-w-sm flex flex-col items-center gap-8">
        <div className="text-center">
          <p className="font-display text-spotlight-gold text-6xl tracking-widest leading-none">ADMIN</p>
          <p className="font-display text-ink text-3xl tracking-widest leading-none mt-1">LOGIN</p>
        </div>
        <form onSubmit={handleSubmit} className="w-full flex flex-col gap-4">
          <input
            type="password"
            value={pin}
            onChange={(e) => setPin(e.target.value)}
            placeholder="Enter PIN"
            disabled={loading}
            aria-label="Admin PIN"
            className="w-full min-h-[56px] px-4 rounded-xl bg-paper text-stage-black text-xl text-center tracking-widest focus:outline-none focus:ring-2 focus:ring-spotlight-gold disabled:opacity-50"
          />
          {error && (
            <p role="alert" className="text-curtain-red text-sm text-center font-medium">
              {error}
            </p>
          )}
          <button
            type="submit"
            disabled={loading || pin.length === 0}
            className="w-full min-h-[52px] bg-spotlight-gold text-stage-black text-lg font-bold rounded-xl hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed transition-opacity focus:outline-none focus:ring-2 focus:ring-spotlight-gold focus:ring-offset-2 focus:ring-offset-stage-black"
          >
            {loading ? 'Signing in…' : 'Enter'}
          </button>
        </form>
      </div>
    </div>
  );
}

// ── Main shell ────────────────────────────────────────────────────────────────

export function AdminShell({ adminPin }: AdminShellProps) {
  const [isAdmin, setIsAdmin] = useState(false);
  const [authReady, setAuthReady] = useState(false);
  const [authError, setAuthError] = useState('');
  const [activeTab, setActiveTab] = useState<ActiveTab>('control');
  const [groupFilter, setGroupFilter] = useState<Group | 'all'>('all');
  const [events, setEvents] = useState<EventDoc[]>([]);
  const [judges, setJudges] = useState<JudgeDoc[]>([]);
  const [participants, setParticipants] = useState<ParticipantDoc[]>([]);
  const [allRounds, setAllRounds] = useState<RoundDoc[]>([]);
  const [allScores, setAllScores] = useState<ScoreDoc[]>([]);

  useEffect(() => {
    signInAnonymouslyWithRetry()
      .then(() => {
        const saved = typeof window !== 'undefined' && localStorage.getItem('adminSession') === '1';
        setIsAdmin(saved);
      })
      .catch((err) => {
        setAuthError(err instanceof Error ? err.message : 'Failed to connect to Firebase.');
      })
      .finally(() => setAuthReady(true));
  }, []);

  useEffect(() => {
    if (!isAdmin) return;

    const unsubs = [
      onSnapshot(collection(db, 'events'), (snap) =>
        setEvents(snap.docs.map((d) => ({ id: d.id, ...d.data() } as EventDoc))),
      ),
      onSnapshot(collection(db, 'judges'), (snap) =>
        setJudges(snap.docs.map((d) => ({ id: d.id, ...d.data() } as JudgeDoc))),
      ),
      onSnapshot(collection(db, 'participants'), (snap) =>
        setParticipants(snap.docs.map((d) => ({ chestNo: d.id, ...d.data() } as ParticipantDoc))),
      ),
      onSnapshot(collection(db, 'eventRounds'), (snap) =>
        setAllRounds(snap.docs.map((d) => ({ id: d.id, ...d.data() } as RoundDoc))),
      ),
      onSnapshot(collection(db, 'scores'), (snap) =>
        setAllScores(snap.docs.map((d) => ({ id: d.id, ...d.data() } as ScoreDoc))),
      ),
    ];

    return () => unsubs.forEach((u) => u());
  }, [isAdmin]);

  if (!authReady) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-stage-black">
        <p className="text-sm text-ink-muted">Connecting…</p>
      </div>
    );
  }

  if (authError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-stage-black p-6">
        <div className="text-center max-w-sm">
          <p className="text-curtain-red mb-2 font-medium">Connection failed</p>
          <p className="text-sm text-ink-muted mb-4">{authError}</p>
          <button
            onClick={() => window.location.reload()}
            className="min-h-[48px] px-6 bg-spotlight-gold text-stage-black rounded-xl font-bold focus:outline-none focus:ring-2 focus:ring-spotlight-gold"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

    if (!isAdmin) {
    return <PinScreen adminPin={adminPin} onSuccess={() => setIsAdmin(true)} />;
  }

  function handleAdminLogout() {
    localStorage.removeItem('adminSession');
    setIsAdmin(false);
  }

  return (
    <div className="min-h-screen bg-stage-black">
      <div className="max-w-2xl mx-auto px-4 py-6">
        <div className="flex items-start justify-between gap-4 mb-6">
          <h1 className="font-display text-4xl text-spotlight-gold tracking-wide">Admin</h1>
          <button
            onClick={handleAdminLogout}
            className="min-h-[40px] px-4 mt-1 text-sm font-medium text-ink-muted border border-ink-muted/30 rounded-lg hover:text-ink hover:border-ink-muted/60 transition-colors flex-shrink-0"
          >
            Logout
          </button>
        </div>

        {/* Tab bar */}
        <div className="sticky top-0 z-10 bg-stage-charcoal border-b border-ink-muted/20 mb-6 -mx-4 px-4">
          <div className="flex overflow-x-auto gap-1 scrollbar-none">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`min-h-[48px] px-4 whitespace-nowrap text-sm font-medium border-b-2 transition-colors flex-shrink-0 focus:outline-none focus:ring-2 focus:ring-spotlight-gold ${
                  activeTab === tab.id
                    ? 'border-spotlight-gold text-spotlight-gold'
                    : 'border-transparent text-ink-muted hover:text-ink hover:border-ink-muted/40'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* ── Participants ── */}
        {activeTab === 'participants' && (
          <div className="flex flex-col gap-6">
            <ParticipantImport />
            <ParticipantTable />
          </div>
        )}

        {/* ── Events & Rounds ── */}
        {activeTab === 'rounds' && (
          <div className="flex flex-col gap-8">
            <section>
              <h2 className="font-display text-2xl text-ink mb-3">Import Schedule (CSV)</h2>
              <ScheduleImport judges={judges} onImported={() => {}} />
            </section>
            <section>
              <h2 className="font-display text-2xl text-ink mb-3">Create Event Manually</h2>
              <EventBuilder events={events} onEventCreated={() => {}} />
            </section>
            <section>
              <h2 className="font-display text-2xl text-ink mb-3">All Rounds</h2>
              <AdminRoundList events={events} judges={judges} />
            </section>
            <section>
              <h2 className="font-display text-2xl text-ink mb-3">Create Round Manually</h2>
              <RoundBuilder events={events} judges={judges} participants={participants} onSave={() => {}} />
            </section>
          </div>
        )}

        {/* ── Live Control ── */}
        {activeTab === 'control' && (
          <div className="flex flex-col gap-6">
            <ConnectionStatusPanel judges={judges} />
            <LiveControl events={events} />
          </div>
        )}

        {/* ── Results ── */}
        {activeTab === 'results' && (
          <div className="flex flex-col gap-6">
            <div className="flex flex-col gap-1">
              <label htmlFor="group-filter" className="text-sm font-medium text-ink-muted">
                Filter by group
              </label>
              <select
                id="group-filter"
                value={groupFilter}
                onChange={(e) => setGroupFilter(e.target.value as Group | 'all')}
                className="min-h-[48px] px-4 rounded-lg border border-ink-muted/30 text-base bg-stage-charcoal text-ink focus:outline-none focus:ring-2 focus:ring-spotlight-gold max-w-xs"
              >
                {GROUP_OPTIONS.map((g) => (
                  <option key={g} value={g}>{g === 'all' ? 'All groups' : g}</option>
                ))}
              </select>
            </div>
            <ResultsDashboard group={groupFilter} events={events} judges={judges} />
            <ExportButton group={groupFilter} rounds={allRounds} scores={allScores} participants={participants} />
          </div>
        )}

        {/* ── Points ── */}
        {activeTab === 'points' && (
          <div className="flex flex-col gap-8">
            <section>
              <h2 className="font-display text-2xl text-ink mb-3">Points Configuration</h2>
              <PointsConfigEditor events={events} />
            </section>
            <section>
              <h2 className="font-display text-2xl text-ink mb-3">Points Leaderboard</h2>
              <PointsDashboard participants={participants} />
            </section>
          </div>
        )}

        {/* ── Settings ── */}
        {activeTab === 'settings' && (
          <div className="flex flex-col gap-8">
            <section>
              <h2 className="font-display text-2xl text-ink mb-3">Add Judge</h2>
              <AddJudgeForm />
            </section>
            <section>
              <h2 className="font-display text-2xl text-ink mb-3">Clear Data</h2>
              <ClearDataButton />
            </section>
            <section>
              <h2 className="font-display text-2xl text-ink mb-3">Off-Stage Judge Assignments</h2>
              <OffStageJudgeAssignments judges={judges} />
            </section>
            <section>
              <h2 className="font-display text-2xl text-ink mb-3">Add Judge Device (QR Code)</h2>
              <AddJudgeDevice judges={judges} />
            </section>
          </div>
        )}
      </div>
    </div>
  );
}