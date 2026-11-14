import type { Metadata } from 'next';
import type { ReportParams } from '@/lib/reports/periods';
import { ReportPage } from '../report-page';

export const metadata: Metadata = { title: 'Rapport Mobiliteit' };

export default async function Page({ searchParams }: { searchParams: Promise<ReportParams> }) {
  return <ReportPage id="mobiliteit" params={await searchParams} />;
}
