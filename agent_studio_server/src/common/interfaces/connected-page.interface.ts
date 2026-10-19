/** Public shape of a connected Meta Page returned by our own APIs (never includes accessToken). */
export interface ConnectedPageSummary {
  pageId: string;
  pageName: string | null;
  isActive: boolean;
  agentId: string | null;
  connectedAt: Date | null;
}
