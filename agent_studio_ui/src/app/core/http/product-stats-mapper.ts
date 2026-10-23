import { ProductStatsPage, ProductStatsRow } from '../models/product-stats.model';

/** Wire shape of `GET /api/agents/:id/product-stats` — agent_studio_server `ProductStatsRow`. */
export interface ApiProductStatsRow {
  propertyId: string;
  name: string;
  description: string | null;
  enquiries: number;
  uniqueCallers: number;
  shortlisted: number;
  purchaseIntent: number;
  siteVisits: number;
  conversionRate: number;
  lastEnquiredAt: string | null;
}

export interface ApiProductStatsResponse {
  items: ApiProductStatsRow[];
  total: number;
  page: number;
  limit: number;
}

function fromApiProductStatsRow(raw: ApiProductStatsRow): ProductStatsRow {
  return {
    property_id: raw.propertyId,
    name: raw.name,
    description: raw.description ?? null,
    enquiries: raw.enquiries,
    unique_callers: raw.uniqueCallers,
    shortlisted: raw.shortlisted,
    purchase_intent: raw.purchaseIntent,
    site_visits: raw.siteVisits,
    conversion_rate: raw.conversionRate,
    last_enquired_at: raw.lastEnquiredAt ?? null,
  };
}

export function fromApiProductStatsResponse(raw: ApiProductStatsResponse): ProductStatsPage {
  return {
    items: raw.items.map(fromApiProductStatsRow),
    total: raw.total,
    page: raw.page,
    limit: raw.limit,
  };
}
