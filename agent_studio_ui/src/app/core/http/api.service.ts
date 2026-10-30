import { Injectable } from '@angular/core';
import { Observable, map } from 'rxjs';
import { Agent } from '../models/agent.model';
import { AgentTemplate } from '../models/agent-template.model';
import { AgentCallStats, CallDetail, CallRecord } from '../models/call-record.model';
import { AuthSession, ForgotPasswordRequest, LoginCredentials, MessageResponse, ResetPasswordRequest } from '../models/auth.model';
import { CreateSalesAgentAccountInput, SalesAgentAccount } from '../models/sales-agent-account.model';
import { KnowledgeBase, NewKnowledgeBaseFileInput } from '../models/knowledge-base.model';
import {
  AvailablePhoneNumbersResult,
  PhoneNumber,
  ReconcileProvisioningResult,
  SearchAvailableNumbersQuery,
} from '../models/phone-number.model';
import { ApiUser, UserProfileResponse } from '../models/profile.model';
import { MetaPage } from '../models/meta-integration.model';
import { AgentLead, LeadsPage, LeadsQuery, PageLead, PageLeadCallResult } from '../models/lead.model';
import { CreatePropertyInput, Property, UpdatePropertyInput } from '../models/property.model';
import { ProductStatsPage, ProductStatsQuery } from '../models/product-stats.model';
import { ApiEndpoints } from './api-config';
import { ApiProperty, fromApiProperty, toCreatePropertyRequest, toUpdatePropertyRequest } from './property-mapper';
import { ApiProductStatsResponse, fromApiProductStatsResponse } from './product-stats-mapper';
import {
  ApiConnectedPageResponse,
  ApiGetPagesResponse,
  ApiMetaConnectResponse,
  fromApiConnectedPage,
  fromApiMetaPage,
} from './meta-integration-mapper';
import {
  ApiAgentLead,
  ApiLeadsResponse,
  ApiMetaLead,
  fromApiAgentLeadsResponse,
  fromApiMetaLeadsResponse,
} from './lead-mapper';
import { ApiCallDetail, ApiCallRecord, fromApiCallDetail, fromApiCallRecord } from './call-record-mapper';
import {
  fromApiAgent,
  fromApiAgentHistory,
  fromApiLiveAgent,
  toCreateAgentRequest,
  toUpdateAgentRequest,
} from './agent-mapper';
import {
  AddKnowledgeBaseUrlsRequest,
  ApiKnowledgeBase,
  CreateKnowledgeBaseRequest,
  fromApiKnowledgeBase,
  toAddKnowledgeBaseFilesFormData,
} from './knowledge-base-mapper';
import {
  ApiAvailablePhoneNumbersResponse,
  ApiPhoneNumber,
  AssignAgentRequest,
  PurchasePhoneNumberRequest,
  fromApiAvailablePhoneNumbers,
  fromApiPhoneNumber,
} from './phone-number-mapper';
import { ApiFrontlineAgent, fromApiFrontlineAgent } from './frontline-agent-mapper';
import { HttpService } from './http.service';
import {
  ApiAgent,
  ApiAgentHistory,
  ApiLiveAgent,
  CreateAgentRequest,
  GenerateReportRequest,
  GenerateReportResponse,
  GoLiveRequest,
  HealthResponse,
  PreviewAgentResponse,
  ReportFrequency,
  ReportFrequencyResponse,
  SendReportEmailRequest,
  SendReportWhatsAppRequest,
  SessionResponse,
  TwilioCallRequest,
  UpdateAgentRequest,
} from './api.types';
import { AgentVersion } from '../models/agent.model';

@Injectable({ providedIn: 'root' })
export class ApiService {
  constructor(private readonly http: HttpService) {}

  // ── Health ──────────────────────────────────────────────

  health(): Observable<HealthResponse> {
    return this.http.get<HealthResponse>(ApiEndpoints.health);
  }

  // ── Auth ────────────────────────────────────────────────

  login(credentials: LoginCredentials): Observable<AuthSession> {
    return this.http.post<AuthSession>(ApiEndpoints.auth.login, credentials);
  }

  logout(): Observable<void> {
    return this.http.post<void>(ApiEndpoints.auth.logout, {});
  }

  getSession(): Observable<SessionResponse> {
    return this.http.get<SessionResponse>(ApiEndpoints.auth.session);
  }

