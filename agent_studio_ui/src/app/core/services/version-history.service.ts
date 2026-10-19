import { Injectable } from '@angular/core';
import { delay, Observable, of } from 'rxjs';
import { Agent, AgentVersion, cloneAgent, PromptHistoryEntry } from '../models/agent.model';
import { computeVersionSummary } from '../utils/version-diff.util';
import { SEED_VERSION_DATA } from '../../../mocks/version-history.mock';

@Injectable({ providedIn: 'root' })
export class VersionHistoryService {
  private versions: AgentVersion[] = [...SEED_VERSION_DATA.versions];
  private promptHistory: PromptHistoryEntry[] = [...SEED_VERSION_DATA.promptHistory];
  private versionCounters = new Map<string, number>();

  constructor() {
    for (const v of this.versions) {
      const current = this.versionCounters.get(v.agentId) ?? 0;
      this.versionCounters.set(v.agentId, Math.max(current, v.versionNumber));
    }
  }

  getVersions(agentId: string): Observable<AgentVersion[]> {
    const list = this.versions
      .filter((v) => v.agentId === agentId)
      .sort((a, b) => b.versionNumber - a.versionNumber);
    return of(list.map((v) => ({ ...v, snapshot: cloneAgent(v.snapshot) }))).pipe(delay(200));
  }

  getPromptHistory(agentId: string, nodeId: string): Observable<PromptHistoryEntry[]> {
    const entries = this.promptHistory
      .filter((e) => {
        const version = this.versions.find((v) => v.id === e.versionId);
        return version?.agentId === agentId && e.nodeId === nodeId;
      })
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    return of([...entries]).pipe(delay(200));
  }

  getAllPromptHistory(agentId: string): Observable<PromptHistoryEntry[]> {
    const entries = this.promptHistory
      .filter((e) => {
        const version = this.versions.find((v) => v.id === e.versionId);
        return version?.agentId === agentId;
      })
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    return of([...entries]).pipe(delay(200));
  }

  saveVersion(agent: Agent, label: string): Observable<AgentVersion> {
    const prev = this.getLatestSnapshot(agent.id);
    const versionNumber = (this.versionCounters.get(agent.id) ?? 0) + 1;
    this.versionCounters.set(agent.id, versionNumber);

    const version: AgentVersion = {
      id: `ver-${Date.now()}`,
      agentId: agent.id,
      versionNumber,
      timestamp: new Date().toISOString(),
      snapshot: cloneAgent(agent),
      label,
      summary: computeVersionSummary(prev, agent),
    };
    this.versions.push(version);

    for (const node of agent.nodes) {
      const lastForNode = [...this.promptHistory]
        .filter((e) => e.nodeId === node.id)
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())[0];
      if (!lastForNode || lastForNode.prompt !== node.prompt) {
        this.promptHistory.push({
          nodeId: node.id,
          prompt: node.prompt,
          timestamp: version.timestamp,
          versionId: version.id,
        });
      }
    }

    return of({ ...version, snapshot: cloneAgent(version.snapshot) }).pipe(delay(200));
  }

  private getLatestSnapshot(agentId: string): Agent | null {
    const latest = this.versions
      .filter((v) => v.agentId === agentId)
      .sort((a, b) => b.versionNumber - a.versionNumber)[0];
    return latest ? cloneAgent(latest.snapshot) : null;
  }
}
