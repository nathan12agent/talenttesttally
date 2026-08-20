// Server component — reads env var and passes it to the client shell.
// This is the correct way to use NEXT_PUBLIC_* vars in App Router:
// the server reads them at render time and passes as props.
import { AdminShell } from './AdminShell';

// Force dynamic rendering — this page uses Firebase (browser-only) via client components
export const dynamic = 'force-dynamic';

export default function AdminPage() {
  const adminPin = process.env.NEXT_PUBLIC_ADMIN_PIN ?? '';
  return <AdminShell adminPin={adminPin} />;
}
