import { Injectable } from '@angular/core';
import { Observable, delay, of } from 'rxjs';
import { DemoRequest } from './models';

/** Mock submission — there is no backend yet, so this resolves after a short delay. */
@Injectable({ providedIn: 'root' })
export class DemoRequestService {
  submit(request: DemoRequest): Observable<{ reference: string }> {
    const reference = `AED-${Date.now().toString(36).toUpperCase().slice(-6)}`;
    console.info('[DemoRequestService] mock submit', request);
    return of({ reference }).pipe(delay(1200));
  }
}
