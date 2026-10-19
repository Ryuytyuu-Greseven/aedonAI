import {
  CallDirection,
  CallProvider,
} from '../../call-logs/interfaces/call-log.interface';

export interface UserConfig {
  model: string;
  voice: string;
  systemInstruction: string;
  business?: string;

  /**
   * Which of the three session modes this is — real Twilio/Exotel phone
   * call, or a browser/WebRTC test session. Defaults to 'webrtc' when a
   * gateway doesn't specify one (the /ws AssistantGateway path).
   */
  provider?: CallProvider;
  /**
   * Call-log identifier: the real Twilio/Exotel CallSid for telephony
   * sessions, or the internal sessionId for webrtc sessions (filled in by
   * AssistantService if not provided).
   */
  callId?: string;
  direction?: CallDirection;
  /** Customer's phone number — telephony (twilio/exotel) sessions only. */
  phoneNumber?: string;
  /** Business's phone number — telephony (twilio/exotel) sessions only. */
  agentNumber?: string;
  /**
   * Id of the agent *invocation* handling this session — supplied by the
   * client in the `setup` message for webrtc/chat sessions; a fixed
   * placeholder for twilio/exotel calls until those carry a real one too.
   * Distinct from `business`, which identifies the agent *template*.
   */
  agentId: string;
}

export interface SessionState {
  config: UserConfig;
  sessionId: string;
  speechStarted: boolean;
  silenceStartTimestamp: number;
  audioChunks: Buffer[];
  isGenerating: boolean;
  isProcessingQueue: boolean;
  turnInterrupted: boolean;
  abortTts?: (() => void) | null;
  accumulatedTranscript: string;
  lastSegmentHadSpeech: boolean;
  isTranscribing: boolean;
  segmentIndex: number;
  queryQueue: string[];
  /** Last language detected from the user's speech: 'en' | 'hi' | 'te' | 'ta' | 'kn'. */
  language: string;
  /**
   * Mongo _id (as string) of the Agent doc resolved for this session in
   * initiateAgentState — set once, read back in cleanupSession (to remove
   * this session from Agent.active_sessions) and in
   * applyAgentUpdateToActiveSessions (to match sessions belonging to an
   * edited agent). Undefined if no Agent doc resolved for this session.
   */
  agentMongoId?: string;
}
