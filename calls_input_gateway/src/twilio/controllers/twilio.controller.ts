import { Controller, Post, Body, Query, Res, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TwilioService } from '../twilio.service';
import { BusinessDirectoryService } from '../../common/services/business-directory.service';
import { DEFAULT_BUSINESS } from '../../common/config/business-agents.registry';

/**
 * Twilio webhooks. Outbound calls are placed by OutboundCallsController
 * (POST /calls, or the legacy POST /twilio/call), which picks the carrier.
 */
@Controller('twilio')
export class TwilioController {
  private readonly logger = new Logger(TwilioController.name);

  constructor(
    private readonly twilioService: TwilioService,
    private readonly configService: ConfigService,
    private readonly businessDirectoryService: BusinessDirectoryService,
  ) {}

  /**
   * Twilio Voice Webhook — configure this URL in the Twilio Console
   * (Phone Numbers → Active Numbers → Voice → A call comes in → Webhook).
   *
   * Responds with TwiML that connects the call to our Media Streams WebSocket.
   *
   * Business resolution order:
   *   1. `?business=` query param — set by us when we place outbound calls
   *      (see TwilioService.makeOutboundCall), so it always wins when present.
   *   2. The called number (`To` in the webhook body) looked up against the
   *      business→number directory — this is how genuine inbound calls,
   *      placed straight to a business's number, get routed.
   *   3. DEFAULT_BUSINESS.
   *
   * Query params (optional, can be baked into the URL when creating outbound calls):
   *   ?business=customer+support&voice=Aoede&systemInstruction=...
   */
  @Post('voice')
  handleVoice(
    @Body()
    body: { To?: string; From?: string; CallSid?: string; Direction?: string },
    @Query('business') businessOverride: string | undefined,
    @Query('voice') voice = 'Aoede',
    @Query('systemInstruction') systemInstruction = '',
    @Query('channel') channel: string | undefined,
    @Res() res: any,
  ): void {
    const calledNumber = body?.To;
    const business =
      businessOverride ??
      this.businessDirectoryService.resolveBusinessForNumber(calledNumber) ??
      DEFAULT_BUSINESS;

    // Twilio sends `Direction` on every voice webhook — 'inbound' for calls
    // dialed straight to our number, 'outbound-api'/'outbound-dial' for
    // calls we placed via TwilioService.makeOutboundCall.
    const direction = body.Direction?.toLowerCase().startsWith('outbound')
      ? 'outbound'
      : 'inbound';
    const customerNumber = direction === 'outbound' ? body.To : body.From;
    const businessNumber = direction === 'outbound' ? body.From : body.To;

    const wsBase =
      this.configService.get<string>('TWILIO_WS_URL') ??
      'wss://your-domain.com';
    const wsUrl = `${wsBase}/twilio`;

    const twiml = this.twilioService.buildTwiml(wsUrl, {
      business,
      voice,
      systemInstruction,
      direction,
      ...(customerNumber ? { customerNumber } : {}),
      ...(businessNumber ? { businessNumber } : {}),
      ...(channel === 'preview' ? { channel } : {}),
    });

    this.logger.log(
      `[Voice Webhook] to=${calledNumber} → business=${business} direction=${direction} → ${wsUrl}`,
    );
    res.set('Content-Type', 'text/xml');
    res.send(twiml);
  }

  /**
   * Twilio status callback — receives call lifecycle events (initiated, ringing,
   * in-progress, completed, failed, etc.). Configure as statusCallback in REST API calls.
   */
  @Post('status')
  handleStatus(@Body() body: any): { received: boolean } {
    this.logger.log(
      `[Status Callback] CallSid=${body.CallSid} Status=${body.CallStatus}`,
    );
    // To-DO-2: Call ended or answered, we can log somehwere
    return { received: true };
  }

  @Post('/health')
  checkMyDetails(@Body() body: { sample: boolean }) {
    this.logger.log('Hello from ', body);
    return { success: true };
  }
}
