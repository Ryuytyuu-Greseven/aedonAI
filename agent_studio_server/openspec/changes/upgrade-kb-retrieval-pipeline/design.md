## Context

Knowledge base ingestion lives here (`src/knowledge-bases`). Retrieval lives in each sales agent repo (`src/agent/graphs/sales/tool/knowledge-base.store.ts` and `rag.tools.ts`, identical in all three).

Today's pipeline:

1. Upload. Files go to GCS, urls are saved on the knowledge base, and `indexFile`/`indexUrl` run fire-and-forget.
2. Extract. PDFs use `pdf-parse` (text layer only), DOCX uses `mammoth`, txt/md/csv are read as-is. Urls are fetched with `axios` and their HTML is stripped by regex.
3. Format. One `gemini-2.0-flash` call reorganises the text into 9 fixed real-estate sections, falling back to raw text.
4. Chunk. 1000-word windows with 200-word overlap. Section boundaries are ignored.
5. Embed. Vertex `text-embedding-004`, 768-dim, no task type.
6. Store. Pinecone `lyreai` (serverless, 768-dim, cosine, default namespace). Record id is `kb:type:source:chunk_index`.
7. Retrieve (agents). The query is embedded with langchain `VertexAIEmbeddings` (`text-embedding-004`, API key). Pinecone is filtered by kb ids, companyId and `status: active`, then top-K is taken and anything below 0.75 is dropped.

Measurements on staging, from a realistic amenities paragraph vs. "does it have a swimming pool?":

| Model | Task type | Chunk | English | Hindi | Telugu | Unrelated |
|---|---|---|---|---|---|---|
| text-embedding-004 (today) | none | focused | 0.744 | 0.309 | 0.306 | 0.422 |
| text-embedding-004 (today) | none | 1000 words | 0.563 | 0.431 | 0.431 | 0.431 |
| text-multilingual-embedding-002 | yes | focused | 0.782 | 0.651 | 0.650 | 0.504 |
| gemini-embedding-001 @3072 | yes | focused | 0.759 | 0.767 | 0.767 | 0.556 |
| gemini-embedding-001 @768 + header | yes | focused | 0.760 | 0.756 | 0.756 | 0.475 |

Staging Pinecone holds 3 vectors in total (a word list). Older files have no `embedding_status` and were never indexed.

## Goals / Non-Goals

**Goals:**
- Retrieval works across English, Hindi, Telugu and code-mixed queries against English source documents.
- Chunks are small, single-topic and self-describing, so a detail question hits the right paragraph.
- Every existing knowledge base can be re-indexed onto the new model without re-uploading.
- The agents and the studio server agree on the model, and can't silently mix vector spaces.

**Non-Goals (later phases; see Roadmap):**
- Linking chunks to specific `sales_properties` products, or filtering retrieval by product/section.
- Better extraction: Gemini multimodal for scanned PDFs/images, rendered/readable URL scraping, per-template formatter profiles for motorcycles and appliances.
- Query rewriting in the agent nodes.
- A durable job queue for indexing. It stays fire-and-forget, now with retries and a re-index route.
- Making the OpenAI embedding provider index-compatible. Its 1536-dim vectors never fit the 768-dim index, and it stays as-is behind `EMBEDDING_PROVIDER`.

## Decisions

**1. `gemini-embedding-001`, truncated to 768 dims, with task types.**
It was the only model that scored Hindi and Telugu as well as English (~0.76 vs ~0.48 unrelated). `outputDimensionality: 768` keeps the existing index, so there's no new index, no env change for `PINECONE_INDEX`, and no dimension migration. Truncated vectors aren't unit-normalised (norm ≈ 0.59), but the index metric is cosine, so this doesn't matter.
- *Alternative: `text-multilingual-embedding-002`.* Already 768-dim, but Hindi and Telugu land ~0.65 and unrelated ~0.50, a much thinner margin.
- *Alternative: 3072 dims.* No measurable gain in this test, and it needs a new index plus 4× storage.

**2. Section-aware chunks with a context header.**
The formatter already splits documents into sections, so chunks follow them: a section of ≤350 words is one chunk, and a longer one is split on paragraphs/sentences into ~300-word pieces with ~50 words of overlap. Each chunk starts with `Subject: … | Source: … | Section: …`. The header puts the project name into every chunk's vector, so "does Sky View have a pool" matches the amenities chunk even though the amenities text never repeats the name. The formatter's structured output gains one nullable field, `subjectName`, alongside the sections.
- *Alternative: keep word windows, but smaller.* This still mixes sections and loses the section label we need for phase 2 filtering.

**3. Metadata now, filters later.**
Store `section` and `source_label` on every vector now, so phase 2 can filter by section (e.g. amenities node → `section ∈ {amenities, additionalFeatures}`) without another re-index.

**4. Agents filter on `model`.**
Retrieval adds `model: { $eq: <query model> }` to its Pinecone filter. During rollout, or if a re-index is skipped, an agent then gets no context instead of nonsense matches from a different vector space.

