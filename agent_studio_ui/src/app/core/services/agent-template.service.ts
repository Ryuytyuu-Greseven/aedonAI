import { Injectable } from '@angular/core';
import { Observable, of, catchError, map } from 'rxjs';
import { AgentTemplate } from '../models/agent-template.model';
import { ApiService } from '../http/api.service';

@Injectable({ providedIn: 'root' })
export class AgentTemplateService {
  constructor(private readonly api: ApiService) {}

  getTemplates(): Observable<AgentTemplate[]> {
    return this.api.getAllTemplates();
  }

  getTemplate(templateId: string): Observable<AgentTemplate | undefined> {
    return this.api.getTemplate(templateId).pipe(
      map((template) => template),
      catchError(() => of(undefined)),
    );
  }
}
