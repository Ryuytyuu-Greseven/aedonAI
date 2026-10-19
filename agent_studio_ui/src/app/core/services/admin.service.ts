import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { CreateSalesAgentAccountInput, SalesAgentAccount } from '../models/sales-agent-account.model';
import { ApiService } from '../http/api.service';

@Injectable({ providedIn: 'root' })
export class AdminService {
  constructor(private readonly api: ApiService) {}

  listSalesAgents(): Observable<SalesAgentAccount[]> {
    return this.api.listSalesAgents();
  }

  createSalesAgent(input: CreateSalesAgentAccountInput): Observable<SalesAgentAccount> {
    return this.api.createSalesAgent(input);
  }

  setSalesAgentEnabled(id: string, enabled: boolean): Observable<SalesAgentAccount> {
    return this.api.setSalesAgentEnabled(id, enabled);
  }

  updateSalesAgentName(id: string, name: string): Observable<SalesAgentAccount> {
    return this.api.updateSalesAgentName(id, name);
  }

  resetSalesAgentPassword(id: string, newPassword: string): Observable<void> {
    return this.api.resetSalesAgentPassword(id, newPassword);
  }
}
