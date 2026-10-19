import { MetaPage } from '../models/meta-integration.model';

/** Wire shape of one entry in `POST /api/integrations/meta/connect`'s `pages` array. */
export interface ApiMetaPage {
  id: string;
  name: string;
}

/** Response of `POST /api/integrations/meta/connect`. */
export interface ApiMetaConnectResponse {
  success: boolean;
  pages: ApiMetaPage[];
}

/** Wire shape of a connected Page as returned by `GET /pages` and every disable/enable/assign/unassign endpoint. */
export interface ApiConnectedPage {
  pageId: string;
  pageName: string;
  isActive: boolean;
  agentId: string | null;
  connectedAt: string;
}

/** Response of `GET /api/integrations/meta/pages`. */
export interface ApiGetPagesResponse {
  pages: ApiConnectedPage[];
}

/** Response of every single-Page mutation (disable/enable/assign-agent/unassign-agent). */
export interface ApiConnectedPageResponse {
  page: ApiConnectedPage;
}

/** `connect` freshly-connected Pages have no `isActive`/`agentId`/`connectedAt` yet — a 200 means they're all active and unassigned. */
export function fromApiMetaPage(raw: ApiMetaPage): MetaPage {
  return {
    id: raw.id,
    name: raw.name,
    enabled: true,
    linkedAgentId: null,
  };
}

export function fromApiConnectedPage(raw: ApiConnectedPage): MetaPage {
  return {
    id: raw.pageId,
    name: raw.pageName,
    enabled: raw.isActive,
    linkedAgentId: raw.agentId,
  };
}
