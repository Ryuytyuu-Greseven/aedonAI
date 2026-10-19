# Vector Search (RAG Retrieval) — Implementation Guide for the Sales Agent Server

## Purpose

`aedonai_agent_builder_server` (this repo) **creates and stores** knowledge
base embeddings in Pinecone — see `src/knowledge-bases/embeddings/` and
`src/repos/knowledge-base-embeddings.repository.ts`. It does **not** query
them; there is no retrieval/search code here today.

The **sales agent server** is where retrieval belongs: at conversation time,
it needs to embed the caller's utterance/query, search the same Pinecone
index for the most relevant knowledge base chunks, and feed those chunks
into the LLM prompt as grounding context (RAG). This document is the
implementation spec for that side — everything needed to read the exact
data this server writes, without needing access to this repo's code.

## 1. Shared resources — must match this server exactly

Both servers **must** point at the same Pinecone project/index and use the
same embedding model, or retrieval will silently return garbage (or nothing).

| Setting | Value | Source of truth |
|---|---|---|
| Pinecone index name | value of `PINECONE_INDEX` | this server's `.env` |
| Pinecone API key | value of `PINECONE_API_KEY` | this server's `.env` (same project) |
| Pinecone SDK | `@pinecone-database/pinecone` `^9.0.0` (or whatever this repo currently pins in `package.json`) | keep versions aligned — the SDK's query/filter option shapes have changed across majors |
| Embedding provider | value of `EMBEDDING_PROVIDER` (`openai` or `vertex-ai`) | this server's `.env` |
| Embedding model + dims | see table below, driven by the active provider | `src/knowledge-bases/embeddings/providers/*.ts` |

**Embedding model table** (`src/knowledge-bases/embeddings/providers/`):

| Provider | Model (default) | Dimensions | Env override |
|---|---|---|---|
| `openai` | `text-embedding-3-small` | 1536 | `OPENAI_EMBEDDING_MODEL` |
| `vertex-ai` | `text-embedding-004` | 768 | `VERTEX_AI_EMBEDDING_MODEL` |

> **Critical constraint:** a vector's position in embedding space is only
> meaningful relative to vectors produced by the *same model*. The sales
> agent server must embed the incoming query with the **identical
> provider + model** used to create the stored vectors, or:
> - a dimension mismatch will make the Pinecone query fail outright, or
> - if dimensions happen to coincide, similarity scores will be meaningless.
>
> Read `EMBEDDING_PROVIDER` (and the matching model env var) from the same
> config source as this server — don't hardcode a different default. If
> this server's config ever changes `EMBEDDING_PROVIDER`, every vector
> embedded *before* the change stays in the old model's space; there is
> currently no re-embedding/migration step, so a provider switch requires
> re-indexing all existing knowledge bases (out of scope here, but flag it
> to whoever owns that migration if `EMBEDDING_PROVIDER` ever changes).

Before wiring anything, confirm the index's **distance metric** (cosine,
dotproduct, or euclidean) via the Pinecone console or `pc.describeIndex()`
— it isn't set anywhere in this repo's code (the index was created outside
of it), so it isn't documented here. The metric determines whether a
*higher* or *lower* `score` means "more similar" (cosine/dotproduct: higher
is better; euclidean: lower is better) — get this wrong and your
relevance-threshold filtering will be inverted.

## 2. What's actually stored — the record shape

Every vector in the index is a `PineconeRecord` shaped like this
(`src/common/interfaces/knowledge-base-embedding.interface.ts`,
`KnowledgeBaseVectorMetadata`):

```ts
{
  id: string;        // `${knowledge_base_id}:${source_type}:${source_id}:${chunk_index}`
  values: number[];   // the embedding, length 1536 (openai) or 768 (vertex-ai)
  metadata: {
    companyId: string;        // '' when the knowledge base has no company (never null — Pinecone metadata has no null type)
    knowledge_base_id: string;
    source_type: 'file' | 'url';
    source_id: string;        // the file_id or url_id within that knowledge base
    chunk_index: number;      // 0-based position of this chunk within its source
    text: string;             // the actual chunk text — this is what you retrieve for RAG context
    provider: string;         // 'openai' | 'vertex-ai' — which embedding model produced `values`
    model: string;            // e.g. 'text-embedding-3-small' — cross-check against what you embedded the query with
    status: 'active' | 'disabled';
  }
}
```

Notes for retrieval:
- **`text` is the payload you want.** There's no separate document store —
  the chunk text lives only in Pinecone metadata. Don't try to re-fetch it
  from Mongo.
- **Chunks are ~1000 words with 200-word overlap**
  (`src/knowledge-bases/embeddings/text-chunking.util.ts`). Expect `text` to
  be roughly paragraph-to-page length, not a single sentence.
- **`status: 'disabled'` vectors must be excluded from retrieval.** Disabling
  a file/url in the knowledge base UI doesn't delete its vectors — it flips
  this metadata field (soft toggle, see
  `KnowledgeBaseEmbeddingsRepository.setStatusBySource`). A retrieval query
  that doesn't filter `status` will surface content the user explicitly
  turned off.
- **No namespaces are used.** Everything lives in the default namespace,
  isolated only via metadata filters (below) — don't assume per-company
  namespaces exist.
- **`provider`/`model` are stored per-chunk, not globally**, so if this
  server's `EMBEDDING_PROVIDER` is ever changed without re-indexing, a
  single knowledge base could contain chunks from two different models
  side by side. If that's a live concern, consider also filtering/grouping
  by `model` so you don't `topK` across two incompatible vector spaces at
  once — see the caveat in §1.

