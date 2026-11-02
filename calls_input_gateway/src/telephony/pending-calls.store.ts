import { Injectable } from '@nestjs/common';
import { CacheService } from '../common/services/cache.service';
import { CallContext, TelephonyProvider } from './telephony.types';

// Covers ringing + answer time; an unanswered call's entry just expires.
const PENDING_CALL_TTL_SECONDS = 10 * 60;

interface PendingCall {
  callSid: string;
  context: CallContext;
}

/**
 * Hands an outbound call's context from the REST request that placed it to
 * the media-stream WebSocket that later serves it.
 *
 * Needed for carriers whose stream can't carry our call details: Exotel
 * allows only 3 short stream-URL params and may strip them on outbound calls.
 * Entries are keyed by call sid, and by customer number as a fallback in case
 * the stream reports a different sid than the create-call response.
 */
@Injectable()
export class PendingCallsStore {
  constructor(private readonly cache: CacheService) {}

  save(callSid: string, context: CallContext): void {
    const entry: PendingCall = { callSid, context };
    this.cache.set(this.sidKey(context.provider, callSid), entry, PENDING_CALL_TTL_SECONDS);
    if (context.customerNumber) {
      this.cache.set(
        this.numberKey(context.provider, context.customerNumber),
        entry,
        PENDING_CALL_TTL_SECONDS,
      );
    }
  }

  /**
   * Looks up and removes a pending call — by sid first, then by each of the
   * candidate customer numbers.
   */
  take(
    provider: TelephonyProvider,
    callSid: string | undefined,
    customerNumbers: Array<string | undefined>,
  ): CallContext | undefined {
    const keys = [
      ...(callSid ? [this.sidKey(provider, callSid)] : []),
      ...customerNumbers
        .filter((n): n is string => !!n)
        .map((n) => this.numberKey(provider, n)),
    ];
    for (const key of keys) {
      const entry = this.cache.get<PendingCall>(key);
      if (entry) {
        this.remove(entry);
        return entry.context;
      }
    }
    return undefined;
  }

  /** Drops a pending call that will never stream (busy, no-answer, failed). */
  discard(provider: TelephonyProvider, callSid: string): void {
    const entry = this.cache.get<PendingCall>(this.sidKey(provider, callSid));
    if (entry) this.remove(entry);
  }

  private remove(entry: PendingCall): void {
    const { provider, customerNumber } = entry.context;
    this.cache.del(this.sidKey(provider, entry.callSid));
    if (customerNumber) this.cache.del(this.numberKey(provider, customerNumber));
  }

  private sidKey(provider: TelephonyProvider, callSid: string): string {
    return `pending-call:${provider}:sid:${callSid}`;
  }

  private numberKey(provider: TelephonyProvider, number: string): string {
    return `pending-call:${provider}:number:${number}`;
  }
}
