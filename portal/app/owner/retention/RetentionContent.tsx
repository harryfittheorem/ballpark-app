'use client';

import { RetentionReportContent } from '@/components/owner/RetentionReportContent';
import type { RetentionDataset } from '@/lib/retention/types';

export function RetentionContent({ data }: { data: RetentionDataset }) {
  return <RetentionReportContent data={data} mode="retention" />;
}
