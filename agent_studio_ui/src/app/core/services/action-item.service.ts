import { Injectable, signal } from '@angular/core';
import { delay, Observable, of } from 'rxjs';
import { ActionItem, ActionItemStatus } from '../models/action-item.model';
import { generateActionItemsFor } from '../../../mocks/action-items.mock';

const API_DELAY = 300;

@Injectable({ providedIn: 'root' })
export class ActionItemService {
  /** `setStatus` toggles persist here (keyed by item id) so they survive re-fetching the same agent's tab. */
  private readonly statusOverrides = signal<Record<string, ActionItemStatus>>({});

  getActionItemsForAgent(agentId: string): Observable<ActionItem[]> {
    const overrides = this.statusOverrides();
    const items = generateActionItemsFor(agentId).map((item) =>
      overrides[item.id] ? { ...item, status: overrides[item.id] } : item,
    );
    return of(items).pipe(delay(API_DELAY));
  }

  setStatus(id: string, status: ActionItemStatus): void {
    this.statusOverrides.update((current) => ({ ...current, [id]: status }));
  }
}
