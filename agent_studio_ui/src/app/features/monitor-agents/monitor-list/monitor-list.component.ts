import { Component, inject, OnInit, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { Agent } from '../../../core/models/agent.model';
import { AgentCallStats } from '../../../core/models/call-record.model';
import { AgentService } from '../../../core/services/agent.service';
import { CallRecordService } from '../../../core/services/call-record.service';
import { CallSplitBarComponent } from '../call-split-bar/call-split-bar.component';

interface MonitoredAgent {
  agent: Agent;
  stats: AgentCallStats;
}

@Component({
  selector: 'app-monitor-list',
  standalone: true,
  imports: [RouterLink, CallSplitBarComponent],
  templateUrl: './monitor-list.component.html',
  styleUrl: './monitor-list.component.css',
})
export class MonitorListComponent implements OnInit {
  private readonly agentService = inject(AgentService);
  private readonly callRecordService = inject(CallRecordService);
  private readonly router = inject(Router);

  readonly loading = signal(true);
  readonly monitored = signal<MonitoredAgent[]>([]);

  ngOnInit(): void {
    this.agentService.getLiveAgents().subscribe((liveAgents) => {
      if (liveAgents.length === 0) {
        this.monitored.set([]);
        this.loading.set(false);
        return;
      }

      const statsRequests = liveAgents.map((agent) =>
        this.callRecordService.getStatsForAgent(agent.id).pipe(
          catchError(() => of({ agentId: agent.id, total: 0, inbound: 0, outbound: 0, byDay: [] }))
        )
      );

      forkJoin(statsRequests).subscribe((allStats) => {
        this.monitored.set(liveAgents.map((agent, i) => ({ agent, stats: allStats[i] })));
        this.loading.set(false);
      });
    });
  }

  openAgent(agentId: string): void {
    this.router.navigate(['/monitor', agentId]);
  }
}
