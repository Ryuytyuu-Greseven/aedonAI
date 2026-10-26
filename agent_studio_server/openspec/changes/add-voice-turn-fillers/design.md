## Context

**Turn flow today.**
1. The gateway (`calls_input_gateway`) receives a final STT transcript and calls `AgentRouterService.streamFromAgent`.
2. That opens a websocket to the agent and sends `{ type: 'message', text, agentDetails, … }`.
3. The agent (`AgentGateway` → `AgentService.runAgent`) runs the LangGraph sales graph with `stream()` in `updates` mode. It yields each node's finished message (not LLM tokens) as `{ type: 'token', text }`, then `{ type: 'done' }`.
4. The gateway pipes those texts through `splitIntoSentences` into TTS (Sarvam locally, Google in production).

**Measured on staging** (agent Prerana, brochure KB linked, 2026-10-26):

| Turn | Router | Node | Silence |
|---|---|---|---|
| Intro | 1.1 s | 1.9 s | 3.0 s |
| Listing (budget given) | 1.4 s | 2.3 s | 3.6 s |
| Presentation (RAG) | 1.5 s | 4.1 s | 5.5 s |
| Amenities (RAG) | 1.0 s | 4.7 s | 5.6 s |
| Nearby (RAG) | 1.2 s | 5.0 s | 6.2 s |
| Nearby, Telugu (RAG) | 2.7 s | 5.6 s | 8.3 s |

The first RAG call in a fresh process took 12–17 s: about 12 s for the embedding call (client and auth initialisation) and about 2 s for the first Pinecone query. Warm calls take 0.4–1.5 s and 0.2 s.

**Constraints found in the gateway:**
- `splitIntoSentences` holds the first 20 characters while looking for a `[lang]:` prefix, and only flushes at sentence punctuation. A short filler would wait for the reply.
- Barge-in (`handleBargeIn`) fires on the first interim transcript of any caller utterance while the AI is generating. It aborts TTS, and the agent stream is abandoned.

## Goals / Non-Goals

**Goals:**
- The caller hears something within ~1.5 s on slow turns, and never more than ~3 s of silence before a first sound.
- Fillers sound natural in all five supported languages, fit the vertical, and never state facts.
- One shared implementation across the three agents; only phrase data differs.
- Remove the avoidable latency found while measuring (cold start, duplicate context).

