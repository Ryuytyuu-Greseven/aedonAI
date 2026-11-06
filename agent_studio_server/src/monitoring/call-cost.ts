import type {
  CallCost,
  CallUsage,
  LlmUsage,
} from "../common/interfaces/call-logs.interface";
import type { CallLog } from "../schemas/call-logs.schema";

/**
 * Prices a call from the usage the gateway (and the agent's post-call
 * analysis) recorded on its call log. Usage is stored raw and priced here at
 * read time, so changing a rate below reprices every call — nothing to
 * migrate.
 *
 * Rates are list prices in USD (looked up 2026-11-02). Telephony is an
 * estimate: carriers bill per started minute at destination-specific rates —
 * replace with the rates on your Twilio/Exotel dashboards.
 */
export const USD_INR = 88;

const INR = (rupees: number) => rupees / USD_INR;

/** Per second of audio streamed (per connection). */
const STT_PER_SECOND: Record<string, number> = {
  sarvam: INR(30) / 3600, // saaras:v4 — ₹30 / hour
  deepgram: 0.0092 / 60, // nova-3 multilingual — $0.0092 / min
  google: 0.016 / 60, // chirp_3 — $0.016 / min
};

/** Per character sent for synthesis. */
const TTS_PER_CHARACTER: Record<string, number> = {
  sarvam: INR(20) / 10_000, // bulbul:v4-flash — ₹20 / 10K chars
  google: 30 / 1_000_000, // Chirp3-HD — $30 / 1M chars
  openai: 15 / 1_000_000, // tts-1 — $15 / 1M chars
};

/** Per 1M tokens; output includes thinking tokens. */
const LLM_PER_MILLION: Record<string, { input: number; output: number }> = {
  "gemini-3.1-flash-lite": { input: 0.25, output: 1.5 },
};

/** Per started minute. Twilio outbound is keyed by the dialled country code. */
const EXOTEL_PER_MINUTE = INR(0.8); // + voice streaming, billed separately by Exotel
const TWILIO_INBOUND_PER_MINUTE = 0.0085;
const TWILIO_STREAM_PER_MINUTE = 0.004; // Media Streams
const TWILIO_OUTBOUND_PER_MINUTE: Array<[prefix: string, rate: number]> = [
  ["+971", 0.2995], // UAE mobile
  ["+1", 0.014],
];
const TWILIO_OUTBOUND_DEFAULT = 0.1;

export function priceCall(
  log: Omit<CallLog, "call_conversation">,
): CallCost | null {
  const usage = log.usage as CallUsage | null | undefined;
  if (!usage || !log.ending_time) return null;

  const unpriced = new Set<string>();
  const rated = (
    rates: Record<string, number>,
    key: string,
    amount: number,
  ) => {
    const rate = rates[key];
    if (rate === undefined) unpriced.add(key);
    return (rate ?? 0) * amount;
  };
  const llmCost = (lines: LlmUsage[] | undefined) =>
    (lines ?? []).reduce((sum, l) => {
      const rate = LLM_PER_MILLION[l.model];
      if (!rate) {
        unpriced.add(l.model);
        return sum;
      }
      return (
        sum +
        (l.input_tokens * rate.input + l.output_tokens * rate.output) /
          1_000_000
      );
    }, 0);

  const seconds =
    (new Date(log.ending_time).getTime() -
      new Date(log.starting_time).getTime()) /
    1000;
  const minutes = Math.max(0, seconds) / 60;

  const telephony = telephonyCost(log, Math.ceil(minutes));
  const stt = (usage.stt ?? []).reduce(
    (s, u) => s + rated(STT_PER_SECOND, u.provider, u.seconds),
    0,
  );
  const tts = (usage.tts ?? []).reduce(
    (s, u) => s + rated(TTS_PER_CHARACTER, u.provider, u.characters),
    0,
  );
  const llm = llmCost(usage.llm);
  const analysis = llmCost(usage.analysis_llm);
  const total = telephony + stt + tts + llm + analysis;

  return {
    currency: "USD",
    telephony: round(telephony),
    stt: round(stt),
    tts: round(tts),
    llm: round(llm),
    analysis: round(analysis),
    total: round(total),
    total_inr: Math.round(total * USD_INR * 100) / 100,
    per_minute: minutes > 0 ? round(total / minutes) : null,
    unpriced: [...unpriced],
  };
}

function telephonyCost(
  log: Omit<CallLog, "call_conversation">,
  billedMinutes: number,
): number {
  if (log.provider === "exotel") return billedMinutes * EXOTEL_PER_MINUTE;
  if (log.provider !== "twilio") return 0; // web calls use no carrier
  const leg =
    log.direction === "inbound"
      ? TWILIO_INBOUND_PER_MINUTE
      : (TWILIO_OUTBOUND_PER_MINUTE.find(([prefix]) =>
          log.phone_number?.startsWith(prefix),
        )?.[1] ?? TWILIO_OUTBOUND_DEFAULT);
  return billedMinutes * (leg + TWILIO_STREAM_PER_MINUTE);
}

// Sub-cent amounts matter at per-minute scale — keep 5 decimals of a dollar.
const round = (usd: number) => Math.round(usd * 100_000) / 100_000;
