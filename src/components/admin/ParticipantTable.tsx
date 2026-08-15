'use client';
import { useParticipants } from '../../hooks/useParticipants';

export function ParticipantTable() {
  const participants = useParticipants();

  const sorted = [...participants].sort((a, b) => {
    return Number(a.chestNo) - Number(b.chestNo);
  });

  return (
    <div className="w-full overflow-x-auto rounded-lg border border-gray-200">
      <table className="min-w-full divide-y divide-gray-200 text-sm">
        <thead className="bg-gray-50">
          <tr>
            <th
              scope="col"
              className="px-4 py-3 text-left font-semibold text-gray-600 uppercase tracking-wider"
            >
              Chest No
            </th>
            <th
              scope="col"
              className="px-4 py-3 text-left font-semibold text-gray-600 uppercase tracking-wider"
            >
              Name
            </th>
            <th
              scope="col"
              className="px-4 py-3 text-left font-semibold text-gray-600 uppercase tracking-wider"
            >
              Group
            </th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-100">
          {sorted.length === 0 ? (
            <tr>
              <td
                colSpan={3}
                className="px-4 py-6 text-center text-gray-400 italic"
              >
                No participants imported yet.
              </td>
            </tr>
          ) : (
            sorted.map((p) => (
              <tr key={p.chestNo} className="hover:bg-gray-50 transition-colors">
                <td className="px-4 py-3 font-mono text-gray-800">{p.chestNo}</td>
                <td className="px-4 py-3 text-gray-800">{p.name}</td>
                <td className="px-4 py-3 text-gray-600">{p.group}</td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