  /** Public — emails a reset link to `email` if an account exists. */
  forgotPassword(body: ForgotPasswordRequest): Observable<MessageResponse> {
    return this.http.post<MessageResponse>(ApiEndpoints.auth.forgotPassword, body);
  }

  /** Public — sets a new password using the token from the reset email link. */
  resetPassword(body: ResetPasswordRequest): Observable<MessageResponse> {
    return this.http.post<MessageResponse>(ApiEndpoints.auth.resetPassword, body);
  }

  // ── Profile (real backend, see /company_details.md) ──────

  /** `GET /api/users/profile` — any role, returns the caller's own user + company (nullable). */
  getUserProfile(): Observable<UserProfileResponse> {
    return this.http.get<UserProfileResponse>(ApiEndpoints.usersProfile.get);
  }

  /** `PATCH /api/users/profile/name` — self-service only, always targets the caller. */
  updateProfileName(name: string): Observable<ApiUser> {
    return this.http.patch<ApiUser>(ApiEndpoints.usersProfile.updateName, { name });
  }

  // ── Frontline agents (admin-only) ────────────────────────

  createSalesAgent(input: CreateSalesAgentAccountInput): Observable<SalesAgentAccount> {
    return this.http
      .post<ApiFrontlineAgent>(ApiEndpoints.frontlineAgents.create, input)
      .pipe(map(fromApiFrontlineAgent));
  }

  listSalesAgents(): Observable<SalesAgentAccount[]> {
    return this.http
      .get<ApiFrontlineAgent[]>(ApiEndpoints.frontlineAgents.list)
      .pipe(map((list) => list.map(fromApiFrontlineAgent)));
  }

  setSalesAgentEnabled(id: string, enabled: boolean): Observable<SalesAgentAccount> {
    const path = enabled ? ApiEndpoints.frontlineAgents.enable(id) : ApiEndpoints.frontlineAgents.disable(id);
    return this.http.post<ApiFrontlineAgent>(path, null).pipe(map(fromApiFrontlineAgent));
  }

  updateSalesAgentName(id: string, name: string): Observable<SalesAgentAccount> {
    return this.http
      .patch<ApiFrontlineAgent>(ApiEndpoints.frontlineAgents.name(id), { name })
      .pipe(map(fromApiFrontlineAgent));
  }

  /** Backend returns 204 with no body. */
  resetSalesAgentPassword(id: string, newPassword: string): Observable<void> {
    return this.http.post<void>(ApiEndpoints.frontlineAgents.resetPassword(id), { newPassword });
  }

  // ── Meta integration (admin-only) ────────────────────────

  /** Body is `{ code }` only, no `redirectUri`. */
  connectMeta(code: string): Observable<MetaPage[]> {
    return this.http
      .post<ApiMetaConnectResponse>(ApiEndpoints.metaIntegration.connect, { code })
      .pipe(map((res) => res.pages.map(fromApiMetaPage)));
  }

  /** Local read (no `meta-adapter` round-trip) — safe to call on every load to restore connection state. */
  getMetaPages(): Observable<MetaPage[]> {
    return this.http
      .get<ApiGetPagesResponse>(ApiEndpoints.metaIntegration.pages)
      .pipe(map((res) => res.pages.map(fromApiConnectedPage)));
  }

  /** Soft-disconnect. Row, agent link, and token are kept — re-enabling needs no new OAuth flow. */
  disableMetaPage(pageId: string): Observable<MetaPage> {
    return this.http
      .post<ApiConnectedPageResponse>(ApiEndpoints.metaIntegration.disablePage(pageId), null)
      .pipe(map((res) => fromApiConnectedPage(res.page)));
  }

  enableMetaPage(pageId: string): Observable<MetaPage> {
    return this.http
      .post<ApiConnectedPageResponse>(ApiEndpoints.metaIntegration.enablePage(pageId), null)
      .pipe(map((res) => fromApiConnectedPage(res.page)));
  }

  /**
   * "Disconnect Meta". Despite the path name, confirmed to actually delete every connected
   * Page's record for the caller's company, not just flip `isActive`. Idempotent —
   * `updatedCount: 0` if nothing was connected.
   */
  disableAllMetaPages(): Observable<number> {
    return this.http
      .post<{ success: boolean; updatedCount: number }>(ApiEndpoints.metaIntegration.disableAllPages, null)
      .pipe(map((res) => res.updatedCount));
  }

