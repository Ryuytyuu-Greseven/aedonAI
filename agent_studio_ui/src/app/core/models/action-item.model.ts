import { CallDirection, CallRecord } from './call-record.model';

export type ActionItemType = 'callback' | 'issue';
export type ActionItemStatus = 'open' | 'done';

export interface ActionItem {
  id: string;
  agent_id: string;
  call: CallRecord;
  customer_name: string | null;
  phone_number: string;
  direction: CallDirection;
  type: ActionItemType;
  summary: string;
  action_needed: string;
  due_at: string | null;
  status: ActionItemStatus;
  created_at: string;
}
