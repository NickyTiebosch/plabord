import type { ReactNode } from 'react';
import { AdminNav } from '@/components/client/admin-nav';
import { requireLead } from '@/lib/auth/session';

/**
 * Beheer is voor beheerders en teamleiders (fase 5, V43). Een teamleider ziet alleen Overzicht,
 * Afwezigheid en Invallen; de andere pagina's controleren zelf dat je beheerder bent.
 */
export default async function AdminLayout({ children }: { children: ReactNode }) {
  const viewer = await requireLead();
  return (
    <>
      <AdminNav isAdmin={viewer.isAdmin} />
      {children}
    </>
  );
}
