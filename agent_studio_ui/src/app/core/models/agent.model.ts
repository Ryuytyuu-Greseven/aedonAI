export type AgentStatus = 'draft' | 'staged' | 'live' | 'disabled';
export type ToolParameterType = 'string' | 'number' | 'boolean' | 'array' | 'object';

export const CURRENCIES = ['USD', 'INR', 'AED', 'THB', 'GBP', 'EUR'] as const;
export type Currency = (typeof CURRENCIES)[number];

export const AGENT_MODES = ['chatbot', 'voice', 'both'] as const;
export type AgentMode = (typeof AGENT_MODES)[number];

export const AGENT_MODE_LABELS: Record<AgentMode, string> = {
  chatbot: 'Chat bot',
  voice: 'Voice agent',
  both: 'Chat bot & Voice agent',
};

export interface ReferralBonus {
  amount: number;
  currency: Currency;
}

export interface ToolParameter {
  name: string;
  type: ToolParameterType;
  description: string;
  required: boolean;
}

export type ToolKind = 'custom' | 'api_webhook' | 'sms' | 'whatsapp' | 'email';

export interface ToolDestinationConfig {
  url?: string;
  recipient?: string;
}

export interface Tool {
  id: string;
  name: string;
  description: string;
  parameters: ToolParameter[];
  returns?: string;
  kind?: ToolKind;
  destinationConfig?: ToolDestinationConfig;
}

export interface NodePosition {
  x: number;
  y: number;
}

export interface AgentNode {
  id: string;
  name: string;
  tools: string[];
  prompt: string;
  nextNode: string | null;
  previousNode: string | null;
  position?: NodePosition;
}

export interface McpServer {
  id: string;
  name: string;
  url: string;
  api_key?: string;
}

export interface Agent {
  id: string;
  /** Business UUID required by PATCH /agents/:id (distinct from Mongo `id`). */
  agent_id?: string;
  agent_name: string;
  agent_mode?: AgentMode;
  /** BCP-47-ish language code, e.g. `en`, `hi` — see `shared/constants/languages.constant.ts`. */
  language?: string;
  /** Provider-neutral voice code, e.g. `female_1` — see `shared/constants/agent-voices.constant.ts`. */
  voice?: string;
  enable_voice: boolean;
  phone_number_id?: string;
  /** E.164 / dial fields from API (when not using local phone library id). */
  country_code?: string;
  phone_number?: string;
  status: AgentStatus;
  nodes: AgentNode[];
  tools: Tool[];
  mcp_servers: McpServer[];
  knowledge_base_ids: string[];
  created_at: string;
  updated_at: string;
  base_template_id?: string;
  greeting?: string;
  prompt?: string;
  behavior?: string;
  referral_bonus?: ReferralBonus;
  preview_hash?: string | null;
  /** Number of times this agent has been staged; gates History panel availability. */
  current_stage_version: number;
}

export interface AgentExportJson {
  agent_name: string;
  agent_mode: AgentMode;
  enable_voice: boolean;
  nodes: Array<{
    id: string;
    name: string;
    tools: string[];
    prompt: string;
    nextNode: string | null;
    previousNode: string | null;
  }>;
  tools: Tool[];
  mcp_servers: McpServer[];
  knowledge_base_ids: string[];
}

export interface AgentVersion {
  id: string;
  agentId: string;
  versionNumber: number;
  timestamp: string;
  snapshot: Agent;
  label: string;
  summary: string;
}

export interface PromptHistoryEntry {
  nodeId: string;
  prompt: string;
  timestamp: string;
  versionId: string;
}

export interface FlowConnection {
  id: string;
  outputId: string;
  inputId: string;
}

export function createEmptyAgent(id?: string): Agent {
  const now = new Date().toISOString();
  return {
    id: id ?? '',
    agent_name: '',
    agent_mode: 'both',
    enable_voice: false,
    status: 'draft',
    nodes: [],
    tools: [],
    mcp_servers: [],
    knowledge_base_ids: [],
    created_at: now,
    updated_at: now,
    current_stage_version: 0,
  };
}

const DESTINATION_LABELS: Record<Exclude<ToolKind, 'custom'>, string> = {
  api_webhook: 'API Webhook',
  sms: 'SMS',
  whatsapp: 'WhatsApp',
  email: 'Email',
};

export function createDestinationTool(input: {
  kind: Exclude<ToolKind, 'custom'>;
  url?: string;
  recipient?: string;
  description?: string;
  id?: string;
}): Tool {
  return {
    id: input.id ?? `dest-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    name: DESTINATION_LABELS[input.kind],
    description: input.description ?? (input.recipient ? `Sends updates to ${input.recipient}` : ''),
    parameters: [],
    kind: input.kind,
    destinationConfig: { url: input.url, recipient: input.recipient },
  };
}

export function isDestinationTool(tool: Tool): boolean {
  return !!tool.kind && tool.kind !== 'custom';
}

export function createToolParam(
  name: string,
  type: ToolParameterType = 'string',
  description = '',
  required = false
): ToolParameter {
  return { name, type, description, required };
}

export function legacyParamsToSchema(
  legacy: Record<string, string>
): ToolParameter[] {
  return Object.entries(legacy).map(([name, type]) =>
    createToolParam(name, (type as ToolParameterType) || 'string', '', true)
  );
}

export function cloneAgent(agent: Agent): Agent {
  return JSON.parse(JSON.stringify(agent)) as Agent;
}

export function agentsEqual(a: Agent, b: Agent): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

export function redactApiKey(key: string): string {
  if (!key) return key;
  return key.length <= 4 ? '••••' : `••••${key.slice(-4)}`;
}

export function toExportJson(agent: Agent): AgentExportJson {
  return {
    agent_name: agent.agent_name,
    agent_mode: agent.agent_mode ?? 'both',
    enable_voice: agent.enable_voice,
    nodes: agent.nodes.map(({ position: _position, ...node }) => node),
    tools: agent.tools.map((t) => ({ ...t, parameters: [...t.parameters] })),
    mcp_servers: agent.mcp_servers.map((s) => ({
      ...s,
      api_key: s.api_key ? redactApiKey(s.api_key) : s.api_key,
    })),
    knowledge_base_ids: [...agent.knowledge_base_ids],
  };
}

export function mcpServerNameExists(servers: McpServer[], name: string, excludeId?: string): boolean {
  return servers.some(
    (s) => s.name.toLowerCase() === name.trim().toLowerCase() && s.id !== excludeId
  );
}

export function outputConnectorId(nodeId: string): string {
  return `out-${nodeId}`;
}

export function inputConnectorId(nodeId: string): string {
  return `in-${nodeId}`;
}

export function nodeIdFromConnector(connectorId: string): string {
  return connectorId.replace(/^(out|in)-/, '');
}

export function connectionId(sourceNodeId: string, targetNodeId: string): string {
  return `conn-${sourceNodeId}-${targetNodeId}`;
}

export function nodesReferencingTool(agent: Agent, toolId: string): AgentNode[] {
  return agent.nodes.filter((n) => n.tools.includes(toolId));
}

export function toolNameById(agent: Agent, toolId: string): string {
  return agent.tools.find((t) => t.id === toolId)?.name ?? toolId;
}

export function promptExcerpt(prompt: string, max = 60): string {
  if (!prompt.trim()) return 'No prompt';
  return prompt.length > max ? prompt.slice(0, max) + '…' : prompt;
}
