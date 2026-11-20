'use client';

import { RetentionReportContent } from '@/components/owner/RetentionReportContent';
import type { RetentionDataset } from '@/lib/retention/types';

export function ChurnAnalysisContent({ data }: { data: RetentionDataset }) {
  return <RetentionReportContent data={data} mode="churn" />;
}
