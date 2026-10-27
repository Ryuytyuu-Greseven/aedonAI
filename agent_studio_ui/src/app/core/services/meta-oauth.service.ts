import { Injectable } from '@angular/core';
import { environment } from '../../../environments/environment';

const OAUTH_DIALOG_URL = 'https://www.facebook.com/v21.0/dialog/oauth';
const STATE_STORAGE_KEY = 'meta_oauth_state';
const SCOPES = ['pages_show_list', 'pages_manage_metadata', 'business_management', 'pages_read_engagement', 'leads_retrieval', 'pages_manage_ads'];

/**
 * Builds the Meta OAuth authorize redirect and validates the `state` round-trip
 * (CSRF protection) for the Admin Settings > Meta Integration connect flow.
 */
@Injectable({ providedIn: 'root' })
export class MetaOAuthService {
  /** Callback route Meta redirects back to; must match what's registered in the Meta app dashboard. */
  getRedirectUri(): string {
    return `${window.location.origin}/admin-settings/meta-integration/callback`;
  }

  /** Generates and stores a fresh `state`, returns the full Meta OAuth authorize URL. */
  buildAuthorizeUrl(): string {
    const state = this.generateState();
    sessionStorage.setItem(STATE_STORAGE_KEY, state);

    const params = new URLSearchParams({
      client_id: environment.metaAppId,
      redirect_uri: this.getRedirectUri(),
      scope: SCOPES.join(','),
      response_type: 'code',
      state,
    });
    return `${OAUTH_DIALOG_URL}?${params.toString()}`;
  }

  /** Compares `returnedState` against the stored value and clears it either way. */
  consumeState(returnedState: string | null): boolean {
    const expected = sessionStorage.getItem(STATE_STORAGE_KEY);
    sessionStorage.removeItem(STATE_STORAGE_KEY);
    return !!expected && !!returnedState && returnedState === expected;
  }

  private generateState(): string {
    return crypto.randomUUID();
  }
}
