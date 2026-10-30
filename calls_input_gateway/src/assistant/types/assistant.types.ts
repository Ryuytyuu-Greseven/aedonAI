import {
  CallChannel,
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
  /**
   * 'preview' for agent_studio playground calls. Unset means: webrtc
   * sessions are previews, telephony sessions are live — see resolveChannel.
   */
  channel?: CallChannel;
  /** Customer's phone number — telephony (twilio/exotel) sessions only. */
  phoneNumber?: string;
  /** Business's phone number — telephony (twilio/exotel) sessions only. */
  agentNumber?: string;
  /**
   * The Agent doc's `agent_id` — supplied by the client in the `setup`
   * message for webrtc/chat sessions; for twilio/exotel calls it starts
   * empty and initiateAgentState fills it from the Agent resolved by the
   * business number. Distinct from `business`, which identifies the agent
   * *template*.
   */
  agentId: string;
}

/**
 * One piece of the domain agent's reply on its way to TTS. `filler` marks a
 * holding line ("Let me check that for you.") the agent sends while a slow
 * turn is being prepared — spoken immediately, but never logged as part of
 * the reply.
 */
export interface AgentTextChunk {
  text: string;
  filler?: boolean;
  endCall?: boolean;
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
  endCallTriggered?: boolean;
  /** True while this turn has spoken only filler — the reply hasn't started. */
  fillerOnly: boolean;
  /**
   * Set when the caller started speaking during filler-only time and we
   * held off interrupting until their words are known (see handleBargeIn).
   */
  deferredBargeIn: boolean;
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
