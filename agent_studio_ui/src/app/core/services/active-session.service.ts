import { Injectable, inject } from '@angular/core';
import { Observable, of } from 'rxjs';
import { delay, map } from 'rxjs/operators';
import { ApiService } from '../http/api.service';
import { ApiCallRecord } from '../http/call-record-mapper';
import { ActiveSession, LiveMessage } from '../models/active-session.model';
import { generateLiveMessages } from '../../../mocks/live-call-messages.mock';

const API_DELAY = 300;

function toActiveSession(call: ApiCallRecord): ActiveSession {
  return {
    id: call.id,
    agentId: call.agent_id,
    customerName: call.customer_name ?? call.phone_number ?? (call.provider === 'webrtc' ? 'Web caller' : 'Unknown caller'),
    phoneNumber: call.phone_number ?? '',
    direction: call.direction,
    startedAt: call.occurred_at,
  };
}

@Injectable({ providedIn: 'root' })
export class ActiveSessionService {
  private readonly api = inject(ApiService);

  getActiveSessions(agentId: string): Observable<ActiveSession[]> {
    return this.api.getActiveCalls(agentId).pipe(map((calls) => calls.map(toActiveSession)));
  }

  /** Mock-backed — no "live transcript" endpoint in API.md yet. */
  getLiveMessages(session: ActiveSession): Observable<LiveMessage[]> {
    return of(generateLiveMessages(session)).pipe(delay(API_DELAY));
  }
}
