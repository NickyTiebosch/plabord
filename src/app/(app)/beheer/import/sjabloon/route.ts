import { requireAdmin } from '@/lib/auth/session';
import { buildTemplate } from '@/lib/import/xlsx';

export const dynamic = 'force-dynamic';

/** Het lege importbestand, met dezelfde tabbladen en kopnamen als de import verwacht. */
export async function GET() {
  await requireAdmin();
  const file = await buildTemplate();
  return new Response(new Uint8Array(file), {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': 'attachment; filename="planbord-importsjabloon.xlsx"',
      'Cache-Control': 'private, no-store',
    },
  });
}
