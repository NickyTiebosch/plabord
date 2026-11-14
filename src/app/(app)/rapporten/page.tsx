import type { Metadata } from 'next';
import type { ReportParams } from '@/lib/reports/periods';
import { ReportPage } from './report-page';

export const metadata: Metadata = { title: 'Rapporten' };

export default async function Page({ searchParams }: { searchParams: Promise<ReportParams> }) {
  return <ReportPage id="overzicht" params={await searchParams} />;
}
