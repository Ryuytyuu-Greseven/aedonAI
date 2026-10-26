## 1. Filler phrase data (agent repos)

- [x] 1.1 `src/agent/graphs/sales/filler/sales.fillers.ts` in agent_real_estate (listing, details, amenities, nearby, faq, generic, still_working × en/hi/te/ta/kn)
- [x] 1.2 Same file in agent_motor_cycles (listing, details, specs, dealer_service, faq, …) and agent_home_appliances (listing, details, specs, delivery_installation, faq, …)
- [ ] 1.3 Native-speaker review of hi/te/ta/kn phrases (gender-neutral, spoken register)

## 2. Filler logic (agent repos — identical in all three)

- [x] 2.1 `filler/filler-controller.ts`: language normalisation, random non-repeating pick, route trigger, generic timer (`FILLER_GENERIC_AFTER_MS`, default 3000), still-working timer (`FILLER_STILL_WORKING_AFTER_MS`, default 7000), max 2 per turn, no filler on `SYSTEM_START_CONVERSATION`, `dispose()`
- [x] 2.2 Unit tests (`node:test` via `npm test`, since the agent repos have no jest): every kind has all five languages (per repo's phrase file); route trigger; fast node; generic at threshold; still-working once; reply cancels timers; greeting excluded; no back-to-back repeat; language fallback
- [x] 2.3 `AgentService.runAgent` yields `{ kind: 'route', node }` from the router update and `{ kind: 'text', text }` for node messages
- [x] 2.4 `AgentGateway`: per-turn `FillerController`, send `{ type: 'filler', text }`, keep fillers out of the analysis transcript, per-call last-phrase memory, `dispose()` in `finally`
- [x] 2.5 Per-turn timing log line (node, router ms, filler kind@ms, first reply ms)
- [x] 2.6 Port 2.1–2.5 to agent_motor_cycles and agent_home_appliances (only `sales.fillers.ts` differs)

## 3. Latency fixes (agent repos)

- [x] 3.1 Startup warm-up (`onModuleInit`): embed a throwaway query and call Pinecone `describeIndexStats`; log and swallow failures; skip when Pinecone isn't configured
- [x] 3.2 `queryKnowledgeBase`: request `topK × 3` (max 20), de-duplicate by chunk body (text after the header line), keep the highest score, slice to `topK`; unit test with three identical brochures
- [x] 3.3 Port 3.1–3.2 to all three repos

## 4. Gateway (calls_input_gateway)

- [x] 4.1 `AgentRouterService.streamFromAgent`: yield `{ text, filler: true }` for `filler` messages; exclude them from the call-log accumulator
- [x] 4.2 `AssistantService.captureTextStream`: exclude filler chunks from the text saved to Firebase
- [x] 4.3 `splitIntoSentences` and the OpenAI TTS stub: yield a filler chunk immediately as one sentence (flush any buffered text first); unit tests for a short filler followed by a reply
- [x] 4.4 Track `session.fillerOnly` (filler spoken, no reply text yet), reset per turn
- [x] 4.5 `AudioDriverService`: pass the interim transcript to `onBargeIn` for every STT provider path (Google, Deepgram, Sarvam)
- [x] 4.6 Backchannel guard in `handleBargeIn` plus the final-transcript check (drop a backchannel; barge in late if the final isn't one); per-language acknowledgement list; unit tests for "okay" (kept), "okay so what about price" (late barge-in), "what about price" (normal barge-in)

## 5. Rollout and verification

- [x] 5.0 Local end-to-end run of the real-estate agent over its websocket (fillers at ~1.4 s on listing/amenities/nearby, Telugu filler for a Telugu question, generic at 3 s, no filler on greeting, warm-up at boot); still-working default raised to 7 s from these timings
- [ ] 5.1 Deploy agents to staging; confirm the old gateway ignores `filler` (no errors)
- [ ] 5.2 Deploy gateway to staging; preview calls in en/hi/te on amenities, nearby, listing and FAQ questions; check the filler plays within ~1.5 s, the reply follows, and the call log/Firebase contain no fillers
- [ ] 5.3 Restart an agent and confirm the first knowledge-base question has no cold-start delay
- [ ] 5.4 Say "okay" over a filler and confirm the reply still plays
- [ ] 5.5 Review turn timing logs; tune thresholds
- [ ] 5.6 Production deploy (agents first, then gateway)
