import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { AgentCallStats, CallDetail, CallRecord } from '../models/call-record.model';
import { ApiService } from '../http/api.service';

@Injectable({ providedIn: 'root' })
export class CallRecordService {
  constructor(private readonly api: ApiService) {}

  getStatsForAgent(agentId: string): Observable<AgentCallStats> {
    return this.api.getCallStats(agentId);
  }

  getRecordsForAgent(agentId: string): Observable<CallRecord[]> {
    return this.api.getCallRecords(agentId);
  }

  /** The call with its full customer/agent conversation. */
  getCallDetail(agentId: string, callId: string): Observable<CallDetail> {
    return this.api.getCallDetail(agentId, callId);
  }
}
