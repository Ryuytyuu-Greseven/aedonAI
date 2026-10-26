## ADDED Requirements

### Requirement: Multilingual document embeddings
The system SHALL embed knowledge base chunks with the model named by `VERTEX_AI_EMBEDDING_MODEL` (default `gemini-embedding-001`), requesting `taskType: RETRIEVAL_DOCUMENT` and `outputDimensionality: 768`. Each stored vector SHALL record the provider and model that produced it in its metadata.

#### Scenario: Chunk embedded with the default model
- **WHEN** a file is indexed and `VERTEX_AI_EMBEDDING_MODEL` is unset
- **THEN** every chunk is embedded with `gemini-embedding-001` as a 768-dimension `RETRIEVAL_DOCUMENT` vector, and its metadata has `model: 'gemini-embedding-001'`

#### Scenario: Cross-language match
- **WHEN** an English brochure section about a pool has been indexed and a query "స్కై వ్యూ గ్రాండ్ లో స్విమ్మింగ్ పూల్ ఉందా?" is embedded as a `RETRIEVAL_QUERY` with the same model
- **THEN** the cosine similarity between them is at least 0.6

### Requirement: Section-aware chunking
When the sales formatter returns populated sections, the system SHALL produce chunks that never span two sections. A section of at most 350 words SHALL be one chunk. A longer section SHALL be split on paragraph (then sentence) boundaries into chunks of at most ~300 words, with ~50 words of overlap. When formatting falls back to raw text, the raw text SHALL be split the same way into ~300-word chunks.

#### Scenario: Short sections
- **WHEN** a document is formatted into Amenities (120 words) and Location & Connectivity (80 words)
- **THEN** exactly two chunks are produced, one per section

#### Scenario: Long section
- **WHEN** a Property Details section has 900 words across several paragraphs
- **THEN** it is split into multiple chunks of at most ~300 words each, each from Property Details only, and no paragraph is cut mid-sentence unless a single sentence exceeds the limit

#### Scenario: Formatter fallback
- **WHEN** formatting fails or returns no populated section
- **THEN** the raw text is chunked into ~300-word paragraph-aligned chunks with `section: 'raw'`

### Requirement: Chunk context header
Every chunk's embedded and stored text SHALL begin with a single header line of the form `Subject: <subject> | Source: <source label> | Section: <section heading>`, omitting any part that is unknown. `<subject>` is the primary project/product name returned by the formatter. `<source label>` is the url's label or the file's filename.

#### Scenario: Header from a formatted brochure
- **WHEN** a file "skyview-brochure.pdf" is formatted with subject "The Sky View Grand" and an Amenities section
- **THEN** that chunk's text begins with `Subject: The Sky View Grand | Source: skyview-brochure.pdf | Section: Amenities`

#### Scenario: No subject identified
- **WHEN** the formatter cannot identify a primary subject
- **THEN** the header omits the `Subject:` part and starts with `Source:`

### Requirement: Vector metadata
Each stored vector SHALL carry the metadata `companyId` (`''` when none), `knowledge_base_id`, `source_type`, `source_id`, `source_label`, `chunk_index`, `section` (section key such as `amenities`, or `raw`), `text`, `provider`, `model` and `status`.

#### Scenario: Metadata on a formatted chunk
- **WHEN** the Amenities chunk of a file is stored
- **THEN** its metadata includes `section: 'amenities'`, `source_label` set to the filename and `model` set to the embedding model

### Requirement: Re-index a knowledge base
The system SHALL expose `POST /knowledge-bases/:id/reindex`, authenticated and scoped to the caller's company. It SHALL mark every non-image file and every url in that knowledge base `embedding_status: 'pending'`, respond with the updated knowledge base, and then, in the background, re-run indexing for each one from its stored original (files are read back from GCS, urls are re-fetched). Each source's re-indexed vectors SHALL keep that source's current `status` (`active` or `disabled`). A source's previous vectors SHALL be replaced only after its new vectors have been computed.

#### Scenario: Re-index with a disabled file
- **WHEN** a knowledge base with one active and one disabled file is re-indexed
- **THEN** both files are re-embedded with the current model, the disabled file's new vectors have `status: 'disabled'`, and both files end with `embedding_status: 'completed'`

#### Scenario: Re-index fails for one source
- **WHEN** a url can no longer be fetched during re-index
- **THEN** that url ends with `embedding_status: 'failed'`, its previous vectors are left in place, and the other sources are still re-indexed

#### Scenario: Knowledge base from another company
- **WHEN** a user re-indexes a knowledge base that does not belong to their company
- **THEN** the system responds with 404

### Requirement: Bulk re-index script
The system SHALL provide `scripts/reindex-knowledge-bases.ts`, which re-indexes every knowledge base (or only those passed via `--kb <id>`), awaiting each source in turn, and supports `--dry-run` to only list what would be re-indexed. It SHALL also set `embedding_status` on legacy files/urls that have none (`not_applicable` for images, otherwise the re-index result).

#### Scenario: Legacy file without embedding status
- **WHEN** the script runs over a knowledge base whose PDF file has no `embedding_status`
- **THEN** the PDF is indexed and ends with `embedding_status` of `completed` or `failed`

#### Scenario: Dry run
- **WHEN** the script runs with `--dry-run`
- **THEN** it prints each knowledge base and source it would re-index and writes nothing to Mongo or Pinecone

### Requirement: Transient embedding failures are retried
The system SHALL retry an embedding request up to 3 times, with exponential backoff, when it fails with HTTP 429 or a 5xx status, before marking the source `failed`.

#### Scenario: Rate limited once
- **WHEN** the first embedding request for a batch returns 429 and the retry succeeds
- **THEN** the source is indexed normally and ends with `embedding_status: 'completed'`
