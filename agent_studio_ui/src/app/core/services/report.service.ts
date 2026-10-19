import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { CallRecord } from '../models/call-record.model';
import { GeneratedReport, ReportFrequency, ReportRequest } from '../models/report.model';
import { ApiService } from '../http/api.service';
import { AuthService } from './auth.service';

export function toCsv(rows: CallRecord[]): string {
  const header = ['id', 'direction', 'occurred_at', 'outcome'];
  const lines = rows.map((r) => [r.id, r.direction, r.occurred_at, r.outcome].join(','));
  return [header.join(','), ...lines].join('\n');
}

@Injectable({ providedIn: 'root' })
export class ReportService {
  constructor(
    private readonly api: ApiService,
    private readonly auth: AuthService,
  ) {}

  generateReport(request: ReportRequest): Observable<GeneratedReport> {
    return this.api.generateReport(request.agentId, {
      period: request.period,
      startDate: request.startDate,
      endDate: request.endDate,
    });
  }

  downloadReport(agentId: string, reportId: string): Observable<Blob> {
    return this.api.downloadReport(agentId, reportId);
  }

  sendReportEmail(report: GeneratedReport, recipient?: string): Observable<void> {
    const email = recipient ?? this.auth.session()?.email;
    if (!email) {
      throw new Error('No recipient email available');
    }
    return this.api.sendReportEmail({ recipient: email, filename: report.filename });
  }

  sendReportWhatsApp(report: GeneratedReport, recipient = '+0000000000'): Observable<void> {
    return this.api.sendReportWhatsApp({ recipient, filename: report.filename });
  }

  getFrequencyPreference(agentId: string): Observable<ReportFrequency | null> {
    return this.api.getReportFrequency(agentId);
  }

  setFrequencyPreference(agentId: string, frequency: ReportFrequency): Observable<void> {
    return this.api.setReportFrequency(agentId, frequency);
  }
}
