## Why

The sales agents' detail nodes (presentation, amenities, nearby facilities, specs, FAQ) are meant to answer from the knowledge base, but retrieval returns almost nothing useful. Measured on staging (2026-10-24/26):

- The embedding model, `text-embedding-004`, is English-only. Hindi and Telugu questions score ~0.31 cosine against the matching chunk, the same as an unrelated question. This is a multilingual voice platform.
- Chunks are fixed 1000-word windows that ignore the sections the formatter just produced. Burying an amenities paragraph in a 1000-word chunk drops an English match from 0.74 to 0.56. The agents discard anything below 0.75, so even English rarely gets through.
- Existing knowledge bases were never (re)indexed. Staging Pinecone holds 3 vectors in total, and there is no way to re-index a source short of re-uploading it.

`gemini-embedding-001` at 768 dimensions, with retrieval task types and section-sized labelled chunks, scores ~0.76 for the same question in Telugu, Hindi and English, and ~0.48 for an unrelated one. That fits the existing 768-dim Pinecone index.

This is **phase 1** of the knowledge-base roadmap: fix the retrieval foundation. Product linkage, better extraction and query rewriting are later phases (see design.md, "Roadmap").

## What Changes

- **Embedding model:** switch indexing from `text-embedding-004` to `gemini-embedding-001` (`outputDimensionality: 768`, `taskType: RETRIEVAL_DOCUMENT`). The model name stays configurable via `VERTEX_AI_EMBEDDING_MODEL`. **BREAKING** for the agents: query vectors must come from the same model, so the agent repos switch in the same release.
- **Section-aware chunking:** emit one chunk per formatted section, splitting long sections on paragraph boundaries (~300 words). Each chunk is prefixed with a context header (subject name, source label, section heading). The raw-text fallback uses the same paragraph splitter instead of 1000-word windows.
- **Formatter subject name:** the sales formatter also returns the document's primary subject (project/product name), used in chunk headers.
- **Richer vector metadata:** add `section` and `source_label` to every chunk, and keep `model`, so retrieval can filter by model and, in later phases, by section.
- **Re-indexing:** new `POST /knowledge-bases/:id/reindex` re-indexes every file and url in a knowledge base from its stored original, preserving each source's active/disabled status. New `scripts/reindex-knowledge-bases.ts` runs it for all knowledge bases, and also backfills `embedding_status` on legacy items that have none.
- **Storage:** `KnowledgeBaseStorageService.downloadFile` reads an uploaded original back from GCS (needed for re-indexing).
- **Tenant isolation:** linking an agent to a knowledge base now requires the knowledge base to belong to the same company (previously only existence was checked).
- **Resilience:** embedding calls retry transient failures (429/5xx) with backoff before marking a source `failed`.
- Cross-repo, tracked as tasks here (those repos have no OpenSpec): in `agent_real_estate`, `agent_motor_cycles` and `agent_home_appliances`:
  - embed queries with `gemini-embedding-001` (`RETRIEVAL_QUERY`, 768 dims) via `@google/genai`;
  - filter Pinecone matches to the same `model`;
  - lower the default score cutoff from 0.75 to 0.6, overridable via `RAG_MIN_SCORE`.

## Capabilities

### New Capabilities
- `knowledge-base-indexing`: how knowledge base files/urls become embedded, searchable chunks: embedding model and task type, section-aware chunking, chunk headers, vector metadata, re-indexing, and failure handling.
- `knowledge-base-retrieval`: the retrieval contract the sales agents follow when querying those chunks: query embedding model and task type, scoping filters, score cutoff, and failure fallback.

### Modified Capabilities
<!-- None: existing specs (agents, auth, monitoring, reporting, templates) don't cover the knowledge base pipeline. -->

## Impact

- **Modified code (studio server):**
  - `src/knowledge-bases/embeddings/providers/vertex-ai-embedding.provider.ts`
  - `src/knowledge-bases/embeddings/text-chunking.util.ts`
  - `src/knowledge-bases/embeddings/knowledge-base-embeddings.service.ts`
  - `src/knowledge-bases/sales/real-estate-sales.profile.ts` and the text-formatter providers
  - `src/knowledge-bases/storage/knowledge-base-storage.service.ts`
  - `src/knowledge-bases/knowledge-bases.{controller,service}.ts`
  - `src/agents/agents.service.ts` (`resolveKnowledgeBaseIds`)
  - `src/common/interfaces/knowledge-base-embedding.interface.ts`
- **New code:** `scripts/reindex-knowledge-bases.ts`.
- **API:** new route `POST /knowledge-bases/:id/reindex` (company-scoped). No breaking changes to existing routes.
- **Data:** every existing vector is replaced by re-indexing. The Pinecone index `lyreai` (768-dim, cosine) is kept.
- **Other repos:** the three agent services: `src/agent/llms/rag-embeddings.provider.ts`, `src/agent/graphs/sales/tool/knowledge-base.store.ts`, `package.json` (`@google/genai`) and env. They must deploy together with the studio server, followed by a re-index run.
- **Cost:** `gemini-embedding-001` is priced higher per token than `text-embedding-004`. Volumes are small (a few brochures per agent), so this is negligible.
