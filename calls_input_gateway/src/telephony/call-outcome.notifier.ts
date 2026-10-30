import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { TelephonyProvider } from './telephony.types';

/** How a call ended, from the dialer's point of view: anything not answered is missed. */
export type CallOutcome = 'answered' | 'missed';

/**
 * Reports how each call ended to meta-adapter (the lead dialer), which
 * records it on the lead and schedules missed-call retries. Calls it didn't
 * place (inbound, previews) are ignored there. Best-effort: a failure is
 * logged, never surfaced to the carrier's webhook.
 */
@Injectable()
export class CallOutcomeNotifier {
  private readonly logger = new Logger(CallOutcomeNotifier.name);

  constructor(private readonly configService: ConfigService) {}

  notify(
    provider: TelephonyProvider,
    callSid: string,
    outcome: CallOutcome,
    providerStatus: string,
  ): void {
    const baseUrl = this.configService
      .get<string>('META_ADAPTER_URL')
      ?.replace(/\/+$/, '');
    if (!baseUrl) return;

    axios
      .post(
        `${baseUrl}/calls/status`,
        { provider, callSid, outcome, providerStatus },
        {
          headers: {
            'x-internal-api-key':
              this.configService.get<string>('INTERNAL_API_KEY') ?? '',
          },
          timeout: 10_000,
        },
      )
      .catch((error: unknown) => {
        this.logger.warn(
          `Could not report ${provider} call ${callSid} (${providerStatus}) to meta-adapter: ${error instanceof Error ? error.message : String(error)}`,
        );
      });
  }
}
