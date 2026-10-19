import { Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';
import { delay } from 'rxjs/operators';
import { ActiveSession, LiveMessage } from '../models/active-session.model';
import { generateActiveSessions } from '../../../mocks/active-sessions.mock';
import { generateLiveMessages } from '../../../mocks/live-call-messages.mock';

const API_DELAY = 300;

@Injectable({ providedIn: 'root' })
export class ActiveSessionService {
  /** Mock-backed — no "list active sessions" endpoint in API.md yet. */
  getActiveSessions(agentId: string): Observable<ActiveSession[]> {
    return of(generateActiveSessions(agentId)).pipe(delay(API_DELAY));
  }

  /** Mock-backed — no "live transcript" endpoint in API.md yet. */
  getLiveMessages(session: ActiveSession): Observable<LiveMessage[]> {
    return of(generateLiveMessages(session)).pipe(delay(API_DELAY));
  }
}
