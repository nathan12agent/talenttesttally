// Server component wrapper — prevents static pre-rendering of the judge page.
// All Firebase usage is in JudgeShell (client component).
export const dynamic = 'force-dynamic';

import { JudgeShell } from './JudgeShell';

export default function JudgePage() {
  return <JudgeShell />;
}
