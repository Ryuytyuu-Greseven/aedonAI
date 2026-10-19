import { Injectable } from '@angular/core';
import { Observable, Subject } from 'rxjs';
import { RealtimeTransport } from './realtime-transport';
import { ConnectionStatus, RealtimeCommand, RealtimeEvent } from './realtime.types';

const CONNECT_DELAY_MS = 200;
const FIRST_MESSAGE_DELAY_MS = 400;
const MESSAGE_DELAY_RANGE_MS: [number, number] = [900, 2200];
const MESSAGE_COUNT_RANGE: [number, number] = [3, 6];
const FAILURE_RATE = 0.15;

const AGENT_LINES = [
  'Hi, thanks for calling — how can I help you today?',
  'Sure, I can help with that. One moment.',
  'Got it. Is there anything else you would like to know?',
  'Thanks for confirming, I have noted that down.',
  'Perfect, I will take care of that for you now.',
];

const CUSTOMER_LINES = [
  'Hi, I had a question about my recent order.',
  'Yes, that sounds right, please go ahead.',
  'Okay, that makes sense, thank you.',
  'Can you also check on the delivery date?',
  'That is all I needed, thanks.',
];

const CHAT_GREETING_DELAY_MS = 500;
const CHAT_REPLY_DELAY_RANGE_MS: [number, number] = [500, 1400];
const CHAT_TOOL_CALL_PROBABILITY = 0.35;
const CHAT_TOOL_CALL_DELAY_RANGE_MS: [number, number] = [300, 700];
const CHAT_TOOL_SUCCESS_RATE = 0.85;

const CHAT_GREETINGS = [
  "Hi! I'm your virtual assistant — how can I help you today?",
  "Hello, thanks for reaching out. What can I do for you?",
];

const CHAT_AGENT_REPLIES = [
  "Got it, let me take a look for you.",
  "Sure, I can help with that.",
  "Thanks for the details — here's what I found.",
  "I've gone ahead and taken care of that.",
  "Is there anything else you'd like help with?",
  "Happy to help with that as well.",
];

interface ChatToolDefinition {
  name: string;
  buildInput: () => Record<string, unknown>;
  buildOutput: (input: Record<string, unknown>) => string;
}

const CHAT_TOOL_LIBRARY: ChatToolDefinition[] = [
  {
    name: 'lookup_customer_account',
    buildInput: () => ({ query: 'current session customer' }),
    buildOutput: () => 'Found account — plan: Premium, status: Active.',
  },
  {
    name: 'create_service_request',
    buildInput: () => ({ issue: 'Reported via chat', priority: 'medium' }),
    buildOutput: () => `Created service request SR-${40000 + Math.floor(Math.random() * 9999)}.`,
  },
  {
    name: 'update_service_request',
    buildInput: () => ({ request_id: `SR-${40000 + Math.floor(Math.random() * 9999)}`, status: 'in_progress' }),
    buildOutput: (input) => `Updated ${input['request_id']} to ${input['status']}.`,
  },
  {
    name: 'cancel_service_request',
    buildInput: () => ({ request_id: `SR-${40000 + Math.floor(Math.random() * 9999)}` }),
    buildOutput: (input) => `Cancelled ${input['request_id']}.`,
  },
];

@Injectable()
export class MockRealtimeTransport implements RealtimeTransport {
  private readonly eventsSubject = new Subject<RealtimeEvent>();
  private readonly statusSubject = new Subject<ConnectionStatus>();

  connect(): Observable<ConnectionStatus> {
    this.statusSubject.next('connecting');
    setTimeout(() => this.statusSubject.next('open'), CONNECT_DELAY_MS);
    return this.statusSubject.asObservable();
  }

  events(): Observable<RealtimeEvent> {
    return this.eventsSubject.asObservable();
  }

  send(command: RealtimeCommand): void {
    if (command.type === 'call.start') {
      this.simulateCall(command.agentId, command.callId);
    } else if (command.type === 'chat.start') {
      this.startChat(command.agentId, command.sessionId);
    } else if (command.type === 'chat.send') {
      this.replyToChat(command.agentId, command.sessionId);
    }
  }

  private simulateCall(agentId: string, callId: string): void {
    let elapsed = FIRST_MESSAGE_DELAY_MS;
    setTimeout(() => this.eventsSubject.next({ type: 'call.started', agentId, callId }), elapsed);

    const messageCount = randomInt(...MESSAGE_COUNT_RANGE);
    for (let i = 0; i < messageCount; i++) {
      elapsed += randomInt(...MESSAGE_DELAY_RANGE_MS);
      const speaker: 'agent' | 'customer' = i % 2 === 0 ? 'agent' : 'customer';
      const lines = speaker === 'agent' ? AGENT_LINES : CUSTOMER_LINES;
      const text = lines[i % lines.length];
      const at = elapsed;
      setTimeout(() => {
        this.eventsSubject.next({
          type: 'call.message',
          agentId,
          callId,
          speaker,
          text,
          at: new Date().toISOString(),
        });
      }, at);
    }

    elapsed += randomInt(...MESSAGE_DELAY_RANGE_MS);
    const outcome: 'completed' | 'failed' = Math.random() < FAILURE_RATE ? 'failed' : 'completed';
    setTimeout(() => {
      this.eventsSubject.next({ type: 'call.ended', agentId, callId, outcome });
    }, elapsed);
  }

  private startChat(agentId: string, sessionId: string): void {
    setTimeout(() => this.eventsSubject.next({ type: 'chat.started', agentId, sessionId }), 100);
    setTimeout(() => {
      this.eventsSubject.next({
        type: 'chat.message',
        agentId,
        sessionId,
        speaker: 'agent',
        text: pick(CHAT_GREETINGS),
        at: new Date().toISOString(),
      });
    }, CHAT_GREETING_DELAY_MS);
  }

  private replyToChat(agentId: string, sessionId: string): void {
    let elapsed = 0;
    if (Math.random() < CHAT_TOOL_CALL_PROBABILITY) {
      elapsed += randomInt(...CHAT_TOOL_CALL_DELAY_RANGE_MS);
      const tool = pick(CHAT_TOOL_LIBRARY);
      const input = tool.buildInput();
      const status: 'success' | 'error' = Math.random() < CHAT_TOOL_SUCCESS_RATE ? 'success' : 'error';
      const output = status === 'success' ? tool.buildOutput(input) : 'Request timed out contacting the internal service.';
      setTimeout(() => {
        this.eventsSubject.next({
          type: 'chat.tool_call',
          agentId,
          sessionId,
          toolName: tool.name,
          input,
          output,
          status,
          at: new Date().toISOString(),
        });
      }, elapsed);
    }

    elapsed += randomInt(...CHAT_REPLY_DELAY_RANGE_MS);
    setTimeout(() => {
      this.eventsSubject.next({
        type: 'chat.message',
        agentId,
        sessionId,
        speaker: 'agent',
        text: pick(CHAT_AGENT_REPLIES),
        at: new Date().toISOString(),
      });
    }, elapsed);
  }
}

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pick<T>(items: readonly T[]): T {
  return items[Math.floor(Math.random() * items.length)];
}
