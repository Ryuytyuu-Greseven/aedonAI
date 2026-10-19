import { Agent, AgentVersion, McpServer, createEmptyAgent } from '../models/agent.model';
import {
  ApiAgent,
  ApiAgentHistory,
  ApiLiveAgent,
  ApiMcpServer,
  CreateAgentRequest,
  UpdateAgentRequest,
} from './api.types';

/** Map API MCP servers into the frontend `McpServer` model (`server_name` → `name`). */
export function fromApiMcpServers(
  raw: ApiAgent['mcp_servers'] | undefined,
): McpServer[] {
  if (!raw?.length) return [];
  return raw.map((item, index) => {
    const serverName =
      ('server_name' in item && item.server_name) ||
      ('name' in item && item.name) ||
      '';
    const id =
      ('id' in item && typeof item.id === 'string' && item.id) ||
      `mcp-${index}-${serverName || 'server'}`;
    return {
      id,
      name: serverName,
      url: item.url ?? '',
      api_key: item.api_key || undefined,
    };
  });
}

/** Map frontend MCP servers to API payload shape. */
export function toApiMcpServers(servers: McpServer[]): ApiMcpServer[] {
  return servers.map((s) => ({
    server_name: s.name,
    url: s.url,
    api_key: s.api_key ?? '',
  }));
}

/** Map API agent JSON into the frontend `Agent` model. */
export function fromApiAgent(raw: ApiAgent): Agent {
  const base = createEmptyAgent(raw.id);
  return {
    ...base,
    id: raw.id,
    agent_id: raw.agent_id,
    agent_name: raw.agent_name,
    agent_mode: raw.agent_mode ?? base.agent_mode,
    language: raw.language,
    enable_voice: raw.enable_voice ?? true,
    phone_number_id: raw.phone_number_id,
    country_code: raw.country_code,
    phone_number: raw.phone_number,
    status: raw.status,
    nodes: raw.nodes ?? [],
    tools: raw.tools ?? [],
    mcp_servers: fromApiMcpServers(raw.mcp_servers),
    knowledge_base_ids: raw.knowledge_base_ids ?? [],
    created_at: raw.created_at,
    updated_at: raw.updated_at,
    base_template_id: raw.base_template_id,
    greeting: raw.greeting,
    prompt: raw.behavior_prompt ?? raw.prompt,
    behavior: raw.behavior_notes ?? raw.behavior,
    referral_bonus: raw.referral_bonus,
    preview_hash: raw.preview_hash ?? undefined,
    current_stage_version: raw.current_stage_version ?? 0,
  };
}

/**
 * Map a live-agents collection row into the frontend `Agent` model.
 * Uses `source_agent_document_id` as `Agent.id` so Monitor / calls / detail routes
 * (which hit `GET /agents/:id` and `/agents/:id/calls*`) keep working against the builder doc.
 */
export function fromApiLiveAgent(raw: ApiLiveAgent): Agent {
  return fromApiAgent({
    id: raw.source_agent_document_id,
    agent_id: raw.agent_id,
    agent_name: raw.agent_name,
    country_code: raw.country_code,
    phone_number: raw.phone_number ?? undefined,
    enable_voice: raw.enable_voice,
    status: 'live',
    nodes: raw.nodes,
    base_template_id: raw.base_template_id,
    greeting: raw.greeting,
    behavior_prompt: raw.behavior_prompt,
    behavior_notes: raw.behavior_notes,
    referral_bonus: raw.referral_bonus,
    knowledge_base_ids: raw.knowledge_base_ids,
    mcp_servers: raw.mcp_servers,
    current_stage_version: raw.stage_version,
    created_at: raw.created_at,
    updated_at: raw.updated_at,
  });
}

/**
 * Map a backend `AgentHistory` row into the frontend's `AgentVersion` shape so the
 * Playground History panel (built against `AgentVersion`) can consume it unchanged.
 * `summary` is left blank here — it depends on the adjacent (chronologically prior)
 * entry, which only the caller holding the full list can determine.
 */
