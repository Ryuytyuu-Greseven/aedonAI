/** Sort keys accepted by `GET /api/agents/:id/product-stats` — sent to the server as-is. */
export type ProductStatsSort =
  | 'name'
  | 'enquiries'
  | 'uniqueCallers'
  | 'shortlisted'
  | 'purchaseIntent'
  | 'siteVisits'
  | 'conversionRate'
  | 'lastEnquiredAt';

export type SortOrder = 'asc' | 'desc';

/**
 * One product's enquiry funnel over the requested date range. Counts are distinct conversations
 * (a caller asking about the same product five times in one call counts once); playground
 * previews are excluded server-side.
 */
export interface ProductStatsRow {
  property_id: string;
  name: string;
  description: string | null;
  enquiries: number;
  unique_callers: number;
  shortlisted: number;
  purchase_intent: number;
  site_visits: number;
  /** 0–1 — purchase_intent / enquiries, 0 when there are no enquiries. */
  conversion_rate: number;
  last_enquired_at: string | null;
}

export interface ProductStatsQuery {
  page?: number;
  limit?: number;
  search?: string;
  fromDate?: string;
  toDate?: string;
  sort?: ProductStatsSort;
  order?: SortOrder;
}

export interface ProductStatsPage {
  items: ProductStatsRow[];
  total: number;
  page: number;
  limit: number;
}
