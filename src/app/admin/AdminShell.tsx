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
import { SeedButton } from '../../components/admin/SeedButton';
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

    if (pin !== adminPin) {
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
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 p-6">
      <div className="w-full max-w-sm">
        <h1 className="text-2xl font-semibold text-gray-900 text-center mb-8">Admin Login</h1>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <input
            type="password"
            value={pin}
            onChange={(e) => setPin(e.target.value)}
            placeholder="Enter PIN"
            disabled={loading}
            aria-label="Admin PIN"
            className="w-full min-h-[48px] px-4 rounded-lg border border-gray-300 text-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
          />
          {error && (
            <p role="alert" className="text-red-600 text-sm text-center">
              {error}
            </p>
          )}
          <button
            type="submit"
            disabled={loading || pin.length === 0}
            className="w-full min-h-[48px] bg-blue-600 text-white text-lg font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
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
  const [activeTab, setActiveTab] = useState<ActiveTab>('participants');
  const [groupFilter, setGroupFilter] = useState<Group | 'all'>('all');
  const [events, setEvents] = useState<EventDoc[]>([]);
  const [judges, setJudges] = useState<JudgeDoc[]>([]);
  const [participants, setParticipants] = useState<ParticipantDoc[]>([]);
  const [allRounds, setAllRounds] = useState<RoundDoc[]>([]);
  const [allScores, setAllScores] = useState<ScoreDoc[]>([]);

  // Re-establish anonymous auth on mount, then check saved session
  useEffect(() => {
    signInAnonymouslyWithRetry()
      .then(() => {
        const saved = typeof window !== 'undefined' && localStorage.getItem('adminSession') === '1';
        setIsAdmin(saved);
      })
      .catch(() => {})
      .finally(() => setAuthReady(true));
  }, []);

  // Start Firestore subscriptions only after authenticated
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
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <p className="text-sm text-gray-500">Connecting…</p>
      </div>
    );
  }

  if (!isAdmin) {
    return <PinScreen adminPin={adminPin} onSuccess={() => setIsAdmin(true)} />;
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      <h1 className="text-2xl font-semibold text-gray-900 mb-6">Admin</h1>

      {/* Tab bar */}
      <div className="sticky top-0 z-10 bg-white border-b border-gray-200 mb-6 -mx-4 px-4">
        <div className="flex overflow-x-auto gap-1 scrollbar-none">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`min-h-[48px] px-4 whitespace-nowrap text-sm font-medium border-b-2 transition-colors flex-shrink-0 ${
                activeTab === tab.id
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-600 hover:text-gray-900 hover:border-gray-300'
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
            <h2 className="text-lg font-semibold text-gray-800 mb-3">Import Schedule (CSV)</h2>
            <ScheduleImport judges={judges} onImported={() => {}} />
          </section>
          <section>
            <h2 className="text-lg font-semibold text-gray-800 mb-3">Create Event Manually</h2>
            <EventBuilder events={events} onEventCreated={() => {}} />
          </section>
          <section>
            <h2 className="text-lg font-semibold text-gray-800 mb-3">All Rounds</h2>
            <AdminRoundList events={events} judges={judges} />
          </section>
          <section>
            <h2 className="text-lg font-semibold text-gray-800 mb-3">Create Round Manually</h2>
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
            <label htmlFor="group-filter" className="text-sm font-medium text-gray-700">
              Filter by group
            </label>
            <select
              id="group-filter"
              value={groupFilter}
              onChange={(e) => setGroupFilter(e.target.value as Group | 'all')}
              className="min-h-[48px] px-4 rounded-lg border border-gray-300 text-base bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 max-w-xs"
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
            <h2 className="text-lg font-semibold text-gray-800 mb-3">Points Configuration</h2>
            <PointsConfigEditor events={events} />
          </section>
          <section>
            <h2 className="text-lg font-semibold text-gray-800 mb-3">Points Leaderboard</h2>
            <PointsDashboard participants={participants} />
          </section>
        </div>
      )}

      {/* ── Settings ── */}
      {activeTab === 'settings' && (
        <div className="flex flex-col gap-8">
          <section>
            <h2 className="text-lg font-semibold text-gray-800 mb-3">Seed Sample Data</h2>
            <SeedButton />
          </section>
          <section>
            <h2 className="text-lg font-semibold text-gray-800 mb-3">Off-Stage Judge Assignments</h2>
            <OffStageJudgeAssignments judges={judges} />
          </section>
          <section>
            <h2 className="text-lg font-semibold text-gray-800 mb-3">Add Judge Device (QR Code)</h2>
            <AddJudgeDevice judges={judges} />
          </section>
        </div>
      )}
    </div>
  );
}
