import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { AgentDocument } from '../schemas/agent.schema';

/** Places outbound lead calls through calls_input_gateway (Meta and manual leads alike). */
@Injectable()
export class CallsGatewayClient {
  constructor(private readonly configService: ConfigService) { }

  /** CALLS_GATEWAY_URL without a trailing slash, or undefined when calling isn't configured. */
  baseUrl(): string | undefined {
    return this.configService.get<string>('CALLS_GATEWAY_URL')?.replace(/\/+$/, '');
  }

  /** POST {CALLS_GATEWAY_URL}/twilio/call — returns the provider's call id. */
  async placeCall(gatewayUrl: string, to: string, agent: AgentDocument): Promise<string> {
    const res = await fetch(`${gatewayUrl}/twilio/call`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // The gateway rejects outbound-call requests without its internal key
        'x-internal-api-key': this.configService.get<string>('CALLS_GATEWAY_API_KEY') ?? '',
      },
      body: JSON.stringify({
        to,
        from: agent.phone_number,
        business: agent.base_template_id,
        agentId: agent.agent_id,
      }),
    });

    const data: any = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(`Gateway responded ${res.status}: ${JSON.stringify(data)}`);
    if (!data.callSid) throw new Error(`Gateway returned no callSid: ${JSON.stringify(data)}`);
    return data.callSid;
  }
}
