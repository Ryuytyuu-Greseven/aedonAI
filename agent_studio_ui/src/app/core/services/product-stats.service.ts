import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ProductStatsPage, ProductStatsQuery } from '../models/product-stats.model';
import { ApiService } from '../http/api.service';

@Injectable({ providedIn: 'root' })
export class ProductStatsService {
  private readonly api = inject(ApiService);

  /**
   * Real `GET /api/agents/:id/product-stats` — every product on file for the agent, with its
   * enquiry funnel for the date range (server default: last 14 days). Sorted, searched and
   * paginated server-side.
   */
  getProductStats(agentId: string, query: ProductStatsQuery = {}): Observable<ProductStatsPage> {
    return this.api.getProductStats(agentId, query);
  }
}
