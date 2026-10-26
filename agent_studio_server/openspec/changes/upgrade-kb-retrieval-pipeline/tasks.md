## 1. Embedding model and retries (studio server)

- [x] 1.1 `vertex-ai-embedding.provider.ts`: default model `gemini-embedding-001`; pass `taskType: 'RETRIEVAL_DOCUMENT'` and `outputDimensionality: 768` (constant `KNOWLEDGE_BASE_EMBEDDING_DIMENSIONS`)
- [x] 1.2 Add retry with exponential backoff (3 attempts, 1s/2s/4s) on 429/5xx around `embedContent`; unit test retry-then-succeed and give-up-after-3
- [x] 1.3 Set `VERTEX_AI_EMBEDDING_MODEL=gemini-embedding-001` in `.env`, `.env.example` (if present) and deploy env; document it in `docs/vector-search-implementation.md`

## 2. Section-aware chunking (studio server)

- [x] 2.1 Formatter output gains a nullable `subjectName` (primary project/product name): update `RealEstateSalesSections` type, prompt, and both formatter providers' response schemas
- [x] 2.2 `KnowledgeBaseSalesFormatterService.format` returns `{ subjectName, sections: { key, heading, text }[] }`, or `null` on fallback, instead of a rendered string
- [x] 2.3 Replace `chunkText` with a paragraph/sentence-aligned splitter (≤350 words → one chunk; else ~300-word chunks, ~50-word overlap; single oversize sentence hard-split); unit tests for short, long and single-huge-sentence input
- [x] 2.4 Build chunks per section (or `section: 'raw'` on fallback), each prefixed with the `Subject: … | Source: … | Section: …` header (omit unknown parts); unit tests for header formatting
- [x] 2.5 Extend `KnowledgeBaseVectorMetadata` with `section` and `source_label`; pass the file name / url label into `indexFile`/`indexUrl` and on to `insertMany`
- [x] 2.6 Formatter default model `gemini-2.0-flash` → `gemini-3.1-flash-lite` (2.0 returns 404 on this project, so every upload had silently fallen back to raw text)
- [x] 2.7 Formatter prompt: reorganize without summarizing (every list item/table row kept; leftovers go to additionalFeatures; drop page headers/footers); chunker keeps one list item per line. Verified on `dummy_brochures/the-sky-view-grand-brochure.pdf`: 25/25 sampled facts retained

## 3. Re-indexing (studio server)

- [x] 3.1 `KnowledgeBaseStorageService.downloadFile(objectPath): Promise<Buffer>`
- [x] 3.2 `indexSource` takes the target vector `status` (default `active`); add `reindexFile`/`reindexUrl` that download or re-fetch and preserve the source's current status
- [x] 3.3 `KnowledgeBasesService.reindex(id, companyId)`: company check; set every non-image file and every url to `embedding_status: 'pending'`; return the updated KB; fire background re-index per source
- [x] 3.4 `POST /knowledge-bases/:id/reindex` in `knowledge-bases.controller.ts` (JWT, company-scoped); unit tests for 404 cross-company and disabled-source status preservation
- [x] 3.5 `scripts/reindex-knowledge-bases.ts` (Nest application context; `--dry-run`, `--kb <id>`; awaits each source; sets `not_applicable` on legacy images); usage header in the style of `backfill-product-enquiries.ts`

## 4. Tenant isolation hardening (studio server)

- [x] 4.1 `AgentsService.resolveKnowledgeBaseIds` takes the caller's `companyId` and rejects (400) any id whose knowledge base belongs to another company; pass it from `create`, `update` and clone paths
- [x] 4.2 Unit tests: same-company link accepted; other-company id rejected; agent with null companyId cannot link a company-owned KB

## 5. Agent services (agent_real_estate, agent_motor_cycles, agent_home_appliances)

- [x] 5.1 Add `@google/genai` dependency; rewrite `src/agent/llms/rag-embeddings.provider.ts` to embed with `taskType: 'RETRIEVAL_QUERY'`, `outputDimensionality: 768`, model from `VERTEX_AI_EMBEDDING_MODEL` (default `gemini-embedding-001`), and export the model name
- [x] 5.2 `knowledge-base.store.ts`: add `model: { $eq: <query model> }` to the Pinecone filter; default `minScore` from `RAG_MIN_SCORE` (default 0.6)
- [x] 5.3 Set `VERTEX_AI_EMBEDDING_MODEL` and (optionally) `RAG_MIN_SCORE` in each repo's `.env` and deploy env
- [x] 5.4 Port 5.1–5.3 identically to all three repos (files are identical today; keep them so)

## 6. Rollout and verification

- [x] 6.1 Remove the junk word-list url from the "Raj Pushpa The Grand" knowledge base (approved by the user)
- [ ] 6.2 Deploy studio server and the three agents together on staging, with `VERTEX_AI_EMBEDDING_MODEL=gemini-embedding-001` (and optionally `RAG_MIN_SCORE`) in each Cloud Run service's env
- [ ] 6.3 Run the re-index script with `--dry-run`, then for real; confirm Pinecone vector counts, `model` metadata and `embedding_status` on every source
- [ ] 6.4 Upload a real property brochure to a staging KB linked to a sales agent; measure top matches for amenities / nearby / price questions in English, Hindi and Telugu; tune `RAG_MIN_SCORE` if relevant matches fall below it
- [ ] 6.5 Place a staging preview call and confirm the amenities and FAQ nodes answer from the brochure
- [ ] 6.6 Production: deploy all four services, then run the re-index script
