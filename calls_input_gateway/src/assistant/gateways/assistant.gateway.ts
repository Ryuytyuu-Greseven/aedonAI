import {
  WebSocketGateway,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { AssistantService } from '../services/assistant.service';
import { AudioDriverService } from '../services/audio-driver.service';
import { BusinessDirectoryService } from '../../common/services/business-directory.service';

@WebSocketGateway({ path: '/ws', cors: true })
export class AssistantGateway
  implements OnGatewayConnection, OnGatewayDisconnect {
  private readonly logger = new Logger(AssistantGateway.name);

  constructor(
    private readonly assistantService: AssistantService,
    private readonly audioDriverService: AudioDriverService,
    private readonly businessDirectoryService: BusinessDirectoryService,
  ) { }

  async handleConnection(client: any) {
    // 1. Create session state (config, queue, etc.)
    this.assistantService.initializeSession(client);
    const sessionId = this.assistantService.getSessionId(client);

    // 2. Route incoming WebSocket messages — attached BEFORE the audio
    // driver's async startup below, so a `setup` sent immediately after
    // the socket opens (the normal frontend flow) is never dropped while
    // that await is still in flight.
    client.on('message', (data: any) => {
      try {
        const msg = JSON.parse(data.toString());
        // console.log(msg.setup);

        // Setup config message — configures agent type and triggers greeting.
        // For staging tests without a live call, the frontend can send a
        // `phoneNumber` instead of `business` — it's resolved the same way
        // an inbound Twilio call would be, via BusinessDirectoryService.
        // An explicit `business` always takes priority when both are present.
        if (msg.setup) {
          const business =
            msg.setup.business ??
            this.businessDirectoryService.resolveBusinessForNumber(
              msg.setup.phoneNumber,
            );
          this.assistantService.initiateAgentState(client, {
            ...msg.setup,
            business,
          });
          return;
        }

        // Realtime audio chunks — feed directly into the audio driver
        if (msg.realtimeInput?.audio) {
          const audioBuffer = Buffer.from(
            msg.realtimeInput.audio.data,
            'base64',
          );
          if (sessionId) {
            this.audioDriverService.feedAudio(sessionId, audioBuffer);
          }
          return;
        }

        // Text chat message — skips STT and feeds straight into the same
        // LLM/TTS pipeline voice transcripts use, so text and voice turns
        // in the same session share history/queueing.
        if (typeof msg.text === 'string' && msg.text.trim()) {
          this.assistantService.onTranscriptReady(client, msg.text);
        }
      } catch (err) {
        this.logger.error('Error handling client message:', err);
      }
    });

    client.on('error', (err: any) => {
      this.logger.error('Client WebSocket error:', err);
    });

    // 3. Start the audio driver — keyed by sessionId so it's independent of
    // the WS socket object. Runs after the listener above is attached.
    if (sessionId) {
      await this.audioDriverService.startSession(sessionId, {
        onTranscript: (text, language) =>
          this.assistantService.onTranscriptReady(client, text, language),
        onBargeIn: (transcript) =>
          this.assistantService.handleBargeIn(client, transcript),
      });
    }
  }

  handleDisconnect(client: any): void {
    const sessionId = this.assistantService.getSessionId(client);
    if (sessionId) {
      this.audioDriverService.endSession(sessionId);
    }
    void this.assistantService.cleanupSession(client);
  }
}