**5. Agents embed queries with `@google/genai` on Vertex.**
This replaces langchain `VertexAIEmbeddings`, so `taskType` and `outputDimensionality` are set explicitly, with the same client and credentials pattern as the studio server (`vertexai: true`, `GOOGLE_CLOUD_PROJECT`, `GOOGLE_CLOUD_LOCATION`).
- *Alternative: Gemini API with `GEMINI_API_KEY`.* Not needed: all agent services have Vertex access.

**6. Score cutoff 0.6, configurable.**
Measured relevant matches sit at 0.71–0.79 and unrelated ones at 0.42–0.57, so 0.6 sits in the gap. `RAG_MIN_SCORE` allows tuning per environment after testing with real brochures.

**7. Re-index from stored originals.**
Add `KnowledgeBaseStorageService.downloadFile(objectPath)`. `KnowledgeBaseEmbeddingsService.reindexSource` downloads or re-fetches the source, runs the normal pipeline, and writes vectors with the source's current `status`. The existing order (compute all vectors → `deleteBySource` → upsert) already keeps old vectors if embedding fails. The route marks sources `pending` and returns right away. The script boots a Nest application context (`NestFactory.createApplicationContext(AppModule)`) and awaits each source, so it reuses the exact same services.

**8. Tenant isolation is enforced by filters, not by chunk text.**
Two companies can have identically named projects (e.g. both have a "The Sky View Grand"). The `Subject:` header only affects similarity, never visibility. Every query is filtered by the agent's `knowledge_base_ids` and `companyId`, and every chunk carries its owning KB's `companyId`, so another company's chunks are excluded before scoring. The one gap found: `resolveKnowledgeBaseIds` only checks that linked KB ids exist, not that they belong to the caller's company. Retrieval would still drop the foreign chunks, but the link itself is now rejected.

**9. Retries in the embedding provider.**
Embedding requests retry on 429/5xx (3 attempts; backoff 1s/2s/4s). Re-indexing many sources at once is exactly when rate limits hit.

## Risks / Trade-offs

- **[Mismatched deploys: the studio server writes new vectors while an agent still queries with the old model]** → Agents filter by `model`, so the worst case is "no context" (today's de-facto behaviour), not wrong answers. Release order: agents and studio server together, then the re-index script.
- **[Formatter drops facts on very large documents (single call, output token cap)]** → Unchanged in this phase. Extraction and formatting quality is phase 3, and the raw-text fallback still applies.
- **[0.6 cutoff is calibrated on a synthetic paragraph]** → `RAG_MIN_SCORE` override, plus a task to re-measure on a real brochure after re-index.
- **[Re-index cost/time grows with the number of KBs]** → Small today. The script can target `--kb <id>` and supports `--dry-run`.

## Migration Plan

1. Merge and deploy `agent_studio_server` together with the three agent services (all reading `VERTEX_AI_EMBEDDING_MODEL=gemini-embedding-001`).
2. Run `scripts/reindex-knowledge-bases.ts --dry-run`, then for real, on staging. Check vector counts and `embedding_status`.
3. Re-measure retrieval on staging with a real brochure (amenities, nearby places, pricing; English, Hindi, Telugu) and tune `RAG_MIN_SCORE` if needed.
4. When a production Pinecone index is introduced, index into it with the same model from day one.

Rollback: redeploy the previous images of all four services and re-run the previous indexing (re-upload, or a re-index with `VERTEX_AI_EMBEDDING_MODEL=text-embedding-004`, since the code path honours the env model).

## Roadmap (later changes)

- **Phase 2: product linkage.** Tag knowledge base sources with one or more `sales_properties` ids (UI + API), and/or have the formatter split a multi-project brochure into one record per product matched by name. Store `product_ids` in vector metadata. Detail nodes filter by the product under discussion plus relevant sections, falling back to unfiltered.
- **Phase 3: extraction quality.** Send PDFs and images to Gemini directly (scanned brochures, floor plans, price sheets). Use readable/rendered URL extraction instead of regex stripping. Add per-template formatter profiles (motorcycles: variants, specs, mileage, warranty, service; appliances: models, capacity, energy rating, warranty, installation).
- **Phase 4: query rewriting.** Detail nodes produce a standalone English search query (product name resolved, "it"/"that one" expanded) as part of their existing LLM call.
- **Option to decide before phase 2: per-product fact sheets.** At ingestion, build a 2–5k-token fact sheet per product, stored on `sales_properties`. Detail nodes put it straight into the prompt (no per-turn vector search: lower latency, complete answers). RAG remains for general FAQ documents and large catalogs.

## Resolved Questions

1. All agent services have Vertex AI access, so query embedding uses Vertex with no API-key fallback.
2. Only staging Pinecone exists today; there's no production content to migrate.
3. The junk word-list url may be removed before re-indexing (task 6.1).