**Non-Goals:**
- Streaming LLM tokens from nodes (structured-output nodes make this a larger change; a follow-up).
- LLM-generated or context-aware fillers (they would add the latency they're meant to hide).
- Pre-synthesised filler audio caching (possible later; TTS of a short phrase is ~300 ms).
- The hallucination seen when no property is in focus (nodes answer confidently without data). That's tracked separately.

## Decisions

**1. Fillers are decided in the agent, not the gateway.**
Only the agent knows the router's choice (≈1–1.4 s in) and the vertical, so it can say "let me check the amenities" instead of a generic line, and say it before the slow part starts. The gateway only knows "nothing has arrived yet".
*Alternative: a gateway-side timer.* Generic only, and it can't fire until a fixed threshold. It's rejected as the primary mechanism. The agent keeps a time-based fallback (Decision 3) for turns the router doesn't flag.

**2. `runAgent` yields typed events.**
`runAgent` changes from yielding bare texts to yielding `{ kind: 'route', node }` (taken from the Semantic_Router_Node update's `routeDestination`) and `{ kind: 'text', text }`. `AgentGateway` forwards text as `token`, as now, and feeds both event kinds to a per-turn `FillerController`.

**3. `FillerController`** (`src/agent/graphs/sales/filler/filler-controller.ts`, identical in all repos).
- Constructed per turn with a `send(text)` callback, the turn language, the agent's configured language and the per-call "last phrase" memory.
- `start()` arms the generic timer: 3000 ms, unless the turn is `SYSTEM_START_CONVERSATION`.
- `onRoute(node)` sends the mapped filler if the node is in `SLOW_NODE_FILLERS`, and cancels the generic timer.
- Any filler arms the still-working timer (7000 ms; measured RAG turns reply ~5 s after their filler, so 5000 ms landed just before replies and delayed them).
- `onFirstText()` cancels everything.
- `dispose()` runs in `finally`, so timers never outlive the turn.
- Limits: two fillers per turn, one per trigger.
- Thresholds come from env with these defaults.

**4. Phrase data per vertical** (`sales.fillers.ts`, already authored in all three repos).
- Contents: `FillerLanguage`, `FillerKind` (vertical kinds plus the shared `generic` and `still_working`), `SLOW_NODE_FILLERS` and `FILLER_PHRASES`.
- Phrases are short, commit to no facts, and are gender-neutral; Hindi uses "देख लेते हैं"-style forms because agent voices can be male or female.
- A unit test asserts every kind has all five languages.

**5. Language normalisation.**
- Accepts `te`, `te-IN` and `Telugu`.
- Falls back to the agent's configured language, then `en`.

**6. Protocol `{ type: 'filler', text }`.**
- Additive: old gateways ignore unknown types, so agents can deploy first.
- In the gateway, `streamFromAgent` yields `{ text, filler: true }`.
- `captureTextStream` and the call-log accumulator skip filler chunks, so call logs and Firebase stay clean.
- `splitIntoSentences` (and the OpenAI stub) yield a filler chunk immediately as one sentence, after flushing any buffered text (normally empty, since fillers precede the reply).

**7. Backchannel guard in the gateway.**
- `AudioDriverService` passes the interim transcript to `onBargeIn(transcript)`, for every STT provider path.
- `handleBargeIn` checks `session.fillerOnly`: true once a filler chunk has been spoken and no reply text has yet reached TTS. If it is set and the transcript is a backchannel (≤2 words, all in a per-language acknowledgement list), it doesn't interrupt and marks the utterance to be swallowed.
- When that utterance's final transcript arrives:
  - if it is still a backchannel, it is dropped and not queued;
  - otherwise it is treated as a normal barge-in at that point (interrupt + queue).

This covers "okay so what about the price".

**8. Latency fixes.**
- **Warm-up:** an `onModuleInit` hook (AgentService) embeds `"warm up"` and calls `describeIndexStats`, swallowing errors.
- **De-duplication:** `queryKnowledgeBase` requests `topK × 3` candidates (capped at 20), keeps the highest-scoring match per chunk body (text after the header line, since headers differ by source filename), then slices to `topK`.

**9. Timing log.**
`AgentGateway` logs one line per turn, e.g. `[turn] node=Nearby_Facilities_Node router=1180ms filler=nearby@1182ms first_reply=4990ms`, to tune thresholds from real calls.

## Risks / Trade-offs

- **[Filler then an immediate reply sounds rushed]** → Route fillers only for nodes measured at ≥3.5 s total. The generic one waits 3 s, by which point most fast turns have replied.
- **[Backchannel list misses a word or dialect]** → An unmatched acknowledgement behaves exactly as today (barge-in). Extend the list from call logs.
- **[A real one-word answer ("yes") during the filler gets swallowed]** → Applies only while no reply has started, and "yes"/"no" are not in the acknowledgement list.
- **[Translations sound unnatural]** → Native-speaker review of hi/te/ta/kn before release (task 1.3).
- **[Gateway not yet updated when agents deploy]** → The `filler` type is ignored by the old gateway, so there's no regression, just no fillers until it ships.

## Migration Plan

1. Deploy the agents (fillers sent, warm-up, de-duplication): harmless with the old gateway.
2. Deploy the gateway (filler playback, log exclusion, backchannel guard).
3. Check turn timing logs and listen to staging calls in each language; tune `FILLER_GENERIC_AFTER_MS` and `FILLER_STILL_WORKING_AFTER_MS`.

Rollback: set the thresholds very high and remove the route map entries, or redeploy the previous gateway, which ignores fillers.

## Open Questions

1. Should fillers also play in the playground web preview, or only on phone calls? The default is both, for testing.
2. Native-speaker sign-off owner for the hi/te/ta/kn phrases.
