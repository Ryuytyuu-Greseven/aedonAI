import { Controller, Post, Body, Query, Res, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TwilioService } from '../twilio.service';
import { ExotelService } from '../../exotel/exotel.service';
import { BusinessDirectoryService } from '../../common/services/business-directory.service';
import { DEFAULT_BUSINESS } from '../../common/config/business-agents.registry';

@Controller('twilio')
export class TwilioController {
  private readonly logger = new Logger(TwilioController.name);

  constructor(
    private readonly twilioService: TwilioService,
    private readonly exotelService: ExotelService,
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
      provider: 'twilio',
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

  /**
   * REST endpoint to trigger an outbound call from your backend.
   * POST /twilio/call  { "to": "+919876543210", "business": "sales", "voice": "Aoede" }
   */
  @Post('call')
  async initiateCall(
    @Body()
    body: {
      to: string;
      business?: string;
      voice?: string;
      systemInstruction?: string;
      from?: string;
      /** 'preview' when placed by the agent_studio playground. */
      channel?: string;
    },
  ): Promise<{ callSid: string; provider: string }> {
    // const provider = resolveProvider(body.to);
    const provider = 'twilio';
    this.logger.log(`Initiating call to ${body.to} via ${provider}`);

    // if (provider === 'exotel') {
    //   const callSid = await this.exotelService.makeOutboundCall(body.to, {
    //     business: body.business,
    //     voice: body.voice,
    //     systemInstruction: body.systemInstruction,
    //   }).catch((eeor) => {
    //     this.logger.log('Exceprion');
    //   });
    //   return { callSid: '', provider };
    // }

    try {
      const callSid = await this.twilioService.makeOutboundCall(body.to, {
        business: body.business,
        voice: body.voice,
        systemInstruction: body.systemInstruction,
        from: body.from,
        channel: body.channel,
      });
      return { callSid, provider };
    } catch (error) {
      this.logger.error('Error initiating call:', error);
      throw error;
    }
  }

  @Post('/health')
  checkMyDetails(@Body() body: { sample: boolean }) {
    this.logger.log('Hello from ', body);
    return { success: true };
  }
}

/** Route to Exotel for India (+91), Twilio for US (+1) and everywhere else. */
// function resolveProvider(to: string): 'twilio' | 'exotel' {
//   if (to.startsWith('+91')) return 'exotel';
//   return 'twilio';
// }