  enableAllMetaPages(): Observable<number> {
    return this.http
      .post<{ success: boolean; updatedCount: number }>(ApiEndpoints.metaIntegration.enableAllPages, null)
      .pipe(map((res) => res.updatedCount));
  }

  /** Replaces (doesn't stack) any prior link for this Page. The same agent may be linked to more than one Page. */
  assignMetaPageAgent(pageId: string, agentId: string): Observable<MetaPage> {
    return this.http
      .patch<ApiConnectedPageResponse>(ApiEndpoints.metaIntegration.assignAgent(pageId), { agentId })
      .pipe(map((res) => fromApiConnectedPage(res.page)));
  }

  unassignMetaPageAgent(pageId: string): Observable<MetaPage> {
    return this.http
      .post<ApiConnectedPageResponse>(ApiEndpoints.metaIntegration.unassignAgent(pageId), null)
      .pipe(map((res) => fromApiConnectedPage(res.page)));
  }

  /** `agentId` is mandatory — scopes results to the leads for that agent's linked Page. */
  getMetaLeads(agentId: string, query: LeadsQuery = {}): Observable<LeadsPage<PageLead>> {
    const params: Record<string, string | number> = { agentId };
    if (query.page !== undefined) params['page'] = query.page;
    if (query.limit !== undefined) params['limit'] = query.limit;
    if (query.search) params['search'] = query.search;
    if (query.fromDate) params['fromDate'] = query.fromDate;
    if (query.toDate) params['toDate'] = query.toDate;

    return this.http
      .get<ApiLeadsResponse<ApiMetaLead>>(ApiEndpoints.metaIntegration.leads, { params })
      .pipe(map(fromApiMetaLeadsResponse));
  }

  /** Places a real outbound call to one Meta lead with its Page's linked agent (any age, any prior attempts). */
  callMetaLead(leadgenId: string): Observable<PageLeadCallResult> {
    return this.http.post<PageLeadCallResult>(ApiEndpoints.metaIntegration.callLead(leadgenId), null);
  }

  getAgentLeads(agentId: string, query: LeadsQuery = {}): Observable<LeadsPage<AgentLead>> {
    const params: Record<string, string | number> = {};
    if (query.page !== undefined) params['page'] = query.page;
    if (query.limit !== undefined) params['limit'] = query.limit;
    if (query.search) params['search'] = query.search;
    if (query.fromDate) params['fromDate'] = query.fromDate;
    if (query.toDate) params['toDate'] = query.toDate;

    return this.http
      .get<ApiLeadsResponse<ApiAgentLead>>(ApiEndpoints.agents.leads(agentId), { params })
      .pipe(map(fromApiAgentLeadsResponse));
  }

  getProductStats(agentId: string, query: ProductStatsQuery = {}): Observable<ProductStatsPage> {
    const params: Record<string, string | number> = {};
    if (query.page !== undefined) params['page'] = query.page;
    if (query.limit !== undefined) params['limit'] = query.limit;
    if (query.search) params['search'] = query.search;
    if (query.fromDate) params['fromDate'] = query.fromDate;
    if (query.toDate) params['toDate'] = query.toDate;
    if (query.sort) params['sort'] = query.sort;
    if (query.order) params['order'] = query.order;

    return this.http
      .get<ApiProductStatsResponse>(ApiEndpoints.agents.productStats(agentId), { params })
      .pipe(map(fromApiProductStatsResponse));
  }

  // ── Sales properties (Real Estate Sales agents only) ─────

  createProperty(agentId: string, input: CreatePropertyInput): Observable<Property> {
    return this.http
      .post<ApiProperty>(ApiEndpoints.salesProperties.list, toCreatePropertyRequest(agentId, input))
      .pipe(map(fromApiProperty));
  }

  getProperties(agentId: string): Observable<Property[]> {
    return this.http
      .get<ApiProperty[]>(ApiEndpoints.salesProperties.list, { params: { agentId } })
      .pipe(map((list) => list.map(fromApiProperty)));
  }

  getProperty(id: string): Observable<Property> {
    return this.http.get<ApiProperty>(ApiEndpoints.salesProperties.byId(id)).pipe(map(fromApiProperty));
  }

  updateProperty(id: string, input: UpdatePropertyInput): Observable<Property> {
    return this.http
      .patch<ApiProperty>(ApiEndpoints.salesProperties.byId(id), toUpdatePropertyRequest(input))
      .pipe(map(fromApiProperty));
  }

