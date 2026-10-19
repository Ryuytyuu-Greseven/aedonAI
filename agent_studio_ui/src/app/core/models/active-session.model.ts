import { CallDirection } from './call-record.model';

export interface ActiveSession {
  id: string;
  agentId: string;
  customerName: string;
  phoneNumber: string;
  direction: CallDirection;
  startedAt: string;
}

export interface LiveMessage {
  id: string;
  speaker: 'agent' | 'customer';
  text: string;
  at: string;
}
