/**
 * Message shapes for the audio_processor voice/chat WebSocket (`/ws`).
 * See websockets.md for the authoritative protocol description.
 */

/** Connection lifecycle exposed to consumers. */
export type AudioProcessorStatus = 'idle' | 'connecting' | 'open' | 'closed' | 'error';

/** Configures the agent and triggers the initial greeting. Sent once after connect. */
export interface AudioProcessorSetup {
  model?: string;
  /** Routes to a domain agent. Send one of `business` or `phoneNumber`. */
  business?: string;
  agentId?: string;
  /** Staging/testing alternative to `business` — resolved to a business server-side. */
  phoneNumber?: string;
  generationConfig?: {
    speechConfig?: {
      voiceConfig?: {
        prebuiltVoiceConfig?: {
          voiceName?: string;
        };
      };
    };
  };
  systemInstruction?: {
    parts: Array<{ text: string }>;
  };
}

/** Client → server messages. */
export type ClientMessage =
  | { setup: AudioProcessorSetup }
  | { realtimeInput: { audio: { data: string } } }
  | { text: string };

/** A single part of a model turn — audio and/or caption text. */
export interface ModelTurnPart {
  inlineData?: {
    mimeType: string;
    data: string;
  };
  text?: string;
}

/** Server → client messages. Every payload is a top-level JSON object. */
export interface ServerMessage {
  error?: string;
  userContent?: {
    text?: string;
  };
  serverContent?: {
    turnStart?: boolean;
    turnComplete?: boolean;
    interrupted?: boolean;
    modelTurn?: {
      parts?: ModelTurnPart[];
    };
  };
}

/** Mic capture format (client → server). */
export const MIC_SAMPLE_RATE = 16000;
/** TTS playback format (server → client). */
export const PLAYBACK_SAMPLE_RATE = 24000;
/** Default TTS voice per websockets.md. */
export const DEFAULT_VOICE_NAME = 'Aoede';
