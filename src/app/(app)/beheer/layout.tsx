import type { ReactNode } from 'react';
import { AdminNav } from '@/components/client/admin-nav';
import { requireAdmin } from '@/lib/auth/session';

export default async function AdminLayout({ children }: { children: ReactNode }) {
  await requireAdmin();
  return (
    <>
      <AdminNav />
      {children}
    </>
  );
}
