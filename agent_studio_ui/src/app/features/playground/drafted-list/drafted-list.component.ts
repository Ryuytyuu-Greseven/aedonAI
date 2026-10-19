import { Component, inject, OnInit, signal, computed } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { Agent } from '../../../core/models/agent.model';
import { AgentTemplate, templateIcon } from '../../../core/models/agent-template.model';
import { AgentService } from '../../../core/services/agent.service';
import { AgentTemplateService } from '../../../core/services/agent-template.service';

@Component({
  selector: 'app-drafted-list',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './drafted-list.component.html',
  styleUrl: './drafted-list.component.css',
})
export class DraftedListComponent implements OnInit {
  private readonly agentService = inject(AgentService);
  private readonly agentTemplateService = inject(AgentTemplateService);
  private readonly router = inject(Router);

  private readonly agents = signal<Agent[]>([]);
  private readonly templates = signal<AgentTemplate[]>([]);
  readonly loading = signal(true);

  readonly drafts = computed(() => this.agents().filter((a) => a.status === 'draft'));

  ngOnInit(): void {
    this.agentService.getAgents().subscribe((agents) => {
      this.agents.set(agents);
      this.loading.set(false);
    });
    this.agentTemplateService.getTemplates().subscribe((templates) => this.templates.set(templates));
  }

  templateName(agent: Agent): string {
    return this.templates().find((t) => t.template_id === agent.base_template_id)?.name ?? 'Custom agent';
  }

  templateIcon(agent: Agent): string {
    return templateIcon(agent.base_template_id);
  }

  formatDate(iso: string): string {
    return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  }

  openDraft(agent: Agent): void {
    this.router.navigate(['/playground', agent.id]);
  }
}
