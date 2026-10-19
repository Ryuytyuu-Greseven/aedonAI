import { AgentVersion, PromptHistoryEntry, cloneAgent } from '../app/core/models/agent.model';
import { MOCK_AGENTS } from './agents.mock';

export function buildSeedVersions(): {
  versions: AgentVersion[];
  promptHistory: PromptHistoryEntry[];
} {
  const versions: AgentVersion[] = [];
  const promptHistory: PromptHistoryEntry[] = [];
  let versionCounter = 1;

  for (const agent of MOCK_AGENTS) {
    const v1: AgentVersion = {
      id: `ver-seed-${agent.id}-1`,
      agentId: agent.id,
      versionNumber: versionCounter++,
      timestamp: new Date(Date.now() - 7 * 86400000).toISOString(),
      snapshot: cloneAgent({ ...agent, agent_name: agent.agent_name + ' (v1)' }),
      label: 'Initial version',
      summary: 'Initial version',
    };
    const v2: AgentVersion = {
      id: `ver-seed-${agent.id}-2`,
      agentId: agent.id,
      versionNumber: versionCounter++,
      timestamp: new Date(Date.now() - 2 * 86400000).toISOString(),
      snapshot: cloneAgent(agent),
      label: 'Updated prompts',
      summary: 'Modified prompts and tool assignments',
    };
    versions.push(v1, v2);

    for (const node of agent.nodes) {
      promptHistory.push({
        nodeId: node.id,
        prompt: node.prompt,
        timestamp: v2.timestamp,
        versionId: v2.id,
      });
      if (node.prompt.length > 20) {
        promptHistory.push({
          nodeId: node.id,
          prompt: node.prompt.slice(0, 20) + '… (earlier draft)',
          timestamp: v1.timestamp,
          versionId: v1.id,
        });
      }
    }
  }

  return { versions, promptHistory };
}

export const SEED_VERSION_DATA = buildSeedVersions();
