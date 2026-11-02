import {
  CallChannel,
  CallDirection,
  CallProvider,
} from '../call-logs/interfaces/call-log.interface';

/** Phone carriers — every CallProvider except the browser/webrtc path. */
export type TelephonyProvider = Exclude<CallProvider, 'webrtc'>;

/** Format of the caller audio a carrier streams in (fed straight to STT). */
export interface CarrierAudioFormat {
  encoding: 'LINEAR16' | 'MULAW';
  sampleRateHertz: number;
}

/**
 * Everything the assistant needs to know about a phone call, independent of
 * which carrier delivered it. Twilio carries it through TwiML <Parameter>s;
 * Exotel through PendingCallsStore (outbound) or the start event (inbound).
 */
export interface CallContext {
  provider: TelephonyProvider;
  direction: CallDirection;
  /** Agent template id — picks the domain agent server. */
  business: string;
  voice: string;
  systemInstruction: string;
  customerNumber?: string;
  /** The business's own number — resolves the Agent doc. */
  businessNumber?: string;
  channel?: CallChannel;
  /** Agent doc's agent_id, when the caller of the outbound API knows it. */
  agentId?: string;
}

/**
 * What AssistantService sees of a phone call: the same readyState/send shape
 * as a /ws browser socket, so the assistant pipeline stays carrier-agnostic.
 * `streamSid` doubles as the AudioDriver/STT session key.
 */
export interface CarrierClient {
  readonly streamSid: string;
  readonly callSid: string;
  readonly readyState: number;
  send(data: string): void;
  hangup?: () => Promise<void> | void;
}

export interface OutboundCallRequest {
  to: string;
  /** Business number to call from; carrier default when empty. */
  from?: string;
  business?: string;
  voice?: string;
  systemInstruction?: string;
  /** 'preview' when placed by the agent_studio playground. */
  channel?: string;
  agentId?: string;
  /** Forces a carrier instead of picking one from the numbers. */
  provider?: TelephonyProvider;
}

export interface OutboundCallResult {
  callSid: string;
  provider: TelephonyProvider;
}
