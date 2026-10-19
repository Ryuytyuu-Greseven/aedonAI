 Here is Claude's plan:
╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌
 Multilingual code-switching STT (en/hi/te/ta/kn) + matching TTS locale

 Context

 The call gateway (Twilio/Exotel/WebRTC → AudioDriverService → DeepGram) currently opens one Deepgram nova-3 connection per call with language: 'multi' and a comment listing te, ta, kn, hi, en — but that comment is aspirational. Verified against current Deepgram docs:

 - language: 'multi' genuinely code-switches, but only among en, es, fr, de, hi, ru, pt, ja, it, nl. Hindi is covered; Telugu, Tamil, Kannada are not.
 - te/ta/kn exist as standalone Deepgram languages, just not inside multi's auto-switch set.
 - Deepgram's detect_language flag does not work on streaming connections at all (pre-recorded only) — so Deepgram itself can't tell us when the speaker has moved into/out of Telugu/Tamil/Kannada.

 So: keep multi as the default connection (en↔hi switching is free), and add our own language-ID + reconnect logic only for crossing into/out of te/ta/kn. The user asked to use GCP Vertex AI for this — the repo already depends on @google-cloud/vertexai/@google/genai and already has a working GoogleGenAI({vertexai:true, apiKey}) pattern in gemini.service.ts, so a new lightweight Gemini-based classifier is the natural fit (no new vendor).

 Confirmed scope (per user's choices): implement both (a) the STT-side switching and (b) downstream propagation of the detected language so TTS replies in a matching voice/locale (today gemini.service.ts hardcodes en-US regardless of what was spoken). The language check runs on every utterance (every speech_final), not sampled — cost is small with a flash-lite-class model on a few seconds of audio.

 Today there is no language field anywhere in AudioSession/SessionState/UserConfig, and the only prior attempt at language-aware TTS (gemini.service.ts's [en]:/[hi]:/[te]: prefix convention in the unused generateResponseStream) is dead code — real LLM replies come from external "domain agent" microservices reached over WebSocket via AgentRouterService, which this repo doesn't control. We can pass the detected language to those agents best-effort, but only TTS voice selection is something we can guarantee.

 Design

 Language-ID service (new, Vertex AI): LanguageIdService wraps a short raw-audio buffer as WAV, sends it to a small Gemini model (gemini-3.1-flash-lite, matching the model already used in recording-tester.service.ts) with responseSchema constrained to enum: ['en','hi','te','ta','kn'], and returns the code or null on any failure (network/parse/model error) — caller keeps the current language on null, no retries/circuit-breakers (matches this codebase's existing simplicity level).

 DeepGram (transcribe.ts) rework:
 - Becomes @Injectable(), constructor-injects ConfigService (replacing the raw process.env.DEEPGRAM_API_KEY read — this file was the one outlier from the rest of the codebase's config convention) and the new LanguageIdService.
 - openConnection(sessionId, activeSession, language = 'multi') — language now parameterized.
 - Per-session SttSessionState map tracks: currentLanguage, lastSwitchAt, pendingLanguage/pendingConfirmations (hysteresis), isSwitching guard, and a rolling utteranceAudio buffer (raw chunks since the last speech_final, capped at ~10s).
 - On every speech_final: deliver the transcript as today, plus fire-and-forget checkLanguageSwitch(sessionId, utteranceAudio, activeSession) — never blocks transcript delivery.
 - checkLanguageSwitch: calls LanguageIdService.identifyLanguage(...). If detected language is already covered by the current connection (multi covers en/hi; a standalone connection matches itself) → reset hysteresis, no-op. Otherwise require 2 consecutive matchingdetections AND an 8s cooldown since the last switch before acting — this is what makes "customer switches back after 2 minutes" trigger normally while a stray borrowed English word mid-Tamil-sentence does not.
 - switchLanguage(sessionId, newLanguage, activeSession): opens the new Deepgram socket first, awaits waitForOpen(), then swaps this.connections.set(sessionId, newConnection) — since feedAudio always looks up the socket fresh from the map, every subsequent audiochunk goes to the new socket immediately, no explicit handover buffer needed. Only then does it tell the old socket to sendFinalize({type:'Finalize'}) and close it ~1s later (flushes its trailing transcript instead of dropping it). Because switches onlyfire between utterances (on speech_final), the brief socket-open latency has no user-audible gap.
 - feedAudio also appends each chunk to the session's utteranceAudio buffer (reset each speech_final).

 Downstream propagation: AudioDriverCallbacks.onTranscript becomes (text, language) => void. SessionState gets a language field, set inAssistantService.onTranscriptReady and passed through AgentRouterService.streamFromAgent's WS payload (best-effort — the external agent may ignore it) and read directly off session inside GeminiService.textToSpeech to pick locale/voice (en→en-US, hi→hi-IN, te→te-IN, ta→ta-IN,kn→kn-IN, falling back to en-US if anything's off). OpenAiService gets a one-line comment noting it isn't locale-aware today — explicitly out of scope, not silently ignored.

 Files to change (in build-safe order)

 1. src/assistant/helpers/audio.helper.ts — add audioToWav(buffer, encoding, sampleRate): delegates to existing pcmToWav for LINEAR16; forMULAW builds a WAV header with format code 7 (WAVE_FORMAT_MULAW). Verify Vertex AI classifies mulaw-wrapped audio correctly during Twilio/Exotel testing (step 7 of verification) — if accuracy is poor, this is the place to add a real mulaw→PCM16 decode instead ofheader-only wrapping.
 2. src/assistant/services/language-id.service.ts (new) — @Injectable(), same GoogleGenAI({vertexai:true, apiKey}) construction pattern asgemini.service.ts. One method: identifyLanguage(buffer, encoding, sampleRateHertz): Promise<'en'|'hi'|'te'|'ta'|'kn'|null>. Model id from ConfigService.get('LANGUAGE_ID_MODEL'), default gemini-3.1-flash-lite.
 3. src/assistant/assistant.module.ts — register LanguageIdService in providers/exports.
 4. src/assistant/types/assistant.types.ts — add language: string to SessionState.
 5. src/assistant/services/assistant.service.ts —
    - initializeSession: seed language: 'en' on the new SessionState.
    - onTranscriptReady(client, text, language): new second-to-last param; sets session.language = language before queueing.
    - processQueryQueue's call into agentRouter.streamFromAgent(...): pass session.language as a new arg.
 6. src/assistant/services/audio-driver.service.ts — AudioDriverCallbacks.onTranscript → (text: string, language: string) => void; fix the dead Google-STT path's call site to pass 'en' so it stays type-correct.
 7. src/assistant/gateways/assistant.gateway.ts and src/twilio/gateways/twilio.gateway.ts — update both onTranscript: (text) => ... wiring call sites to (text, language) => this.assistantService.onTranscriptReady(client/adapter, text, language).
 8. src/assistant/services/agent-router.service.ts — streamFromAgent(text, config, sessionId, isActive, language = 'en'); include language in the WS JSON payload sent to the domain-agent microservice.
 9. src/assistant/services/gemini.service.ts — in textToSpeech's ensureTtsStream(), replace the hardcoded languageCode = 'en-US' / voiceModel block with a locale map keyed on session.language. Before finalizing exact voice ID strings, check Google's current Chirp3-HD voice catalog for hi-IN/te-IN/ta-IN/kn-IN — voice names available in en-US (e.g. Callirrhoe) aren't guaranteed to exist in other locales. Simplest safe approach: keep per-voice selection for English, use one fixed known-good Chirp3-HD voice per non-English localerather than trying to map every English voice name across 4 locales.
 10. src/assistant/services/openai.service.ts — add a short comment near textToSpeech noting session.language is intentionally unused here(OpenAI voice IDs aren't locale-parameterized); explicit follow-up, not silent gap.
 11. src/assistant/stt/deepgram/transcribe.ts — the main rework, done last since everything downstream (steps 4–10) is already in place andindependently testable with a dummy language string by this point:
     - @Injectable(), constructor-injects ConfigService + LanguageIdService.
     - Extract createSocket(sessionId, activeSession, language) (connect + wire message handlers + waitForOpen) out of openConnection, reused by switchLanguage.
     - SttSessionState map (currentLanguage, lastSwitchAt, pendingLanguage, pendingConfirmations, isSwitching, utteranceAudio: Buffer[]).
     - feedAudio: append to utteranceAudio (capped ~10s) in addition to existing socket.send.
     - Message handler on speech_final: reset utteranceAudio, call onTranscript(transcript, currentLanguageOrDetected), fire-and-forget checkLanguageSwitch(...).
     - Verify against the real payload what field (if any) Deepgram's multi mode uses to report per-utterance detected language (the file already dumps every Results message to logs/deepgram/<sessionId>/*.json — read one from a live test call rather than guessing thefield name). If none exists, report state.currentLanguage (last confirmed) instead of a per-utterance guess while in multi mode.
     - checkLanguageSwitch: skip if already covered by current connection; else hysteresis (2 consecutive confirmations + 8s cooldown)before calling switchLanguage.
     - switchLanguage: open new socket → swap map entry → sendFinalize + delayed close() on the old socket.
     - closeConnection: also delete the session's SttSessionState.
 12. .env.example — document LANGUAGE_ID_MODEL (default gemini-3.1-flash-lite). Optionally add LANGUAGE_SWITCH_COOLDOWN_MS /LANGUAGE_SWITCH_CONFIRMATIONS as tunables read into DeepGram's constructor instead of hardcoded constants, since these will likely need tuning after real-call testing. No other new env vars needed — GEMINI_API_KEY/GOOGLE_CLOUD_PROJECT/GOOGLE_CLOUD_LOCATION_IN alreadyexist and are reused as-is.

 Run npm run build after each numbered step (or tightly-coupled group, e.g. 4+5, or 6+7) to keep the project compiling throughout — the type changes cascade (SessionState.language → onTranscriptReady → AudioDriverCallbacks → both gateways) and are grouped above so each group isa valid checkpoint.

 Verification

 1. Build/lint: npm run build after each step group; npm run lint at the end. Re-grep onTranscriptReady|streamFromAgent|onTranscript: across src/ to confirm no call site was missed.
 2. English baseline (WebRTC): start a call, speak English, confirm Connection opened <id> (lang=multi), a transcript arrives, TTS replies unchanged (en-US) — regression check.
 3. Hindi under multi: speak Hindi in the same call — confirm no Switching language log fires (already covered), but session.language becomes hi and the TTS reply locale becomes hi-IN.
 4. Switch into Telugu: speak 2+ Telugu utterances — confirm LanguageIdService is invoked each speech_final, then after the 2nd confirmation: Switching language multi → te, a new socket opens, the old one is finalized+closed ~1s later, subsequent Telugutranscribes correctly with no perceptible gap, and TTS switches to te-IN.
 5. Switch back: speak English/Hindi again after being in te — confirm it switches back to multi and TTS reverts to en-US/hi-IN.
 6. Cooldown: switch languages again immediately (within 8s) — confirm the switch is suppressed until cooldown elapses.
 7. Failure path: temporarily break LANGUAGE_ID_MODEL/GEMINI_API_KEY — confirm calls still work end-to-end, session.language stays at itslast known value, LanguageIdService logs the error without crashing the session.
 8. Twilio/Exotel path: repeat steps 2 and 4 over a real Twilio or Exotel test call (MULAW/8000) — this is the highest-uncertainty part ofthe plan (mulaw→WAV wrapping quality for Vertex AI classification); if language-ID accuracy is poor here specifically, upgrade audioToWav to a real mulaw→PCM16 decode.
 9. Barge-in regression: confirm onBargeIn() still fires correctly (interrupt the AI mid-reply) since that logic must survive the wireMessageHandlers extraction unchanged.
 