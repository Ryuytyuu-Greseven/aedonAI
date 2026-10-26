## ADDED Requirements

### Requirement: Route-triggered filler
When the Semantic Router of a sales agent selects a node listed in that vertical's `SLOW_NODE_FILLERS` map, the agent SHALL immediately send one filler of the mapped kind, before the node runs. The slow nodes are:
- real estate: Property_Listing, Presentation, Amenities, Nearby_Facilities, FAQ;
- motorcycles: Model_Listing, Model_Presentation, Specs_Features, Dealer_Service, FAQ;
- home appliances: Product_Listing, Product_Presentation, Specs_Features, Delivery_Installation, FAQ.

#### Scenario: Amenities question
- **WHEN** a caller asks "does it have a swimming pool?" and the router selects Amenities_Node
- **THEN** the agent sends a `filler` message with an `amenities` phrase, before Amenities_Node starts its knowledge-base lookup

#### Scenario: Fast node
- **WHEN** the router selects Objection_Handling_Node
- **THEN** no filler is sent on route selection

#### Scenario: Generic filler already played
- **WHEN** the router takes 3.2 s (so the generic filler played at 3 s) and then selects Amenities_Node
- **THEN** no route filler is sent; the still-working timer started by the generic filler still applies

### Requirement: Time-triggered fillers
If a turn has sent neither a filler nor any reply text 3000 ms after it started, the agent SHALL send one `generic` filler. If a filler has been sent and no reply text has followed within 7000 ms of it, the agent SHALL send one `still_working` filler. A turn SHALL send at most two fillers and at most one of each trigger. Both thresholds SHALL be configurable via `FILLER_GENERIC_AFTER_MS` and `FILLER_STILL_WORKING_AFTER_MS`.

#### Scenario: Slow router on a fast node
- **WHEN** the router takes 3.2 s and selects Objection_Handling_Node
- **THEN** a `generic` filler is sent at 3 s, and no further filler is sent once the reply begins

#### Scenario: Very slow lookup
- **WHEN** an amenities filler was sent at 1.2 s and the reply has not started by 8.2 s
- **THEN** one `still_working` filler is sent, and no third filler is sent however long the turn takes

#### Scenario: Reply already started
- **WHEN** the reply's first text is sent at 2.5 s
- **THEN** no time-triggered filler is sent for that turn

### Requirement: No filler on greeting
The agent SHALL NOT send any filler for the conversation-start turn (`SYSTEM_START_CONVERSATION`).

#### Scenario: Call starts
- **WHEN** the gateway sends `SYSTEM_START_CONVERSATION` and the greeting takes 3.5 s
- **THEN** no filler is sent

### Requirement: Filler language and phrase selection
The filler language SHALL be the turn's current language, normalised to one of `en`, `hi`, `te`, `ta`, `kn` (codes such as `te` / `te-IN` or names such as `Telugu`). If it isn't one of these, the agent's configured language SHALL be used, then `en`. Within a kind, a phrase SHALL be picked at random, excluding the phrase most recently spoken in the same call when the kind has more than one phrase.

#### Scenario: Telugu caller
- **WHEN** the turn's current language is `te` and the router selects Nearby_Facilities_Node
- **THEN** the filler is one of the Telugu `nearby` phrases

#### Scenario: Unsupported language
- **WHEN** the turn's current language is `bn` and the agent's configured language is `en`
- **THEN** an English filler is sent

#### Scenario: No back-to-back repeat
- **WHEN** the previous filler in this call was "Let me find that for you." and the next filler is also `faq` in English
- **THEN** a different `faq` phrase is chosen

### Requirement: Per-vertical phrase files
Each agent SHALL keep its filler phrases and its node-to-kind map in `src/agent/graphs/sales/filler/sales.fillers.ts`, separate from prompts and logic. Every kind SHALL have at least one phrase for each of `en`, `hi`, `te`, `ta`, `kn`, and every kind SHALL include `generic` and `still_working`. Phrases SHALL state no facts and give no yes/no answer.

#### Scenario: Missing translation
- **WHEN** a phrase file lacks a `kn` entry for any kind
- **THEN** the agent's unit tests fail

### Requirement: Filler protocol and isolation
A filler SHALL be sent to the gateway as `{ "type": "filler", "text": <phrase> }`. Fillers SHALL NOT be added to the graph's message history, the agent's conversation-analysis transcript, the gateway's call log, or the Firebase chat history.

#### Scenario: Analysis transcript
- **WHEN** a call has two turns that each played a filler
- **THEN** the conversation-analysis transcript and call log contain only the customer's words and the agents' real replies

### Requirement: Immediate filler playback
The gateway SHALL send a `filler` to TTS as a complete sentence as soon as it arrives, without waiting for more text or for a minimum length. The reply that follows SHALL be spoken after it, in order.

#### Scenario: Short filler
- **WHEN** the gateway receives the filler "Just a moment." and the reply arrives 3 s later
- **THEN** the caller hears "Just a moment." within the TTS latency of its arrival, then the reply

### Requirement: Backchannel does not cancel a pending reply
While a turn has spoken only filler audio and its reply text hasn't started, a caller utterance whose interim transcript is a short acknowledgement (at most two words, matching the per-language acknowledgement list, e.g. "ok", "okay", "hmm", "haan", "acha", "sare", "సరే", "சரி", "ಸರಿ") SHALL NOT interrupt the turn, and SHALL NOT be queued as a new customer turn. Any other utterance SHALL barge in as today.

#### Scenario: Caller says okay over the filler
- **WHEN** the caller says "okay" while "Let me check the amenities for you." is playing
- **THEN** the amenities reply is still spoken, and "okay" isn't sent to the agent as a new turn

#### Scenario: Caller asks something else
- **WHEN** the caller says "actually, what about the price?" while the filler is playing
- **THEN** the turn is interrupted as today and the new question is processed