  /** Backend returns 204 with no body. */
  deleteProperty(id: string): Observable<void> {
    return this.http.delete<void>(ApiEndpoints.salesProperties.byId(id));
  }

  // ── Templates ───────────────────────────────────────────

  getAllTemplates(): Observable<AgentTemplate[]> {
    return this.http.get<AgentTemplate[]>(ApiEndpoints.templates.list);
  }

  getTemplate(id: string): Observable<AgentTemplate> {
    return this.http.get<AgentTemplate>(ApiEndpoints.templates.byId(id));
  }

  // ── Agents ──────────────────────────────────────────────

  getAllAgents(): Observable<Agent[]> {
    return this.http.get<ApiAgent[]>(ApiEndpoints.agents.list).pipe(map((list) => list.map(fromApiAgent)));
  }

  /** Published live-agent snapshots (runtime UIs). Newest `published_at` first. */
  getLiveAgents(): Observable<Agent[]> {
    return this.http
      .get<ApiLiveAgent[]>(ApiEndpoints.agents.listLive)
      .pipe(map((list) => list.map(fromApiLiveAgent)));
  }

  getAgent(id: string): Observable<Agent> {
    return this.http.get<ApiAgent>(ApiEndpoints.agents.byId(id)).pipe(map(fromApiAgent));
  }

  createNewAgent(draft: Partial<Agent> & { country_code?: string; phone_number?: string }): Observable<Agent> {
    const body: CreateAgentRequest = toCreateAgentRequest(draft);
    return this.http.post<ApiAgent>(ApiEndpoints.agents.list, body).pipe(map(fromApiAgent));
  }

  /** Alias used by Save / draft flows. */
  createAgent(draft: Partial<Agent> & { country_code?: string; phone_number?: string }): Observable<Agent> {
    return this.createNewAgent(draft);
  }

  draftAgent(draft: Partial<Agent> & { country_code?: string; phone_number?: string }): Observable<Agent> {
    return this.createNewAgent({ ...draft, status: 'draft' });
  }

  updateAgent(
    id: string,
    data: Partial<Agent> & { country_code?: string; phone_number?: string; agent_id?: string },
    businessAgentId?: string,
  ): Observable<Agent> {
    const agentId = businessAgentId ?? data.agent_id;
    if (!agentId) {
      throw new Error('agent_id is required for PATCH /agents/:id');
    }
    const body: UpdateAgentRequest = toUpdateAgentRequest(agentId, data);
    return this.http.patch<ApiAgent>(ApiEndpoints.agents.byId(id), body).pipe(map(fromApiAgent));
  }

  deleteAgent(id: string): Observable<void> {
    return this.http.delete<void>(ApiEndpoints.agents.byId(id));
  }

  cloneAgent(id: string): Observable<Agent> {
    return this.http.post<ApiAgent>(ApiEndpoints.agents.clone(id), null).pipe(map(fromApiAgent));
  }

  previewAgent(id: string): Observable<PreviewAgentResponse> {
    return this.http.post<PreviewAgentResponse>(ApiEndpoints.agents.preview(id), null);
  }

  /** Places a real outbound call to a customer via Twilio, routed through the audio_processor. */
  startTwilioCall(payload: TwilioCallRequest): Observable<unknown> {
    return this.http.post<unknown>(ApiEndpoints.previews.twilioCall, payload);
  }

  /** `draft` → `staged`. */
  stageAgent(id: string): Observable<Agent> {
    return this.http.post<ApiAgent>(ApiEndpoints.agents.stage(id), null).pipe(map(fromApiAgent));
  }

  /**
   * `staged` → `live` (requires a fresh preview hash server-side). `phoneNumberId` is the
   * production number for the live-agents clone — distinct from the staging number.
   */
  liveAgent(id: string, phoneNumberId: string): Observable<Agent> {
    const body: GoLiveRequest = { phone_number_id: phoneNumberId };
    return this.http.post<ApiAgent>(ApiEndpoints.agents.live(id), body).pipe(map(fromApiAgent));
  }

  /** `live` → `disabled`. */
  disableAgent(id: string): Observable<Agent> {
    return this.http.post<ApiAgent>(ApiEndpoints.agents.disable(id), null).pipe(map(fromApiAgent));
  }

  /** `disabled` → `live`. */
  enableAgent(id: string): Observable<Agent> {
    return this.http.post<ApiAgent>(ApiEndpoints.agents.enable(id), null).pipe(map(fromApiAgent));
  }

