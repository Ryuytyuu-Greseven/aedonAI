import { Injectable } from '@angular/core';
import { Observable, of, throwError } from 'rxjs';
import { delay } from 'rxjs/operators';
import { AgentCallStats, CallDetail, CallRecord } from '../models/call-record.model';
import { generateCallDetail, MOCK_CALL_RECORDS } from '../../../mocks/call-records.mock';
import { ApiService } from '../http/api.service';

const API_DELAY = 300;

@Injectable({ providedIn: 'root' })
export class CallRecordService {
  /** Fallback used only for call-detail mock (no backend endpoint yet). */
  private readonly mockRecords: CallRecord[] = MOCK_CALL_RECORDS;

  constructor(private readonly api: ApiService) {}

  getStatsForAgent(agentId: string): Observable<AgentCallStats> {
    return this.api.getCallStats(agentId);
  }

  getRecordsForAgent(agentId: string): Observable<CallRecord[]> {
    return this.api.getCallRecords(agentId);
  }

  /** Still mock-backed — no `GET /calls/:id` in API.md. */
  getCallDetail(callId: string): Observable<CallDetail> {
    const record = this.mockRecords.find((r) => r.id === callId);
    if (!record) {
      return throwError(() => new Error(`Call record not found: ${callId}`));
    }
    return of(generateCallDetail(record)).pipe(delay(API_DELAY));
  }
}
