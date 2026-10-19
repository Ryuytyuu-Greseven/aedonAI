import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { shareReplay } from 'rxjs/operators';
import { REALTIME_TRANSPORT } from './realtime-transport';
import { ConnectionStatus, RealtimeCommand, RealtimeEvent } from './realtime.types';

@Injectable({ providedIn: 'root' })
export class RealtimeService {
  private readonly transport = inject(REALTIME_TRANSPORT);
  private connected = false;

  readonly events$: Observable<RealtimeEvent> = this.transport.events();
  readonly connectionStatus$: Observable<ConnectionStatus> = this.transport
    .connect()
    .pipe(shareReplay({ bufferSize: 1, refCount: false }));

  connect(): void {
    if (this.connected) return;
    this.connected = true;
    this.connectionStatus$.subscribe();
  }

  send(command: RealtimeCommand): void {
    this.connect();
    this.transport.send(command);
  }
}