  /** Archived stage/live versions for an agent, newest first. */
  getAgentHistory(id: string): Observable<AgentVersion[]> {
    return this.http
      .get<ApiAgentHistory[]>(ApiEndpoints.agents.history(id))
      .pipe(map((list) => list.map(fromApiAgentHistory)));
  }

  // ── Monitoring ──────────────────────────────────────────

  getCallRecords(agentId: string): Observable<CallRecord[]> {
    return this.http
      .get<ApiCallRecord[]>(ApiEndpoints.calls.list(agentId))
      .pipe(map((records) => records.map(fromApiCallRecord)));
  }

  getCallDetail(agentId: string, callId: string): Observable<CallDetail> {
    return this.http
      .get<ApiCallDetail>(ApiEndpoints.calls.detail(agentId, callId))
      .pipe(map(fromApiCallDetail));
  }

  getCallStats(agentId: string): Observable<AgentCallStats> {
    return this.http.get<AgentCallStats>(ApiEndpoints.calls.stats(agentId));
  }

  /** Calls currently in progress for this agent (stale ones are filtered server-side). */
  getActiveCalls(agentId: string): Observable<ApiCallRecord[]> {
    return this.http.get<ApiCallRecord[]>(ApiEndpoints.calls.active(agentId));
  }

  // ── Reporting ───────────────────────────────────────────

  generateReport(agentId: string, body: GenerateReportRequest): Observable<GenerateReportResponse> {
    return this.http.post<GenerateReportResponse>(ApiEndpoints.reports.generate(agentId), body);
  }

  downloadReport(agentId: string, reportId: string): Observable<Blob> {
    return this.http.getBlob(ApiEndpoints.reports.download(agentId, reportId));
  }

  getReportFrequency(agentId: string): Observable<ReportFrequency | null> {
    return this.http
      .get<ReportFrequencyResponse>(ApiEndpoints.reports.frequency(agentId))
      .pipe(map((res) => res.frequency));
  }

  setReportFrequency(agentId: string, frequency: ReportFrequency): Observable<void> {
    return this.http.put<void>(ApiEndpoints.reports.frequency(agentId), { frequency });
  }

  sendReportEmail(body: SendReportEmailRequest): Observable<void> {
    return this.http.post<void>(ApiEndpoints.reports.sendEmail, body);
  }

  sendReportWhatsApp(body: SendReportWhatsAppRequest): Observable<void> {
    return this.http.post<void>(ApiEndpoints.reports.sendWhatsApp, body);
  }

  // ── Phone numbers ───────────────────────────────────────

  getPhoneNumbers(): Observable<PhoneNumber[]> {
    return this.http
      .get<ApiPhoneNumber[]>(ApiEndpoints.phoneNumbers.list)
      .pipe(map((list) => list.map(fromApiPhoneNumber)));
  }

  getPhoneNumber(id: string): Observable<PhoneNumber> {
    return this.http
      .get<ApiPhoneNumber>(ApiEndpoints.phoneNumbers.byId(id))
      .pipe(map(fromApiPhoneNumber));
  }

