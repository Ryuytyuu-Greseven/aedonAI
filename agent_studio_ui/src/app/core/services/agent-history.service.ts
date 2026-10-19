import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { AgentVersion } from '../models/agent.model';
import { AgentService } from './agent.service';
import { computeVersionSummary } from '../utils/version-diff.util';

/**
 * Playground agent-level version history, backed by the real `agent_histories`
 * records (via `AgentService.getAgentHistory`) rather than mock data. Agent Builder's
 * node/prompt-level history stays on `VersionHistoryService` — see design.md decision 4.
 */
@Injectable({ providedIn: 'root' })
export class AgentHistoryService {
  private readonly agentService = inject(AgentService);

  /**
   * Backend rows carry no change summary; compute it here against each entry's
   * chronologically preceding (next-lower stage_version) snapshot, same as
   * `VersionHistoryService.saveVersion` does at write time.
   */
  getVersions(agentId: string): Observable<AgentVersion[]> {
    return this.agentService.getAgentHistory(agentId).pipe(
      map((versions) => {
        const sorted = [...versions].sort((a, b) => b.versionNumber - a.versionNumber);
        return sorted.map((version, index) => ({
          ...version,
          summary: computeVersionSummary(sorted[index + 1]?.snapshot ?? null, version.snapshot),
        }));
      }),
    );
  }
}
