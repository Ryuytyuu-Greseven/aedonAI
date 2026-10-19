import { BadGatewayException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosError } from 'axios';
import { PreviewCallDto } from './dto/preview-call.dto';

type PreviewMode = 'call' | 'chat' | 'webcall';

@Injectable()
export class PreviewService {
  private readonly logger = new Logger(PreviewService.name);

  constructor(private readonly config: ConfigService) {}

  call(dto: PreviewCallDto): Promise<unknown> {
    return this.dispatch('call', dto);
  }

  chat(dto: PreviewCallDto): Promise<unknown> {
    return this.dispatch('chat', dto);
  }

  webcall(dto: PreviewCallDto): Promise<unknown> {
    return this.dispatch('webcall', dto);
  }

  /**
   * Forwards the preview request to the audio processor, which owns the actual
   * Twilio call/chat/webcall lifecycle. This server only relays call details.
   */
  private async dispatch(
    mode: PreviewMode,
    dto: PreviewCallDto,
  ): Promise<unknown> {
    const baseUrl = this.config
      .getOrThrow<string>('AUDIO_PROCESSOR_URL')
      .replace(/\/+$/, '');
    const url = `${baseUrl}/twilio/${mode}`;

    const payload = {
      business: dto.business,
      agentId: dto.agentId,
      to: dto.countryCode + dto.phone,
      from: '',
    };

    try {
      const { data } = await axios.post<unknown>(url, payload, {
        headers: { 'Content-Type': 'application/json' },
      });
      return data;
    } catch (error) {
      if (error instanceof AxiosError && error.response) {
        this.logger.error(
          `Audio processor responded with ${error.response.status} for ${url}: ${JSON.stringify(
            error.response.data,
          )}`,
        );
        throw new BadGatewayException({
          message: 'Audio processor rejected the preview request',
          status: error.response.status,
          details: error.response.data as unknown,
        });
      }

      this.logger.error(
        `Failed to reach audio processor at ${url}`,
        error instanceof Error ? error.stack : String(error),
      );
      throw new BadGatewayException('Failed to reach the audio processor');
    }
  }
}
