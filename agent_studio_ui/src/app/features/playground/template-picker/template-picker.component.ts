import { Component, inject, OnInit, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { AgentTemplate, templateIcon } from '../../../core/models/agent-template.model';
import { AgentTemplateService } from '../../../core/services/agent-template.service';

@Component({
  selector: 'app-template-picker',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './template-picker.component.html',
  styleUrl: './template-picker.component.css',
})
export class TemplatePickerComponent implements OnInit {
  private readonly agentTemplateService = inject(AgentTemplateService);
  private readonly router = inject(Router);

  readonly templates = signal<AgentTemplate[]>([]);
  readonly loading = signal(true);

  ngOnInit(): void {
    this.agentTemplateService.getTemplates().subscribe((templates) => {
      this.templates.set(templates);
      this.loading.set(false);
    });
  }

  selectTemplate(template: AgentTemplate): void {
    this.router.navigate(['/playground', 'new', template.template_id]);
  }

  templateIcon(template: AgentTemplate): string {
    return templateIcon(template.template_id);
  }
}
