import { Agent, AGENT_MODE_LABELS, AgentVersion, isDestinationTool } from '../models/agent.model';

export interface DiffLine {
  key: string;
  status: 'added' | 'removed' | 'unchanged';
  value: string;
}

export function versionChangeParts(prev: Agent | null, next: Agent): string[] {
  if (!prev) return [];

  const parts: string[] = [];
  if (prev.agent_name !== next.agent_name) {
    parts.push(`Renamed agent to "${next.agent_name}"`);
  }
  if ((prev.agent_mode ?? 'both') !== (next.agent_mode ?? 'both')) {
    parts.push(`Agent mode changed to "${AGENT_MODE_LABELS[next.agent_mode ?? 'both']}"`);
  }
  if (prev.status !== next.status) {
    parts.push(next.status === 'live' ? 'Went live' : `Status changed to ${next.status}`);
  }
  if (prev.prompt !== next.prompt) {
    parts.push('Modified prompt');
  }
  if (prev.behavior !== next.behavior) {
    parts.push('Modified behavior');
  }
  if (prev.greeting !== next.greeting) {
    parts.push('Modified greeting');
  }

  const prevMcpServerIds = new Set(prev.mcp_servers.map((s) => s.id));
  const nextMcpServerIds = new Set(next.mcp_servers.map((s) => s.id));
  for (const server of next.mcp_servers) {
    if (!prevMcpServerIds.has(server.id)) {
      parts.push(`Added MCP server "${server.name}"`);
    }
  }
  for (const server of prev.mcp_servers) {
    if (!nextMcpServerIds.has(server.id)) {
      parts.push(`Removed MCP server "${server.name}"`);
    }
  }

  const prevNodeIds = new Set(prev.nodes.map((n) => n.id));
  const nextNodeIds = new Set(next.nodes.map((n) => n.id));

  for (const node of next.nodes) {
    if (!prevNodeIds.has(node.id)) {
      parts.push(`Added node "${node.name}"`);
    }
  }
  for (const node of prev.nodes) {
    if (!nextNodeIds.has(node.id)) {
      parts.push(`Removed node "${node.name}"`);
    }
  }

  for (const node of next.nodes) {
    const old = prev.nodes.find((n) => n.id === node.id);
    if (old && old.prompt !== node.prompt) {
      parts.push(`Modified prompt on "${node.name}"`);
    }
    if (old && old.name !== node.name) {
      parts.push(`Renamed node to "${node.name}"`);
    }
  }

  const prevToolIds = new Set(prev.tools.map((t) => t.id));
  const nextToolIds = new Set(next.tools.map((t) => t.id));
  for (const tool of next.tools) {
    if (!prevToolIds.has(tool.id)) {
      parts.push(isDestinationTool(tool) ? `Added integration "${tool.name}"` : `Added tool "${tool.name}"`);
    }
  }
  for (const tool of prev.tools) {
    if (!nextToolIds.has(tool.id)) {
      parts.push(isDestinationTool(tool) ? `Removed integration "${tool.name}"` : `Removed tool "${tool.name}"`);
    }
  }

  return parts;
}

export function computeVersionSummary(prev: Agent | null, next: Agent): string {
  if (!prev) return 'Initial version';
  const parts = versionChangeParts(prev, next);
  return parts.length > 0 ? parts.join('; ') : 'Minor updates';
}

export function diffAgentJson(prev: Agent | null, current: Agent): DiffLine[] {
  const prevLines = prev
    ? JSON.stringify(prev, null, 2).split('\n')
    : [];
  const currLines = JSON.stringify(current, null, 2).split('\n');
  const prevSet = new Set(prevLines);
  const currSet = new Set(currLines);
  const lines: DiffLine[] = [];

  for (const line of currLines) {
    lines.push({
      key: line,
      status: prevSet.has(line) ? 'unchanged' : 'added',
      value: line,
    });
  }
  for (const line of prevLines) {
    if (!currSet.has(line)) {
      lines.push({ key: line, status: 'removed', value: line });
    }
  }
  return lines;
}

export function previousVersion(
  versions: AgentVersion[],
  current: AgentVersion
): AgentVersion | null {
  const sorted = [...versions].sort((a, b) => b.versionNumber - a.versionNumber);
  const idx = sorted.findIndex((v) => v.id === current.id);
  return idx >= 0 && idx < sorted.length - 1 ? sorted[idx + 1] : null;
}
