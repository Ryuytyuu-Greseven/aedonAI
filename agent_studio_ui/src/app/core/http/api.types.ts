import { Agent, CallSettings, Currency, ReferralBonus } from '../models/agent.model';
import { AgentTemplate } from '../models/agent-template.model';
import { AgentCallStats, CallRecord } from '../models/call-record.model';
import { ReportFrequency, ReportPeriod } from '../models/report.model';
import { AuthSession, LoginCredentials, UserRole } from '../models/auth.model';

export type { AuthSession, LoginCredentials, AgentTemplate, AgentCallStats, CallRecord };
export type { ReportFrequency, ReportPeriod };

export interface HealthResponse {
  status: string;
  timestamp: string;
}

export interface SessionResponse {
  email: string;
  name: string;
  role: UserRole;
}

/** Wire shape for agent MCP servers (create/PATCH / agents response). */
export interface ApiMcpServer {
  server_name: string;
  url: string;
  api_key: string;
}

/** Body for `POST /agents` per API.md. */
export interface CreateAgentRequest {
  agent_name: string;
  country_code: string;
  base_template_id: string;
  enable_voice?: boolean;
  phone_number?: string;
  status?: 'draft';
  language?: string;
  voice?: string | null;
  greeting?: string;
  behavior_prompt?: string;
  behavior_notes?: string;
  referral_bonus?: ReferralBonus;
  knowledge_base_ids?: string[];
  mcp_servers?: ApiMcpServer[];
}

/** Body for `PATCH /agents/:id` — `agent_id` is required. */
export interface UpdateAgentRequest {
  agent_id: string;
  agent_name?: string;
  enable_voice?: boolean;
  country_code?: string;
  phone_number?: string;
  status?: Agent['status'];
  base_template_id?: string;
  language?: string;
  voice?: string | null;
  greeting?: string;
  behavior_prompt?: string;
  behavior_notes?: string;
  referral_bonus?: ReferralBonus;
  knowledge_base_ids?: string[];
  mcp_servers?: ApiMcpServer[];
}

/** Raw agent shape returned by the API (may use API field names). */
export interface ApiAgent {
  id: string;
  agent_id?: string;
  agent_name: string;
  enable_voice?: boolean;
  country_code?: string;
  phone_number?: string;
  status: Agent['status'];
  nodes?: Agent['nodes'];
  tools?: Agent['tools'];
  /** API uses `server_name`; may also echo legacy `name`. */
  mcp_servers?: Array<ApiMcpServer | { id?: string; name?: string; server_name?: string; url: string; api_key?: string }>;
  knowledge_base_ids?: string[];
  created_at: string;
  updated_at: string;
  base_template_id?: string;
  greeting?: string;
  /** API field */
  behavior_prompt?: string;
  /** API field */
  behavior_notes?: string;
  /** Legacy / frontend aliases if server echoes them */
  prompt?: string;
  behavior?: string;
  referral_bonus?: ReferralBonus;
  /** Absent on agents saved before call settings existed. */
  call_settings?: Partial<CallSettings> | null;
  preview_hash?: string | null;
  agent_mode?: Agent['agent_mode'];
  language?: string;
  voice?: string | null;
  phone_number_id?: string;
  current_stage_version?: number;
}

export interface PreviewAgentResponse {
  transcript: string;
}

/** Body for `POST {audio_processor}/twilio/call` — places a real outbound call via Twilio. */
export interface TwilioCallRequest {
  agentId: string;
  business?: string;
  countryCode: string;
  phone: string;
}

/** Body for `POST /agents/:id/live` — production number, distinct from the staging `phone_number`. */
export interface GoLiveRequest {
  /** `phone_numbers` id of the production number — the server assigns it to the agent. */
  phone_number_id: string;
}

/**
 * Raw shape returned by `GET /agents/live` (live-agents collection).
 * Distinct from builder `ApiAgent`: `id` is the live row; `source_agent_document_id` is the builder doc.
 */
export interface ApiLiveAgent {
  id: string;
  agent_id: string;
  source_agent_document_id: string;
  agent_name: string;
  country_code?: string;
  phone_number?: string | null;
  enable_voice?: boolean;
  status: 'live';
  nodes?: Agent['nodes'];
  base_template_id?: string;
  greeting?: string;
  behavior_prompt?: string;
  behavior_notes?: string;
  referral_bonus?: ReferralBonus;
  knowledge_base_ids?: string[];
  mcp_servers?: ApiAgent['mcp_servers'];
  stage_version: number;
  published_at: string;
  created_at: string;
  updated_at: string;
}

/** Raw shape returned by `GET /agents/:id/history` and `GET /agents/by-agent-id/:agentId/history`. */
export interface ApiAgentHistory {
  id: string;
  source_agent_id: string;
  source_agent_document_id: string;
  stage_version: number;
  snapshot_status: 'staged' | 'live';
  agent_name: string;
  country_code: string;
  phone_number: string | null;
  enable_voice: boolean;
  nodes?: Agent['nodes'];
  base_template_id?: string;
  greeting?: string;
  behavior_prompt?: string;
  behavior_notes?: string;
  referral_bonus?: ReferralBonus;
  knowledge_base_ids?: string[];
  mcp_servers?: ApiAgent['mcp_servers'];
  staged_at: string | null;
  live_at: string | null;
  archived_at: string;
}

export interface GenerateReportRequest {
  period: ReportPeriod;
  startDate?: string;
  endDate?: string;
}

export interface GenerateReportResponse {
  reportId: string;
  filename: string;
  rows: CallRecord[];
}

export interface ReportFrequencyResponse {
  frequency: ReportFrequency | null;
}

export interface SendReportEmailRequest {
  recipient: string;
  filename: string;
}

export interface SendReportWhatsAppRequest {
  recipient: string;
  filename: string;
}

export type { Currency };
