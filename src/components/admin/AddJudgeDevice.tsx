'use client';

import { useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import type { JudgeDoc } from '../../types';

interface AddJudgeDeviceProps {
  judges: JudgeDoc[];
}

/**
 * Generates a QR code + short link per judge, encoding their deviceLinkToken.
 * Judge scans it -> opens /judge?token=... -> app resolves the judge by
 * token, judge confirms their PIN once, then can "Add to Home Screen".
 * Re-showing the QR code for a judge lets them switch to a backup phone
 * with zero reinstall friction.
 */
export function AddJudgeDevice({ judges }: AddJudgeDeviceProps) {
  const [selectedJudgeId, setSelectedJudgeId] = useState('');

  const selectedJudge = judges.find((j) => j.id === selectedJudgeId);
  const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';
  const link = selectedJudge ? `${baseUrl}/judge?token=${selectedJudge.deviceLinkToken}` : '';

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <label htmlFor="ajd-judge" className="text-sm font-medium text-gray-700">
          Judge
        </label>
        <select
          id="ajd-judge"
          value={selectedJudgeId}
          onChange={(e) => setSelectedJudgeId(e.target.value)}
          className="min-h-[48px] px-4 rounded-lg border border-gray-300 text-base bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">Select a judge…</option>
          {judges.map((j) => (
            <option key={j.id} value={j.id}>
              {j.name}
            </option>
          ))}
        </select>
      </div>

      {selectedJudge && (
        <div className="flex flex-col items-center gap-3 p-4 border border-gray-200 rounded-xl bg-white">
          <QRCodeSVG value={link} size={200} />
          <p className="text-sm text-gray-600 break-all text-center">{link}</p>
          <p className="text-xs text-gray-400 text-center">
            Scan on {selectedJudge.name}'s phone → confirm PIN → tap "Add to Home Screen"
            for a one-tap app icon. Re-show this QR any time to switch to a backup phone.
          </p>
        </div>
      )}
    </div>
  );
}
