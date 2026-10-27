import { Injectable, Logger } from '@nestjs/common';

import { ConnectedPagesRepository } from '../repos/connected-pages.repository';
import { ConnectedPage } from '../schemas/connected-page.schema';
import { MetaLeadsService } from './meta-leads.service';
import { parseLeadFields } from './parse-lead-fields';

const GRAPH_URL = 'https://graph.facebook.com/v22.0';

// Re-scan this much before the last sync so leads created while the
// previous poll was running aren't missed. Duplicates are skipped by leadgenId.
const SYNC_OVERLAP_MS = 5 * 60 * 1000;

export interface SyncedLead {
  leadgenId: string;
  customerId: string;
  pageId: string;
  formId: string;
  fullName: string;
  phoneNumber: string;
  email: string;
  customFields: Record<string, any>;
  metaCreatedAt: Date;
}

export interface LeadSyncResult {
  pagesChecked: number;
  newLeads: SyncedLead[];
  errors: { pageId: string; formId?: string; error: string }[];
}

/**
 * Polling fallback for the leadgen webhook: pulls leads straight from each
 * connected Page's forms and stores any that aren't in the DB yet. Meant to
 * be triggered on a schedule by an external cron, so leads still arrive if
 * Meta never delivers (or drops) a webhook.
 */
@Injectable()
export class MetaLeadSyncService {
  private readonly logger = new Logger(MetaLeadSyncService.name);
  // How far back to look for a Page that has never been polled
  private readonly initialLookbackMs = Number(process.env.META_LEAD_SYNC_LOOKBACK_HOURS || 24) * 60 * 60 * 1000;

  constructor(
    private readonly connectedPagesRepository: ConnectedPagesRepository,
    private readonly metaLeadsService: MetaLeadsService,
  ) { }

  async syncLeads(customerId?: string): Promise<LeadSyncResult> {
    const pages = await this.connectedPagesRepository.findAllActive(customerId);
    const result: LeadSyncResult = { pagesChecked: pages.length, newLeads: [], errors: [] };

    for (const page of pages) {
      await this.syncPage(page, result);
    }

    this.logger.log(
      `Lead sync done: ${pages.length} page(s), ${result.newLeads.length} new lead(s), ${result.errors.length} error(s)`,
    );
    return result;
  }

  private async syncPage(page: ConnectedPage, result: LeadSyncResult): Promise<void> {
    const syncStartedAt = new Date();
    const since = page.lastLeadSyncAt
      ? new Date(page.lastLeadSyncAt.getTime() - SYNC_OVERLAP_MS)
      : new Date(syncStartedAt.getTime() - this.initialLookbackMs);
    let pageFailed = false;

    let forms: { id: string }[];
    try {
      forms = await this.fetchAllPages(
        `${GRAPH_URL}/${page.pageId}/leadgen_forms?fields=id&limit=100&access_token=${page.accessToken}`,
      );
    } catch (error) {
      this.logger.error(`Failed to list forms for Page ${page.pageId}: ${error.message}`);
      result.errors.push({ pageId: page.pageId, error: error.message });
      return;
    }

    const filtering = encodeURIComponent(
      JSON.stringify([{ field: 'time_created', operator: 'GREATER_THAN', value: Math.floor(since.getTime() / 1000) }]),
    );

    for (const form of forms) {
      try {
        const leads = await this.fetchAllPages(
          `${GRAPH_URL}/${form.id}/leads?fields=id,created_time,field_data,ad_id&filtering=${filtering}&limit=100&access_token=${page.accessToken}`,
        );

        for (const lead of leads) {
          const fields = parseLeadFields(lead.field_data);
          const syncedLead: SyncedLead = {
            leadgenId: lead.id,
            customerId: page.customerId.toString(),
            pageId: page.pageId,
            formId: form.id,
            ...fields,
            metaCreatedAt: new Date(lead.created_time),
          };

          const isNew = await this.metaLeadsService.saveLeadIfNew({ ...syncedLead, adId: lead.ad_id });
          if (isNew) result.newLeads.push(syncedLead);
        }
      } catch (error) {
        pageFailed = true;
        this.logger.error(`Failed to fetch leads for form ${form.id} (Page ${page.pageId}): ${error.message}`);
        result.errors.push({ pageId: page.pageId, formId: form.id, error: error.message });
      }
    }

    // Only advance the watermark when every form was read, so a failed
    // form is retried from the same point on the next run.
    if (!pageFailed) {
      await this.connectedPagesRepository.setLastLeadSyncAt(page.pageId, syncStartedAt);
    }
  }

  /** GETs a Graph API edge and follows `paging.next` until all results are collected. */
  private async fetchAllPages(url: string): Promise<any[]> {
    const items: any[] = [];
    let next: string | undefined = url;

    while (next) {
      const res: Response = await fetch(next);
      const data: any = await res.json();
      if (data.error) throw new Error(`${data.error.code}: ${data.error.message}`);

      items.push(...(data.data || []));
      next = data.paging?.next;
    }

    return items;
  }
}
