import { Component, EventEmitter, HostListener, inject, Input, Output } from '@angular/core';
import { FFlowModule, FCreateConnectionEvent, FMoveNodesEvent } from '@foblex/flow';
import {
  Agent,
  AgentNode,
  cloneAgent,
  connectionId,
  FlowConnection,
  inputConnectorId,
  nodeIdFromConnector,
  outputConnectorId,
  promptExcerpt,
  toolNameById,
} from '../../../core/models/agent.model';
import { ToastService } from '../../../core/services/toast.service';
import { applyAutoLayout } from '../../../core/utils/graph-layout.util';

@Component({
  selector: 'app-graph-canvas',
  standalone: true,
  imports: [FFlowModule],
  templateUrl: './graph-canvas.component.html',
  styleUrl: './graph-canvas.component.css',
})
export class GraphCanvasComponent {
  private readonly toast = inject(ToastService);

  @Input({ required: true }) agent!: Agent;
  @Input() selectedNodeId: string | null = null;
  @Output() agentChange = new EventEmitter<Agent>();
  @Output() nodeSelect = new EventEmitter<string | null>();
  @Output() duplicateNode = new EventEmitter<Agent>();

  selectedConnectionId: string | null = null;
  canvasMessage = '';

  get connections(): FlowConnection[] {
    return this.agent.nodes
      .filter((n) => n.nextNode)
      .map((n) => ({
        id: connectionId(n.id, n.nextNode!),
        outputId: outputConnectorId(n.id),
        inputId: inputConnectorId(n.nextNode!),
      }));
  }

  get showMinimap(): boolean {
    return this.agent.nodes.length >= 3;
  }

  @HostListener('document:keydown', ['$event'])
  onKeyDown(event: KeyboardEvent): void {
    if (event.key !== 'Delete' && event.key !== 'Backspace') return;
    if (this.selectedConnectionId) {
      event.preventDefault();
      this.removeConnection(this.selectedConnectionId);
    }
  }

  addNode(): void {
    const id = `node-${Date.now()}`;
    const last = this.agent.nodes[this.agent.nodes.length - 1];
    const offset = this.agent.nodes.length * 40;
    const newNode: AgentNode = {
      id,
      name: `Node ${this.agent.nodes.length + 1}`,
      tools: [],
      prompt: '',
      nextNode: null,
      previousNode: null,
      position: last?.position
        ? { x: last.position.x + 40, y: last.position.y + 40 }
        : { x: 80 + offset, y: 100 + offset },
    };
    this.agentChange.emit({
      ...this.agent,
      nodes: [...this.agent.nodes, newNode],
    });
    this.nodeSelect.emit(id);
  }

  autoLayout(): void {
    this.agentChange.emit(applyAutoLayout(this.agent));
    this.toast.success('Auto-layout applied');
  }

  deleteSelected(): void {
    if (!this.selectedNodeId) return;
    this.deleteNode(this.selectedNodeId);
  }

  duplicateSelected(): void {
    if (!this.selectedNodeId) return;
    const source = this.agent.nodes.find((n) => n.id === this.selectedNodeId);
    if (!source) return;
    const id = `node-${Date.now()}`;
    const copy: AgentNode = {
      ...cloneAgent({ ...this.agent, nodes: [source] }).nodes[0],
      id,
      name: `${source.name} Copy`,
      nextNode: null,
      previousNode: null,
      position: {
        x: (source.position?.x ?? 80) + 40,
        y: (source.position?.y ?? 80) + 40,
      },
    };
    this.duplicateNode.emit({ ...this.agent, nodes: [...this.agent.nodes, copy] });
    this.nodeSelect.emit(id);
  }

  deleteNode(nodeId: string, event?: Event): void {
    event?.stopPropagation();
    const nodes = this.agent.nodes
      .filter((n) => n.id !== nodeId)
      .map((n) => {
        let { nextNode, previousNode } = n;
        if (nextNode === nodeId) nextNode = null;
        if (previousNode === nodeId) previousNode = null;
        return { ...n, nextNode, previousNode };
      });
    this.agentChange.emit({ ...this.agent, nodes });
    if (this.selectedNodeId === nodeId) this.nodeSelect.emit(null);
  }

  onNodeClick(nodeId: string, event: Event): void {
    event.stopPropagation();
    this.selectedConnectionId = null;
    this.nodeSelect.emit(nodeId);
  }

  onConnectionClick(connId: string, event: Event): void {
    event.stopPropagation();
    this.selectedConnectionId = connId;
    this.nodeSelect.emit(null);
  }

  onCanvasClick(): void {
    this.nodeSelect.emit(null);
    this.selectedConnectionId = null;
  }

  onCreateConnection(event: FCreateConnectionEvent): void {
    const { sourceId, targetId } = event;
    if (!sourceId || !targetId) return;

    const sourceNodeId = nodeIdFromConnector(sourceId);
    const targetNodeId = nodeIdFromConnector(targetId);

    if (sourceNodeId === targetNodeId) {
      this.showCanvasMessage('A node cannot connect to itself');
      return;
    }

    const sourceNode = this.agent.nodes.find((n) => n.id === sourceNodeId);
    if (sourceNode?.nextNode) {
      this.showCanvasMessage('This node already has a next connection. Remove it first.');
      return;
    }

    const updated = cloneAgent(this.agent);
    const src = updated.nodes.find((n) => n.id === sourceNodeId);
    const tgt = updated.nodes.find((n) => n.id === targetNodeId);
    if (!src || !tgt) return;

    if (tgt.previousNode) {
      const oldSource = updated.nodes.find((n) => n.id === tgt.previousNode);
      if (oldSource) oldSource.nextNode = null;
    }

    src.nextNode = targetNodeId;
    tgt.previousNode = sourceNodeId;
    this.agentChange.emit(updated);
  }

  removeConnection(connId: string): void {
    const conn = this.connections.find((c) => c.id === connId);
    if (!conn) return;
    const sourceNodeId = nodeIdFromConnector(conn.outputId);
    const targetNodeId = nodeIdFromConnector(conn.inputId);
    const updated = cloneAgent(this.agent);
    const src = updated.nodes.find((n) => n.id === sourceNodeId);
    const tgt = updated.nodes.find((n) => n.id === targetNodeId);
    if (src) src.nextNode = null;
    if (tgt) tgt.previousNode = null;
    this.selectedConnectionId = null;
    this.agentChange.emit(updated);
  }

  onMoveNodes(event: FMoveNodesEvent): void {
    const updated = cloneAgent(this.agent);
    for (const moved of event.nodes) {
      const node = updated.nodes.find((n) => n.id === moved.id);
      if (node) node.position = { x: moved.position.x, y: moved.position.y };
    }
    this.agentChange.emit(updated);
  }

  isSelected(nodeId: string): boolean {
    return this.selectedNodeId === nodeId;
  }

  isConnectionSelected(connId: string): boolean {
    return this.selectedConnectionId === connId;
  }

  nodePosition(node: AgentNode): { x: number; y: number } {
    return node.position ?? { x: 80, y: 80 };
  }

  excerpt(prompt: string): string {
    return promptExcerpt(prompt);
  }

  toolTags(node: AgentNode): string[] {
    return node.tools.map((id) => toolNameById(this.agent, id));
  }

  private showCanvasMessage(msg: string): void {
    this.canvasMessage = msg;
    this.toast.warning(msg);
    setTimeout(() => (this.canvasMessage = ''), 3000);
  }
}
