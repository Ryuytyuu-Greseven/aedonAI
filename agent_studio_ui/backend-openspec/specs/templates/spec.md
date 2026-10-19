# Templates API

## Purpose

The 5 fixed in-house agent templates (Real Estate Sales, Survey, Contact Centre, Alerting, General) that the Playground template picker offers as starting points. Read-only from the frontend's perspective. Backs `src/app/core/services/agent-template.service.ts`.

---

## Data shape

```ts
interface AgentTemplate {
  template_id: string;
  name: string;
  description: string;
  default_greeting: string;
  default_prompt: string;
  default_behavior: string;
  referral_bonus_eligible: boolean;   // true only for Real Estate Sales today
}
```

## GET /api/templates

Backs `AgentTemplateService.getTemplates(): Observable<AgentTemplate[]>`.

**Auth required:** Yes.
**Response 200:** `AgentTemplate[]` — exactly the 5 fixed templates.

## GET /api/templates/:id

Backs `AgentTemplateService.getTemplate(templateId): Observable<AgentTemplate | undefined>`.

**Response 200:** `AgentTemplate`
**Response 404** (frontend currently treats a missing template as "not found," shows a toast, and redirects to `/playground/new` — keep returning a clean 404 rather than a partial/null 200 body)

---

## Open decision: backend-seeded vs. hardcoded

The frontend currently hardcodes these 5 templates in `src/mocks/agent-templates.mock.ts` — literal TypeScript objects, no admin UI, no versioning. This was a reasonable mock-phase shortcut but **is a real decision for the backend, not something to mirror**:

- **Recommended:** seed these 5 rows in the database at deploy/migration time, so copy edits (a better default prompt, a typo fix) don't require a frontend redeploy. This also sets up naturally for a future "more templates" or "custom templates" feature without an API shape change.
- **Alternative:** keep them as a static config/constants file server-side too, if there's a strong reason to avoid a DB round-trip for data that changes rarely. Given there are only 5 rows and they're read on every Playground visit, either is fine performance-wise — this is purely about who owns editing the copy.

Either way, `referral_bonus_eligible` must remain queryable per-template (the `agents` API needs it to validate the `referral_bonus` business rule — see `agents/spec.md`).
