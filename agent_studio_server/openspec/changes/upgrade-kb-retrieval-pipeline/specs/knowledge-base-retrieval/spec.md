## ADDED Requirements

### Requirement: Query embeddings match the index
The sales agent services (`agent_real_estate`, `agent_motor_cycles`, `agent_home_appliances`) SHALL embed knowledge base queries with the same model the studio server indexes with (`VERTEX_AI_EMBEDDING_MODEL`, default `gemini-embedding-001`), requesting `taskType: RETRIEVAL_QUERY` and `outputDimensionality: 768`.

#### Scenario: Query embedded for an amenities question
- **WHEN** the amenities node retrieves context for "does it have a swimming pool?"
- **THEN** the query is embedded with `gemini-embedding-001` as a 768-dimension `RETRIEVAL_QUERY` vector

### Requirement: Retrieval scoping
A knowledge base query SHALL be filtered to the agent's `knowledge_base_ids`, the agent's `companyId` (`''` when none), `status: 'active'`, and `model` equal to the query embedding model. A query for an agent with no linked knowledge bases SHALL not call Pinecone.

#### Scenario: Vectors from an older model
- **WHEN** a linked knowledge base still holds vectors written with `text-embedding-004`
- **THEN** those vectors are not returned, and only vectors whose `model` matches the query model are considered

#### Scenario: Disabled source
- **WHEN** a file in a linked knowledge base has been disabled
- **THEN** none of its chunks are returned

### Requirement: Score cutoff
Matches with a cosine score below the cutoff SHALL be discarded. The cutoff SHALL default to 0.6 and be overridable via the `RAG_MIN_SCORE` environment variable.

#### Scenario: Default cutoff
- **WHEN** `RAG_MIN_SCORE` is unset and a match scores 0.58
- **THEN** that match is discarded

#### Scenario: Overridden cutoff
- **WHEN** `RAG_MIN_SCORE=0.5` and a match scores 0.58
- **THEN** that match is returned

### Requirement: Retrieval never breaks a call
Any failure to embed the query or query Pinecone SHALL be logged and treated as "no context", and the node SHALL continue with its non-RAG behaviour.

#### Scenario: Embedding API down
- **WHEN** the embedding request throws during a live call
- **THEN** retrieval returns no context and the node still responds to the customer

### Requirement: Tenant isolation
Retrieval SHALL never return chunks owned by another company, even when chunk text (including the `Subject:` header) is identical across companies. The studio server SHALL reject linking an agent to a knowledge base owned by a different company.

#### Scenario: Same project name in two companies
- **WHEN** company A and company B both have a knowledge base describing "The Sky View Grand" and company A's agent is asked about it
- **THEN** only chunks with company A's `companyId` from company A's linked knowledge bases are returned

#### Scenario: Linking another company's knowledge base
- **WHEN** a user of company A creates or updates an agent with a `knowledge_base_ids` entry owned by company B
- **THEN** the studio server responds with 400 and the agent is not saved
