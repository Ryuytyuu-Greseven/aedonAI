import { Agent, AgentNode, Tool } from '../app/core/models/agent.model';

export type SimulationScenario = 'happy_path' | 'tool_error' | 'no_tool_calls';

export interface ToolSimulationResult {
  toolName: string;
  args: Record<string, string>;
  output: string;
  error?: string;
}

export interface NodeSimulationStep {
  nodeId: string;
  nodeName: string;
  prompt: string;
  toolCalls: ToolSimulationResult[];
  output: string;
}

export const SCENARIO_LABELS: Record<SimulationScenario, string> = {
  happy_path: 'Happy path',
  tool_error: 'Tool error',
  no_tool_calls: 'No tool calls',
};

export function simulateNodeStep(
  node: AgentNode,
  tools: Tool[],
  userMessage: string,
  scenario: SimulationScenario
): NodeSimulationStep {
  const assignedTools = tools.filter((t) => node.tools.includes(t.id));
  const toolCalls: ToolSimulationResult[] = [];

  if (scenario === 'no_tool_calls') {
    // skip tool calls
  } else if (assignedTools.length > 0) {
    for (const tool of assignedTools) {
      const args: Record<string, string> = {};
      for (const p of tool.parameters) {
        args[p.name] = `[simulated ${p.type}]`;
      }
      if (scenario === 'tool_error') {
        toolCalls.push({
          toolName: tool.name,
          args,
          output: '',
          error: `Tool "${tool.name}" failed: timeout`,
        });
        break;
      }
      toolCalls.push({
        toolName: tool.name,
        args,
        output: tool.returns ?? 'OK',
      });
    }
  }

  const snippet =
    node.prompt.length > 60 ? node.prompt.slice(0, 60) + '…' : node.prompt;
  const output =
    scenario === 'tool_error' && toolCalls.some((t) => t.error)
      ? `Handled error at "${node.name}" and continued with fallback response.`
      : `[${node.name}] Processed "${userMessage}" using prompt: "${snippet}"`;

  return {
    nodeId: node.id,
    nodeName: node.name,
    prompt: node.prompt,
    toolCalls,
    output,
  };
}

export function finalAgentResponse(steps: NodeSimulationStep[]): string {
  if (steps.length === 0) return 'No response generated.';
  return steps[steps.length - 1].output;
}

export function findStartNode(nodes: AgentNode[], startNodeId: string | null): AgentNode | undefined {
  if (startNodeId) {
    return nodes.find((n) => n.id === startNodeId);
  }
  if (nodes.length === 0) return undefined;
  return nodes.find((n) => !n.previousNode) ?? nodes[0];
}