  /** Live Twilio (US) / Exotel (IN) inventory search — admin only. */
  searchAvailablePhoneNumbers(query: SearchAvailableNumbersQuery): Observable<AvailablePhoneNumbersResult> {
    const params: Record<string, string | number> = {};
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined && value !== null && value !== '') params[key] = value;
    }
    return this.http
      .get<ApiAvailablePhoneNumbersResponse>(ApiEndpoints.phoneNumbers.available, { params })
      .pipe(map(fromApiAvailablePhoneNumbers));
  }

  /** Buys the number from its provider (billed) — admin only. */
  purchasePhoneNumber(body: PurchasePhoneNumberRequest): Observable<PhoneNumber> {
    return this.http
      .post<ApiPhoneNumber>(ApiEndpoints.phoneNumbers.purchase, body)
      .pipe(map(fromApiPhoneNumber));
  }

  /** Settles purchases stuck in Provisioning against the provider account — admin only. */
  reconcilePhoneNumbers(): Observable<ReconcileProvisioningResult> {
    return this.http.post<ReconcileProvisioningResult>(ApiEndpoints.phoneNumbers.reconcile, null);
  }

  /** Releases the number back to its provider (stops billing) — admin only. */
  releasePhoneNumber(id: string): Observable<PhoneNumber> {
    return this.http
      .delete<ApiPhoneNumber>(ApiEndpoints.phoneNumbers.byId(id))
      .pipe(map(fromApiPhoneNumber));
  }

  assignPhoneNumberAgent(id: string, assignedAgent: string | null): Observable<PhoneNumber> {
    const body: AssignAgentRequest = { assigned_agent: assignedAgent };
    return this.http
      .patch<ApiPhoneNumber>(ApiEndpoints.phoneNumbers.assignAgent(id), body)
      .pipe(map(fromApiPhoneNumber));
  }

  disablePhoneNumber(id: string): Observable<PhoneNumber> {
    return this.http
      .post<ApiPhoneNumber>(ApiEndpoints.phoneNumbers.disable(id), null)
      .pipe(map(fromApiPhoneNumber));
  }

  enablePhoneNumber(id: string): Observable<PhoneNumber> {
    return this.http
      .post<ApiPhoneNumber>(ApiEndpoints.phoneNumbers.enable(id), null)
      .pipe(map(fromApiPhoneNumber));
  }

  // ── Knowledge bases ─────────────────────────────────────

  getKnowledgeBases(): Observable<KnowledgeBase[]> {
    return this.http
      .get<ApiKnowledgeBase[]>(ApiEndpoints.knowledgeBases.list)
      .pipe(map((list) => list.map(fromApiKnowledgeBase)));
  }

  getKnowledgeBase(id: string): Observable<KnowledgeBase> {
    return this.http
      .get<ApiKnowledgeBase>(ApiEndpoints.knowledgeBases.byId(id))
      .pipe(map(fromApiKnowledgeBase));
  }

  createKnowledgeBase(body: CreateKnowledgeBaseRequest): Observable<KnowledgeBase> {
    return this.http
      .post<ApiKnowledgeBase>(ApiEndpoints.knowledgeBases.list, body)
      .pipe(map(fromApiKnowledgeBase));
  }

  disableKnowledgeBase(id: string): Observable<KnowledgeBase> {
    return this.http
      .post<ApiKnowledgeBase>(ApiEndpoints.knowledgeBases.disable(id), null)
      .pipe(map(fromApiKnowledgeBase));
  }

  enableKnowledgeBase(id: string): Observable<KnowledgeBase> {
    return this.http
      .post<ApiKnowledgeBase>(ApiEndpoints.knowledgeBases.enable(id), null)
      .pipe(map(fromApiKnowledgeBase));
  }

  /** `multipart/form-data` — actual file bytes, not metadata. */
  addKnowledgeBaseFiles(id: string, files: NewKnowledgeBaseFileInput[]): Observable<KnowledgeBase> {
    return this.http
      .post<ApiKnowledgeBase>(ApiEndpoints.knowledgeBases.files(id), toAddKnowledgeBaseFilesFormData(files))
      .pipe(map(fromApiKnowledgeBase));
  }

  addKnowledgeBaseUrls(id: string, body: AddKnowledgeBaseUrlsRequest): Observable<KnowledgeBase> {
    return this.http
      .post<ApiKnowledgeBase>(ApiEndpoints.knowledgeBases.urls(id), body)
      .pipe(map(fromApiKnowledgeBase));
  }

  disableKnowledgeBaseFile(id: string, fileId: string): Observable<KnowledgeBase> {
    return this.http
      .post<ApiKnowledgeBase>(ApiEndpoints.knowledgeBases.disableFile(id, fileId), null)
      .pipe(map(fromApiKnowledgeBase));
  }

  enableKnowledgeBaseFile(id: string, fileId: string): Observable<KnowledgeBase> {
    return this.http
      .post<ApiKnowledgeBase>(ApiEndpoints.knowledgeBases.enableFile(id, fileId), null)
      .pipe(map(fromApiKnowledgeBase));
  }

  disableKnowledgeBaseUrl(id: string, urlId: string): Observable<KnowledgeBase> {
    return this.http
      .post<ApiKnowledgeBase>(ApiEndpoints.knowledgeBases.disableUrl(id, urlId), null)
      .pipe(map(fromApiKnowledgeBase));
  }

  enableKnowledgeBaseUrl(id: string, urlId: string): Observable<KnowledgeBase> {
    return this.http
      .post<ApiKnowledgeBase>(ApiEndpoints.knowledgeBases.enableUrl(id, urlId), null)
      .pipe(map(fromApiKnowledgeBase));
  }
}
