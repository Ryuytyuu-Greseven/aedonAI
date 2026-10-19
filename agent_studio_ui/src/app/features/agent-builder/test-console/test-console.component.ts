import { Component, Input, signal, ElementRef, viewChild, afterNextRender } from '@angular/core';
import { JsonPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Agent, AgentNode } from '../../../core/models/agent.model';
import {
  finalAgentResponse,
  findStartNode,
  NodeSimulationStep,
  SCENARIO_LABELS,
  simulateNodeStep,
  SimulationScenario,
} from '../../../../mocks/api-responses.mock';

interface UserMessage {
  text: string;
  isVoice: boolean;
}

interface TraceBlock {
  userMessage: UserMessage;
  steps: NodeSimulationStep[];
  finalResponse: string;
}

@Component({
  selector: 'app-test-console',
  standalone: true,
  imports: [FormsModule, JsonPipe],
  templateUrl: './test-console.component.html',
  styleUrl: './test-console.component.css',
})
export class TestConsoleComponent {
  @Input({ required: true }) agent!: Agent;

  readonly traces = signal<TraceBlock[]>([]);
  readonly running = signal(false);
  readonly scenarios = Object.entries(SCENARIO_LABELS) as [SimulationScenario, string][];

  userInput = '';
  scenario: SimulationScenario = 'happy_path';
  startNodeId: string | null = null;
  voiceInput = false;

  private logRef = viewChild<ElementRef<HTMLDivElement>>('logRef');

  constructor() {
    afterNextRender(() => this.scrollToBottom());
  }

  runSimulation(): void {
    if (this.running() || !this.userInput.trim()) return;

    const userMessage: UserMessage = {
      text: this.userInput.trim(),
      isVoice: this.voiceInput && this.agent.enable_voice,
    };
    this.userInput = '';
    this.running.set(true);

    const start = findStartNode(this.agent.nodes, this.startNodeId);
    if (!start) {
      this.running.set(false);
      return;
    }

    const steps: NodeSimulationStep[] = [];
    this.traverse(start, userMessage, steps, () => {
      const block: TraceBlock = {
        userMessage,
        steps,
        finalResponse: finalAgentResponse(steps),
      };
      this.traces.update((t) => [...t, block]);
      this.running.set(false);
      setTimeout(() => this.scrollToBottom(), 50);
    });
  }

  clearConsole(): void {
    this.traces.set([]);
  }

  private traverse(
    node: AgentNode,
    userMessage: UserMessage,
    steps: NodeSimulationStep[],
    onComplete: () => void
  ): void {
    const delay = 500 + Math.random() * 300;
    setTimeout(() => {
      const step = simulateNodeStep(node, this.agent.tools, userMessage.text, this.scenario);
      steps.push(step);

      if (node.nextNode) {
        const next = this.agent.nodes.find((n) => n.id === node.nextNode);
        if (next) {
          this.traverse(next, userMessage, steps, onComplete);
        } else {
          onComplete();
        }
      } else {
        onComplete();
      }
    }, delay);
  }

  private scrollToBottom(): void {
    const el = this.logRef()?.nativeElement;
    if (el) el.scrollTop = el.scrollHeight;
  }

  expandedStep: string | null = null;

  toggleStep(id: string): void {
    this.expandedStep = this.expandedStep === id ? null : id;
  }

  stepKey(blockIndex: number, stepIndex: number): string {
    return `${blockIndex}-${stepIndex}`;
  }
}
