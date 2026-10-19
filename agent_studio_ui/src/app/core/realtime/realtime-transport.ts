import { InjectionToken } from '@angular/core';
import { Observable } from 'rxjs';
import { ConnectionStatus, RealtimeCommand, RealtimeEvent } from './realtime.types';

export interface RealtimeTransport {
  connect(): Observable<ConnectionStatus>;
  events(): Observable<RealtimeEvent>;
  send(command: RealtimeCommand): void;
}

export const REALTIME_TRANSPORT = new InjectionToken<RealtimeTransport>('REALTIME_TRANSPORT');
