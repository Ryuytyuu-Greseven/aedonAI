import { BadRequestException, Controller, Get, Post, Body, Param, Query, Req, Res, Headers, HttpStatus, UseGuards } from '@nestjs/common';
import type { RawBodyRequest } from '@nestjs/common';
import type { Request, Response } from 'express';

import { MetaService } from './meta.service';
import { MetaLeadSyncService } from './meta-lead-sync.service';
import { MetaLeadCallService } from './meta-lead-call.service';
import { OAuthExchangeDto } from './dto/oauth-exchange.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { InternalApiKeyGuard } from '../auth/guards/internal-api-key.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../common/interfaces/user.interface';

@Controller('meta')
export class MetaController {
  constructor(
    private readonly metaService: MetaService,
    private readonly metaLeadSyncService: MetaLeadSyncService,
    private readonly metaLeadCallService: MetaLeadCallService,
  ) { }

  /**
   * OAuth Callback Exchange Endpoint. customerId always comes from the
   * caller's verified JWT (companyId) — never from the request body, since
   * a client-supplied customerId would let one tenant attach its Facebook
   * connection to another tenant's account.
   */
  @Post('oauth/exchange')
  @UseGuards(JwtAuthGuard)
  async exchangeToken(@Body() dto: OAuthExchangeDto, @CurrentUser() user: AuthenticatedUser) {
    if (!user.companyId) {
      throw new BadRequestException('User is not associated with a company');
    }
    return await this.metaService.handleOAuthExchange(dto.code, user.companyId);
  }

  /**
   * Polling fallback for the leadgen webhook, called by the external cron.
   * Pulls leads for all active Pages (or one customer's Pages via
   * ?customerId=) and returns only the leads that were newly stored.
   */
  @Post('leads/sync')
  @UseGuards(InternalApiKeyGuard)
  async syncLeads(@Query('customerId') customerId?: string) {
    return await this.metaLeadSyncService.syncLeads(customerId);
  }

  /**
   * Manually calls one lead from the leads page — the way to reach leads
   * past the auto-call window or whose auto-call failed. Uses the lead's
   * Page's current agent; scoped to the caller's company (JWT companyId).
   */
  @Post('leads/:leadgenId/call')
  @UseGuards(JwtAuthGuard)
  async callLead(@Param('leadgenId') leadgenId: string, @CurrentUser() user: AuthenticatedUser) {
    if (!user.companyId) {
      throw new BadRequestException('User is not associated with a company');
    }
    return await this.metaLeadCallService.callLeadManually(leadgenId, user.companyId);
  }

  /**
   * Meta Webhook Challenge Verification (GET)
   */
  @Get('webhook')
  verifyWebhook(
    @Query('hub.mode') mode: string,
    @Query('hub.verify_token') token: string,
    @Query('hub.challenge') challenge: string,
    @Res() res: Response,
  ) {
    const verifyToken = process.env.META_VERIFY_TOKEN;
    if (mode === 'subscribe' && token === verifyToken) {
      console.log('Verification enabled');
      return res.status(HttpStatus.OK).send(challenge);
    }
    return res.sendStatus(HttpStatus.FORBIDDEN);
  }

  /**
   * Meta Webhook Ingestion Endpoint (POST)
   */
  @Post('webhook')
  async handleWebhook(
    @Req() req: RawBodyRequest<Request>,
    @Res() res: Response,
    @Headers('x-hub-signature-256') signature: string,
  ) {
    // Always respond 200 immediately to prevent Meta timeout retries
    res.status(HttpStatus.OK).send('EVENT_RECEIVED');

    const rawBody = req.rawBody;
    if (!rawBody || !this.metaService.verifySignature(rawBody, signature)) {
      console.warn('Invalid or missing Meta Webhook Signature');
      return;
    }

    // Process asynchronously in the background
    this.metaService.processWebhookNotification(req.body).catch((err) => {
      console.error('Async webhook processing error:', err);
    });
  }
}
