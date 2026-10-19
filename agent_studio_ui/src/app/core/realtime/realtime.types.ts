export type ConnectionStatus = 'connecting' | 'open' | 'reconnecting' | 'closed';

export type RealtimeEvent =
  | { type: 'call.started'; agentId: string; callId: string }
  | {
      type: 'call.message';
      agentId: string;
      callId: string;
      speaker: 'agent' | 'customer';
      text: string;
      at: string;
    }
  | { type: 'call.ended'; agentId: string; callId: string; outcome: 'completed' | 'failed' }
  | { type: 'chat.started'; agentId: string; sessionId: string }
  | {
      type: 'chat.message';
      agentId: string;
      sessionId: string;
      speaker: 'agent' | 'customer';
      text: string;
      at: string;
    }
  | {
      type: 'chat.tool_call';
      agentId: string;
      sessionId: string;
      toolName: string;
      input: Record<string, unknown>;
      output: string;
      status: 'success' | 'error';
      at: string;
    }
  | { type: 'chat.ended'; agentId: string; sessionId: string; outcome: 'completed' };

export type RealtimeCommand =
  | {
      type: 'call.start';
      agentId: string;
      callId: string;
      phone: { countryCode: string; number: string };
      business?: string;
    }
  | { type: 'chat.start'; agentId: string; sessionId: string }
  | { type: 'chat.send'; agentId: string; sessionId: string; text: string };
