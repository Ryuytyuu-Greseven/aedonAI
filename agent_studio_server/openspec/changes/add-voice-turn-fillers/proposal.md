## Why

On a voice call, the customer hears nothing until the whole agent turn is ready. I measured the real-estate graph against staging on 2026-10-26, with the knowledge base working:
- ordinary turns: 2–3 s of silence (router LLM ~1–1.4 s, then the node ~1–2 s);
- detail questions answered from the knowledge base (presentation, amenities, nearby): **5.5–6.2 s**;
- the same question in Telugu: **8.3 s**;
- the first knowledge-base lookup in a fresh process: an extra **12–17 s** while the embedding client and Pinecone connection start up.

Long silences make callers think the line dropped. They say "hello?", which barges in and cancels the answer that was nearly ready. The agent already knows about 1–1.4 s into the turn that it is about to do a slow lookup (the router has picked the node), so it can say so.

## What Changes

- **Turn fillers (agents):** when the router picks a slow node (listing, presentation, knowledge-base detail nodes, FAQ), the agent immediately sends a short pre-written line in the caller's current language ("Let me check the amenities for you."). The rules:
  - If any other turn has produced nothing after 3 s, a generic filler is sent ("One moment, please.").
  - If the caller is still waiting 5 s after a filler, one "still working" line follows.
  - At most two fillers per turn; none on the greeting; no phrase repeated back-to-back in a call.
- **Filler phrases are data, one file per vertical:** `src/agent/graphs/sales/filler/sales.fillers.ts` in each agent repo (en, hi, te, ta, kn), with vertical wording and a node-to-filler map. The selection and timing logic is identical across the three agents.
- **Agent → gateway protocol:** a new websocket message `{ type: 'filler', text }`, alongside the existing `token` / `done` / `error`. Fillers never enter the graph's message history, the agent's analysis transcript, or the call log.
- **Gateway (calls_input_gateway):** speaks a `filler` immediately as its own sentence. The TTS sentence chunker currently holds back the first 20 characters, which would delay short fillers until the real answer arrives.
- **Backchannel guard (gateway):** while only a filler has been spoken and the real answer hasn't started, a short acknowledgement from the caller ("okay", "haan", "సరే", …) does not barge in and cancel the pending answer.
- **Latency fixes (agents):**
  - Warm up the RAG embedding client and the Pinecone connection at startup, removing the 12–17 s first lookup.
  - Drop duplicate chunks (same text uploaded in several files) before they reach the LLM. Today three copies of one brochure triple the prompt.
- **Per-turn timing log (agents):** router time, filler time and first-reply time, to tune thresholds from real calls.

## Capabilities

### New Capabilities
- `voice-turn-fillers`: when and what the agent says while a turn is still being prepared: triggers, thresholds, languages, per-vertical phrases, protocol, exclusion from history/transcripts, and the gateway's immediate playback and backchannel guard.
- `agent-response-latency`: startup warm-up of the retrieval clients, duplicate-chunk removal, and per-turn timing logs.

### Modified Capabilities
<!-- None. The retrieval contract lives in the in-flight change `upgrade-kb-retrieval-pipeline` (not yet archived); duplicate removal is specified here as a new requirement instead of a delta on it. -->

## Impact

- **Agent repos** (`agent_real_estate`, `agent_motor_cycles`, `agent_home_appliances`):
  - new `src/agent/graphs/sales/filler/sales.fillers.ts` (data, per vertical; already authored) and `filler-controller.ts` (logic, identical in all three);
  - changes to `src/agent/agent.service.ts`, `src/agent/agent.gateway.ts`, `graphs/sales/tool/knowledge-base.store.ts`, and startup warm-up (`app.module` / `main.ts`).
- **calls_input_gateway:** `services/agent-router.service.ts` (handle `filler`), `tts/sentence-chunker.ts` and the OpenAI TTS stub (flush fillers immediately), `services/assistant.service.ts` (exclude fillers from logs, backchannel guard), `services/audio-driver.service.ts` (pass the interim transcript to barge-in).
- **Protocol:** additive. A gateway that doesn't know `filler` ignores it, so agents can deploy first.
- **No change** to agent_studio_server or agent_studio_ui. This change is filed here as the cross-repo planning home, like `add-product-enquiry-stats`.
