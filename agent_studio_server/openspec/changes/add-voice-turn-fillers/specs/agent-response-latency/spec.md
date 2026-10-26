## ADDED Requirements

### Requirement: Retrieval warm-up at startup
Each sales agent SHALL, at application startup, embed one throwaway query with the RAG embedding model and make one lightweight Pinecone call (index stats), so the first customer lookup doesn't pay client initialisation. Warm-up failures SHALL be logged and SHALL NOT prevent startup. It SHALL be skipped when Pinecone isn't configured.

#### Scenario: First lookup after deploy
- **WHEN** a freshly started agent handles its first knowledge-base question
- **THEN** the lookup takes no longer than a warm lookup (no multi-second client start-up)

#### Scenario: Vertex unavailable at boot
- **WHEN** the warm-up embedding call fails
- **THEN** the error is logged and the agent starts and serves calls normally

### Requirement: Duplicate chunks removed from retrieval results
Knowledge-base retrieval SHALL drop matches whose chunk body (the text after the first header line) is identical to a higher-scoring match, and SHALL still return up to `topK` distinct matches when that many exist. To do so, it requests more candidates from Pinecone than `topK`.

#### Scenario: Same brochure uploaded three times
- **WHEN** three files with identical content are linked and the amenities chunk is the best match
- **THEN** the amenities text appears once in the returned context, and the remaining slots hold the next distinct matches

### Requirement: Per-turn timing log
Each agent SHALL log one line per turn with the session id, the selected node, the router time, the time any filler was sent (and its kind), and the time to the first reply text.

#### Scenario: Turn with filler
- **WHEN** a turn routes to Nearby_Facilities_Node, sends a filler at 1.2 s and replies at 5.0 s
- **THEN** a single log line records node `Nearby_Facilities_Node`, router ≈1.2 s, filler `nearby` at 1.2 s and first reply at 5.0 s
