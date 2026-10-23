import type {
  CallSummary,
  CallTranscript,
} from '../common/interfaces/call-logs.interface';
import type { CallLog } from '../schemas/call-logs.schema';
import type { CallLogListRow } from '../repos/call-records.repository';

type CallLogFields = Omit<CallLog, 'call_conversation'>;

function durationSeconds(log: CallLogFields): number | null {
  if (!log.ending_time) return null;
  const ms =
    new Date(log.ending_time).getTime() - new Date(log.starting_time).getTime();
  return Math.max(0, Math.round(ms / 1000));
}

function customerName(log: CallLogFields): string | null {
  const name = log.customer_details?.name;
  return typeof name === 'string' && name.trim() ? name.trim() : null;
}

function summaryOf(log: CallLogFields, messageCount: number): CallSummary {
  return {
    id: String(log._id),
    agent_id: log.agent_id,
    provider: log.provider,
    direction: log.direction,
    status: log.status,
    occurred_at: log.starting_time,
    ended_at: log.ending_time ?? null,
    duration_seconds: durationSeconds(log),
    // Web (playground) calls store the business's own number here, not a
    // customer's — don't present it as the caller.
    phone_number:
      log.provider === 'webrtc' ? null : (log.phone_number ?? null) || null,
    customer_name: customerName(log),
    message_count: messageCount,
    summary: log.call_summary ?? null,
  };
}

export function toCallSummary(row: CallLogListRow): CallSummary {
  return summaryOf(row, row.message_count);
}

export function toCallTranscript(log: CallLog): CallTranscript {
  const conversation = log.call_conversation ?? [];
  return {
    ...summaryOf(log, conversation.length),
    messages: [...conversation]
      .sort(
        (a, b) =>
          new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
      )
      .map((entry) => ({
        id: entry.id,
        speaker: entry.speaker,
        text: entry.message,
        at: entry.timestamp,
      })),
  };
}
