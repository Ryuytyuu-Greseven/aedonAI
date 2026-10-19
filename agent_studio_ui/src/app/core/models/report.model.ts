import { CallRecord } from './call-record.model';

export type ReportPeriod = 'daily' | 'weekly' | 'monthly' | 'custom';
export type ReportFrequency = 'daily' | 'weekly' | 'monthly';

export interface ReportRequest {
  agentId: string;
  period: ReportPeriod;
  startDate?: string;
  endDate?: string;
}

export interface GeneratedReport {
  reportId: string;
  filename: string;
  rows: CallRecord[];
}
