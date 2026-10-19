export interface MetaPage {
  id: string;
  name: string;
  /**
   * Real, backend-persisted state (`isActive`). Disconnecting is a soft delete — disabling never
   * removes the Page, just excludes it from live use; toggled via `POST .../disable` / `.../enable`.
   */
  enabled: boolean;
  /**
   * Agent this Page is linked to, if any — real, backend-persisted (`agentId`), set via
   * `PATCH .../assign-agent` / `POST .../unassign-agent`. NOT exclusive: the same agent can be
   * linked to more than one Page (only a Page→agent link is 1:1, not the reverse).
   */
  linkedAgentId: string | null;
}