## 3. Which knowledge bases an agent can search

An agent's allowed knowledge bases are `Agent.knowledge_base_ids: string[]`
(`src/schemas/agent.schema.ts`) — "canonical link ownership" per that
field's comment, i.e. this array on the Agent document is the source of
truth for the link, not something stored on the knowledge base side.

At query time in the sales agent server, resolve the current agent's
`knowledge_base_ids` (however that agent record is already being loaded
there) and pass them as an `$in` filter — see §4.

## 4. Query implementation

### 4.1 Client setup

Mirror `src/knowledge-bases/embeddings/pinecone.provider.ts`:

```ts
import { Pinecone } from '@pinecone-database/pinecone';

const pinecone = new Pinecone({ apiKey: process.env.PINECONE_API_KEY! });
const index = pinecone.index({ name: process.env.PINECONE_INDEX! });
```

### 4.2 Embed the query

Use the same provider abstraction shape as
`src/common/interfaces/knowledge-base-embedding.interface.ts` (`EmbeddingProvider.embed`)
so swapping providers later doesn't require touching call sites:

```ts
const [queryVector] = await embeddingProvider.embed([userQueryText]);
```

Embed the **raw user query/utterance** (or a lightly rewritten/condensed
version of it, if the sales agent server does query rewriting) — don't embed
the whole conversation transcript; that dilutes the vector.

### 4.3 Query Pinecone with metadata filters

```ts
const results = await index.query({
  vector: queryVector,
  topK: 5, // start here; tune per §5
  includeMetadata: true,
  filter: {
    knowledge_base_id: { $in: agent.knowledge_base_ids },
    status: { $eq: 'active' },
    // Defense in depth: knowledge_base_id already scopes to one company's
    // data, but also pin companyId in case a knowledge_base_id is ever
    // reused/misrouted across tenants.
    companyId: { $eq: agent.companyId ?? '' },
  },
});
```

If `agent.knowledge_base_ids` is empty, skip the Pinecone call entirely —
an empty `$in` filter matches nothing usefully and wastes a round trip.

### 4.4 Turn matches into RAG context

```ts
const context = results.matches
  .filter((m) => (m.score ?? 0) >= RELEVANCE_THRESHOLD) // see §5 — direction depends on the index's metric, confirm per §1
  .map((m) => m.metadata!.text)
  .join('\n\n---\n\n');
```

Feed `context` into the LLM prompt as grounding material (e.g. "Use the
following knowledge base excerpts to answer... \n\n{context}"). If
`context` ends up empty after thresholding, the agent should fall back to
its own general behavior/prompt rather than claiming no answer exists —
that's a product decision for the sales agent server to make, not something
this doc prescribes.

## 5. Tuning knobs

- **`topK`**: 3–8 is a reasonable starting range for chunk-sized (~1000
  word) content; too high dilutes the prompt with marginal matches, too low
  risks missing the right chunk when relevant content is split across
  chunk boundaries (recall the 200-word overlap exists specifically to
  mitigate that).
- **Relevance threshold**: Pinecone always returns `topK` matches regardless
  of quality — a `topK` of 5 against an index with only 2 truly relevant
  chunks still returns 5 results. Apply a score cutoff so irrelevant filler
  doesn't get treated as ground truth. Determine the right cutoff
  empirically per the index's actual metric (§1) — don't guess a number
  without checking real query/score distributions first.
- **Chunk boundary awareness**: since `text` is a ~1000-word window, a
  single retrieved chunk may contain more than the answer — that's fine for
  LLM context, but don't assume a chunk is a single atomic fact.

## 6. Error handling

Mirror this server's pattern for calls to Pinecone
(`src/repos/knowledge-base-embeddings.repository.ts`,
`src/knowledge-bases/embeddings/pinecone.provider.ts`):
- Treat Pinecone unavailability as non-fatal to the conversation — log and
  fall back to a no-context/general-knowledge response rather than failing
  the whole agent turn. A sales call shouldn't drop because a vector search
  timed out.
- Don't retry indefinitely inline during a live call — a single retry with
  a short timeout, then fall back, keeps conversation latency acceptable.

## 7. What NOT to build

- No new Pinecone index, namespace, or metadata schema — reuse exactly
  what's described in §2. Introducing a second schema/index fragments data
  and breaks the "index once here, query there" design.
- No write path here — the sales agent server should only ever call
  `index.query()` (read-only). Upserts/deletes/status toggles remain owned
  by this server via the knowledge base UI/APIs.
- No re-embedding of query text with a different model "for better
  results" without also re-indexing — see the model-consistency constraint
  in §1.

## 8. Verification checklist before shipping

- [ ] Confirmed the index's distance metric and set the relevance-threshold
      comparison direction accordingly (§1, §5).
- [ ] Confirmed `EMBEDDING_PROVIDER`/model env vars are read from the same
      values this server uses (not redeclared with a different default).
- [ ] Verified a known-good query against a knowledge base with real
      indexed content returns its expected chunk in the top few results.
- [ ] Verified a query scoped to an agent with `knowledge_base_ids: []`
      short-circuits without calling Pinecone.
- [ ] Verified disabling a file/url in the knowledge base UI removes its
      chunks from subsequent query results (status filter works).
- [ ] Verified a company's agent cannot retrieve another company's
      knowledge base content even if a `knowledge_base_id` were guessed
      (companyId filter works as defense in depth).