export function fromApiAgentHistory(raw: ApiAgentHistory): AgentVersion {
  const snapshot: Agent = {
    ...createEmptyAgent(raw.source_agent_document_id),
    agent_id: raw.source_agent_id,
    agent_name: raw.agent_name,
    enable_voice: raw.enable_voice,
    country_code: raw.country_code,
    phone_number: raw.phone_number ?? undefined,
    status: raw.snapshot_status,
    nodes: raw.nodes ?? [],
    mcp_servers: fromApiMcpServers(raw.mcp_servers),
    knowledge_base_ids: raw.knowledge_base_ids ?? [],
    created_at: raw.archived_at,
    updated_at: raw.archived_at,
    base_template_id: raw.base_template_id,
    greeting: raw.greeting,
    prompt: raw.behavior_prompt,
    behavior: raw.behavior_notes,
    referral_bonus: raw.referral_bonus,
  };

  return {
    id: raw.id,
    agentId: raw.source_agent_document_id,
    versionNumber: raw.stage_version,
    timestamp: raw.archived_at,
    snapshot,
    label: raw.snapshot_status === 'live' ? 'Went live' : 'Staged',
    summary: '',
  };
}

/** Build create body from a partial frontend agent (+ required API fields). */
export function toCreateAgentRequest(
  draft: Partial<Agent> & { country_code?: string; phone_number?: string },
): CreateAgentRequest {
  const countryCode = draft.country_code ?? '+91';
  const baseTemplateId = draft.base_template_id;
  if (!baseTemplateId) {
    throw new Error('base_template_id is required to create an agent');
  }

  const body: CreateAgentRequest = {
    agent_name: draft.agent_name?.trim() || 'Untitled Agent',
    country_code: countryCode,
    base_template_id: baseTemplateId,
    enable_voice: draft.enable_voice ?? true,
    status: 'draft',
  };

  if (draft.phone_number) {
    body.phone_number = draft.phone_number;
  }
  if (draft.language !== undefined) {
    body.language = draft.language;
  }
  if (draft.greeting !== undefined) {
    body.greeting = draft.greeting;
  }
  if (draft.prompt !== undefined) {
    body.behavior_prompt = draft.prompt;
  }
  if (draft.behavior !== undefined) {
    body.behavior_notes = draft.behavior;
  }
  if (draft.referral_bonus) {
    body.referral_bonus = draft.referral_bonus;
  }
  if (draft.knowledge_base_ids !== undefined) {
    body.knowledge_base_ids = draft.knowledge_base_ids;
  }
  if (draft.mcp_servers !== undefined) {
    body.mcp_servers = toApiMcpServers(draft.mcp_servers);
  }

  return body;
}

/** Build PATCH body; requires business `agent_id`. */
export function toUpdateAgentRequest(
  agentIdBusiness: string,
  data: Partial<Agent> & { country_code?: string; phone_number?: string },
): UpdateAgentRequest {
  const body: UpdateAgentRequest = { agent_id: agentIdBusiness };

  if (data.agent_name !== undefined) body.agent_name = data.agent_name;
  if (data.enable_voice !== undefined) body.enable_voice = data.enable_voice;
  if (data.country_code !== undefined) body.country_code = data.country_code;
  if (data.phone_number !== undefined) body.phone_number = data.phone_number;
  if (data.status !== undefined) body.status = data.status;
  if (data.base_template_id !== undefined) body.base_template_id = data.base_template_id;
  if (data.language !== undefined) body.language = data.language;
  if (data.greeting !== undefined) body.greeting = data.greeting;
  if (data.prompt !== undefined) body.behavior_prompt = data.prompt;
  if (data.behavior !== undefined) body.behavior_notes = data.behavior;
  if (data.referral_bonus !== undefined) body.referral_bonus = data.referral_bonus;
  if (data.knowledge_base_ids !== undefined) body.knowledge_base_ids = data.knowledge_base_ids;
  if (data.mcp_servers !== undefined) body.mcp_servers = toApiMcpServers(data.mcp_servers);

  return body;
}
