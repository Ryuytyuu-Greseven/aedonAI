import { Injectable, inject, signal } from '@angular/core';
import { Observable, tap } from 'rxjs';
import { MetaPage } from '../models/meta-integration.model';
import { ApiService } from '../http/api.service';

/**
 * Wraps the Meta integration HTTP calls and holds the connected-Pages state for
 * this session. `pages()` is `null` when nothing's connected (nothing loaded yet,
 * or every record was just wiped by `disconnectAll()`) and an array once there's
 * at least one Page. Per-Page disable/enable (`disablePage`/`enablePage`) is a
 * soft toggle — the row stays; `disconnectAll()` is confirmed to actually delete
 * every record in the DB, so the frontend mirrors that by clearing `pages()`
 * entirely rather than marking rows disabled.
 */
@Injectable({ providedIn: 'root' })
export class MetaIntegrationService {
  private readonly api = inject(ApiService);

  readonly pages = signal<MetaPage[] | null>(null);

  private replacePage(updated: MetaPage): void {
    this.pages.update((list) => list?.map((p) => (p.id === updated.id ? updated : p)) ?? [updated]);
  }

  /** `code` only — the real backend's `/connect` contract takes no `redirectUri`. */
  connect(code: string): Observable<MetaPage[]> {
    return this.api.connectMeta(code).pipe(tap((pages) => this.pages.set(pages)));
  }

  /** `GET /pages` — local read, safe to call on every load to restore connection state after a refresh. */
  loadPages(): Observable<MetaPage[]> {
    return this.api.getMetaPages().pipe(tap((pages) => this.pages.set(pages.length > 0 ? pages : null)));
  }

  /** Soft-disconnects one Page — the row, its agent link, and token all stay intact. */
  disablePage(pageId: string): Observable<MetaPage> {
    return this.api.disableMetaPage(pageId).pipe(tap((updated) => this.replacePage(updated)));
  }

  enablePage(pageId: string): Observable<MetaPage> {
    return this.api.enableMetaPage(pageId).pipe(tap((updated) => this.replacePage(updated)));
  }

  /**
   * "Disconnect Meta" — deletes every connected Page's record in the DB (confirmed real
   * behavior of `POST /pages/disable-all`, despite its name). On success, clear `pages()`
   * entirely so the UI reverts to "Connect to Meta" rather than showing stale/disabled rows.
   */
  disconnectAll(): Observable<number> {
    return this.api.disableAllMetaPages().pipe(tap(() => this.pages.set(null)));
  }

  /**
   * Links `agentId` to `pageId`. Not exclusive — the real backend allows the same agent to be
   * linked to more than one Page; only a Page's own link is 1:1 (replaced, not stacked).
   */
  assignAgent(pageId: string, agentId: string): Observable<MetaPage> {
    return this.api.assignMetaPageAgent(pageId, agentId).pipe(tap((updated) => this.replacePage(updated)));
  }

  unassignAgent(pageId: string): Observable<MetaPage> {
    return this.api.unassignMetaPageAgent(pageId).pipe(tap((updated) => this.replacePage(updated)));
  }
}
