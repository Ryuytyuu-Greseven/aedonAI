import { Injectable, Logger, HttpException, HttpStatus } from '@nestjs/common';
import * as crypto from 'crypto';

import { ConnectedPagesRepository } from '../repos/connected-pages.repository';
import { MetaLeadsService } from './meta-leads.service';
import { parseLeadFields } from './parse-lead-fields';

@Injectable()
export class MetaService {
  private readonly logger = new Logger(MetaService.name);
  private readonly appId = process.env.META_APP_ID;
  private readonly appSecret = process.env.META_APP_SECRET as string;
  private readonly redirectUri =
    process.env.META_REDIRECT_URI || 'http://localhost:4310/admin-settings/meta-integration/callback';

  constructor(
    private readonly connectedPagesRepository: ConnectedPagesRepository,
    private readonly metaLeadsService: MetaLeadsService,
  ) { }

  /**
   * 1. Exchange OAuth code for User token, upgrade to Long-Lived, fetch Pages, and auto-subscribe
   */
  async handleOAuthExchange(code: string, customerId: string) {
    try {
      // Step A: Short-lived code to short-lived user token
      const tokenUrl = `https://graph.facebook.com/v22.0/oauth/access_token?client_id=${this.appId}&redirect_uri=${encodeURIComponent(this.redirectUri)}&client_secret=${this.appSecret}&code=${code}`;
      const tokenRes = await fetch(tokenUrl);
      const tokenData = await tokenRes.json();

      if (tokenData.error) throw new Error(tokenData.error.message);

      // Step B: Exchange for Long-Lived User Token (~60 days)
      const longLivedUrl = `https://graph.facebook.com/v22.0/oauth/access_token?grant_type=fb_exchange_token&client_id=${this.appId}&client_secret=${this.appSecret}&fb_exchange_token=${tokenData.access_token}`;
      const longRes = await fetch(longLivedUrl);
      const longData = await longRes.json();

      if (longData.error) throw new Error(longData.error.message);

      // Step C: Fetch Managed Pages (Tokens obtained here are PERMANENT Page Tokens)
      const accountsUrl = `https://graph.facebook.com/v22.0/me/accounts?access_token=${longData.access_token}`;
      const accRes = await fetch(accountsUrl);
      const accData = await accRes.json();

      if (accData.error) throw new Error(accData.error.message);

      const savedPages: { id: string; name: string }[] = [];
      for (const page of accData.data) {
        // Step D: Auto-subscribe Page to leadgen webhooks
        const subUrl = `https://graph.facebook.com/v22.0/${page.id}/subscribed_apps?subscribed_fields=leadgen&access_token=${page.access_token}`;
        const subRes = await fetch(subUrl, { method: 'POST' });
        const subData = await subRes.json();

        if (!subData.success) {
          this.logger.warn(`Failed to auto-subscribe page ${page.id}: ${JSON.stringify(subData)}`);
        }

        // Upsert to MongoDB — matches on pageId only (unique), so a given
        // Page is always updated in place, never duplicated, even if it
        // moves between customers.
        const updated = await this.connectedPagesRepository.upsertByPageId({
          customerId,
          pageId: page.id,
          pageName: page.name,
          accessToken: page.access_token,
          isActive: true,
        });

        savedPages.push({ id: updated.pageId, name: updated.pageName });
      }

      console.log('Saved Pages:::', savedPages, accData);
      return { success: true, pages: savedPages };
    } catch (error) {
      this.logger.error(`OAuth Exchange Error: ${error.message}`);
      throw new HttpException(error.message, HttpStatus.BAD_REQUEST);
    }
  }

  /**
   * 2. Verify X-Hub-Signature-256 for incoming Webhooks
   */
  verifySignature(rawBody: Buffer, signatureHeader: string): boolean {
    if (!signatureHeader) return false;

    const expectedSignature =
      'sha256=' + crypto.createHmac('sha256', this.appSecret).update(rawBody).digest('hex');

    const signatureBuffer = Buffer.from(signatureHeader);
    const expectedBuffer = Buffer.from(expectedSignature);

    // timingSafeEqual throws on mismatched lengths, so guard first
    if (signatureBuffer.length !== expectedBuffer.length) return false;

    return crypto.timingSafeEqual(signatureBuffer, expectedBuffer);
  }

  /**
   * 3. Process Webhook Payload and Fetch Lead Data via Graph API
   */
  async processWebhookNotification(body: any) {
    if (body.object !== 'page') return;

    console.log('Processing webhook for page connection', body);
    for (const entry of body.entry) {
      for (const change of entry.changes) {
        console.log(change);
        if (change.field === 'leadgen') {
          const { leadgen_id, form_id, page_id, ad_id, adgroup_id, created_time } = change.value;

          // Fetch Client Token from DB using page_id
          const pageRecord = await this.connectedPagesRepository.findActiveByPageId(page_id);
          if (!pageRecord) {
            this.logger.error(`Webhook received for unknown or inactive Page ID: ${page_id}`);
            continue;
          }

          // Query Graph API for actual lead content
          const leadUrl = `https://graph.facebook.com/v22.0/${leadgen_id}?fields=field_data,created_time&access_token=${pageRecord.accessToken}`;
          const leadRes = await fetch(leadUrl);
          const leadData = await leadRes.json();

          if (leadData.error) {
            this.logger.error(`Graph API Fetch Error for lead ${leadgen_id}: ${JSON.stringify(leadData.error)}`);
            continue;
          }

          const { fullName, phoneNumber, email, customFields } = parseLeadFields(leadData.field_data);

          // Save to the meta_leads collection
          await this.metaLeadsService.saveLead({
            customerId: pageRecord.customerId.toString(),
            pageId: page_id,
            leadgenId: leadgen_id,
            formId: form_id,
            adId: ad_id,
            adgroupId: adgroup_id,
            fullName,
            phoneNumber,
            email,
            customFields,
            metaCreatedAt: new Date(created_time * 1000),
          });

          this.logger.log(`Successfully ingested lead ${leadgen_id} for Page ${page_id}`);
        }
      }
    }
  }
}
