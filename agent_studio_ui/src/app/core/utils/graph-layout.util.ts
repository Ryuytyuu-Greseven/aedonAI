import { Agent, AgentNode } from '../models/agent.model';

const NODE_WIDTH = 180;
const NODE_HEIGHT = 100;
const H_GAP = 80;
const V_GAP = 60;

export function autoLayoutNodes(nodes: AgentNode[]): AgentNode[] {
  if (nodes.length === 0) return [];

  const byId = new Map(nodes.map((n) => [n.id, { ...n }]));
  const start =
    nodes.find((n) => !n.previousNode) ??
    nodes.find((n) => !nodes.some((o) => o.nextNode === n.id)) ??
    nodes[0];

  const layers: string[][] = [];
  const visited = new Set<string>();
  let queue: string[] = [start.id];

  while (queue.length > 0) {
    layers.push([...queue]);
    const next: string[] = [];
    for (const id of queue) {
      visited.add(id);
      const node = byId.get(id);
      if (node?.nextNode && !visited.has(node.nextNode)) {
        next.push(node.nextNode);
      }
    }
    queue = [...new Set(next)];
  }

  const placed = new Set(layers.flat());
  const orphans = nodes.filter((n) => !placed.has(n.id)).map((n) => n.id);
  if (orphans.length) layers.push(orphans);

  layers.forEach((layer, col) => {
    layer.forEach((id, row) => {
      const node = byId.get(id);
      if (node) {
        node.position = {
          x: 80 + col * (NODE_WIDTH + H_GAP),
          y: 80 + row * (NODE_HEIGHT + V_GAP),
        };
      }
    });
  });

  return nodes.map((n) => byId.get(n.id) ?? n);
}

export function nodesNeedAutoLayout(nodes: AgentNode[]): boolean {
  if (nodes.length <= 1) return false;
  const positions = nodes.map((n) => n.position);
  if (positions.some((p) => !p)) return true;
  const xs = positions.map((p) => p!.x);
  return new Set(xs).size === 1 && nodes.length > 1;
}

export function applyAutoLayout(agent: Agent): Agent {
  return {
    ...agent,
    nodes: autoLayoutNodes(agent.nodes.map((n) => ({ ...n }))),
  };
}
