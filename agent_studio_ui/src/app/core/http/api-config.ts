import { environment } from '../../../environments/environment';

/** Base URL including `/api` prefix (e.g. `http://localhost:2000/api`). */
export const API_BASE = environment.apiUrl;

/**
 * Paths relative to API_BASE that must not receive a Bearer token
 * and must not trigger 401 → logout redirect.
 */
export const PUBLIC_API_PATHS = [
  '/health',
  '/auth/login',
  '/auth/forgot-password',
  '/auth/reset-password',
] as const;

export const ApiEndpoints = {
  health: '/health',

  auth: {
    login: '/auth/login',
    logout: '/auth/logout',
    session: '/auth/session',
    /** Public, see `/reset_pass.md`. */
    forgotPassword: '/auth/forgot-password',
    resetPassword: '/auth/reset-password',
  },

  frontlineAgents: {
    list: '/frontline-agents',
    create: '/frontline-agents',
    disable: (id: string) => `/frontline-agents/${id}/disable`,
    enable: (id: string) => `/frontline-agents/${id}/enable`,
    name: (id: string) => `/frontline-agents/${id}/name`,
    resetPassword: (id: string) => `/frontline-agents/${id}/reset-password`,
  },

  /** Any authenticated role; returns/updates the caller's own user (+ company, nullable, on GET). See `/company_details.md`. */
  usersProfile: {
    get: '/users/profile',
    updateName: '/users/profile/name',
  },

  templates: {
    list: '/templates',
    byId: (id: string) => `/templates/${id}`,
  },

  agents: {
    list: '/agents',
    /** Published snapshots from the live-agents collection (runtime UIs). */
    listLive: '/agents/live',
    byId: (id: string) => `/agents/${id}`,
    clone: (id: string) => `/agents/${id}/clone`,
    preview: (id: string) => `/agents/${id}/preview`,
    stage: (id: string) => `/agents/${id}/stage`,
    live: (id: string) => `/agents/${id}/live`,
    disable: (id: string) => `/agents/${id}/disable`,
    enable: (id: string) => `/agents/${id}/enable`,
    history: (id: string) => `/agents/${id}/history`,
    historyByAgentId: (agentId: string) => `/agents/by-agent-id/${agentId}/history`,
    /** Real, thin shape — no qualification/intent/follow-up/call linkage. See backend-openspec/specs/leads/spec.md. */
    leads: (id: string) => `/agents/${id}/leads`,
    /** Manual leads: POST a reviewed sheet; list with `GET leads?source=manual`. */
    manualLeads: (id: string) => `/agents/${id}/leads/manual`,
    manualLeadDial: (id: string) => `/agents/${id}/leads/manual/dial`,
    manualLeadCall: (id: string, leadId: string) => `/agents/${id}/leads/manual/${encodeURIComponent(leadId)}/call`,
    /** Per-product enquiry stats for sales agents — see agent_studio_server change add-product-enquiry-stats. */
    productStats: (id: string) => `/agents/${id}/product-stats`,
  },

  calls: {
    list: (agentId: string) => `/agents/${agentId}/calls`,
    detail: (agentId: string, callId: string) => `/agents/${agentId}/calls/${encodeURIComponent(callId)}`,
    stats: (agentId: string) => `/agents/${agentId}/calls/stats`,
    active: (agentId: string) => `/agents/${agentId}/calls/active`,
  },

  reports: {
    generate: (agentId: string) => `/agents/${agentId}/reports/generate`,
    download: (agentId: string, reportId: string) =>
      `/agents/${agentId}/reports/${reportId}/download`,
    frequency: (agentId: string) => `/agents/${agentId}/report-frequency`,
    sendEmail: '/reports/send-email',
    sendWhatsApp: '/reports/send-whatsapp',
  },

  phoneNumbers: {
    list: '/phone-numbers',
    available: '/phone-numbers/available',
    purchase: '/phone-numbers/purchase',
    reconcile: '/phone-numbers/reconcile',
    byId: (id: string) => `/phone-numbers/${id}`,
    assignAgent: (id: string) => `/phone-numbers/${id}/assign-agent`,
    disable: (id: string) => `/phone-numbers/${id}/disable`,
    enable: (id: string) => `/phone-numbers/${id}/enable`,
  },

  previews: {
    twilioCall: `/preview/call`,
  },

  /**
   * Meta (Facebook) Pages OAuth integration — real, confirmed contract.
   * See backend-openspec/specs/meta-integration/spec.md.
   */
  metaIntegration: {
    connect: '/integrations/meta/connect',
    pages: '/integrations/meta/pages',
    disablePage: (pageId: string) => `/integrations/meta/pages/${pageId}/disable`,
    enablePage: (pageId: string) => `/integrations/meta/pages/${pageId}/enable`,
    disableAllPages: '/integrations/meta/pages/disable-all',
    enableAllPages: '/integrations/meta/pages/enable-all',
    assignAgent: (pageId: string) => `/integrations/meta/pages/${pageId}/assign-agent`,
    unassignAgent: (pageId: string) => `/integrations/meta/pages/${pageId}/unassign-agent`,
    /** Company-wide Meta `leadgen` leads across all connected Pages — see backend-openspec/specs/leads.md. */
    leads: '/integrations/meta/leads',
    callLead: (leadgenId: string) => `/integrations/meta/leads/${encodeURIComponent(leadgenId)}/call`,
  },

  knowledgeBases: {
    list: '/knowledge-bases',
    byId: (id: string) => `/knowledge-bases/${id}`,
    disable: (id: string) => `/knowledge-bases/${id}/disable`,
    enable: (id: string) => `/knowledge-bases/${id}/enable`,
    files: (id: string) => `/knowledge-bases/${id}/files`,
    urls: (id: string) => `/knowledge-bases/${id}/urls`,
    disableFile: (id: string, fileId: string) => `/knowledge-bases/${id}/files/${fileId}/disable`,
    enableFile: (id: string, fileId: string) => `/knowledge-bases/${id}/files/${fileId}/enable`,
    disableUrl: (id: string, urlId: string) => `/knowledge-bases/${id}/urls/${urlId}/disable`,
    enableUrl: (id: string, urlId: string) => `/knowledge-bases/${id}/urls/${urlId}/enable`,
  },

  /** Real Estate Sales agent property listings — see backend-openspec/specs/sales-properties/spec.md. */
  salesProperties: {
    list: '/sales/properties',
    byId: (id: string) => `/sales/properties/${id}`,
  },
} as const;

/** True when `url` is an API request that should skip auth token / 401 logout. */
export function isPublicApiUrl(url: string): boolean {
  if (!url.startsWith(API_BASE)) {
    return false;
  }
  const path = url.slice(API_BASE.length).split('?')[0];
  return (PUBLIC_API_PATHS as readonly string[]).includes(path);
}
