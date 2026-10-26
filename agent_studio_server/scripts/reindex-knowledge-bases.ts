/**
 * Re-embeds knowledge base files/urls with the current embedding model and
 * chunking — run after changing VERTEX_AI_EMBEDDING_MODEL or the chunking
 * logic, so every vector in Pinecone comes from the same model the sales
 * agents query with.
 *
 * - Boots the Nest application context, so re-indexing runs through the
 *   exact same services as `POST /knowledge-bases/:id/reindex`.
 * - Files are read back from GCS, urls are re-fetched. Each source keeps
 *   its active/disabled status; a source that fails keeps its old vectors
 *   and ends with `embedding_status: 'failed'`.
 * - Sources are processed one at a time (awaited), to stay under embedding
 *   rate limits. Legacy images without an embedding_status are set to
 *   `not_applicable`.
 *
 * Usage (from agent_studio_server/):
 *   TS_NODE_FILES=true node --env-file=.env -r ts-node/register scripts/reindex-knowledge-bases.ts --dry-run
 *   TS_NODE_FILES=true node --env-file=.env -r ts-node/register scripts/reindex-knowledge-bases.ts
 *   TS_NODE_FILES=true node --env-file=.env -r ts-node/register scripts/reindex-knowledge-bases.ts --kb <id> [--kb <id> ...]
 */
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { KnowledgeBasesService } from '../src/knowledge-bases/knowledge-bases.service';
import { KnowledgeBasesRepository } from '../src/repos/knowledge-bases.repository';

function parseKbIds(argv: string[]): string[] {
  return argv.flatMap((arg, i) =>
    arg === '--kb' && argv[i + 1] ? [argv[i + 1]] : [],
  );
}

async function main(): Promise<void> {
  const dryRun = process.argv.includes('--dry-run');
  const onlyIds = parseKbIds(process.argv);

  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn', 'log'],
  });
  try {
    const repository = app.get(KnowledgeBasesRepository);
    const service = app.get(KnowledgeBasesService);

    const knowledgeBases = (await repository.filterAllCompanies()).filter(
      (kb) => onlyIds.length === 0 || onlyIds.includes(String(kb._id)),
    );
    console.log(
      `${dryRun ? '[dry run] ' : ''}${knowledgeBases.length} knowledge base(s) to re-index`,
    );

    for (const kb of knowledgeBases) {
      const id = String(kb._id);
      console.log(`\n${kb.name} (${id}) company=${kb.companyId ?? '-'}`);
      for (const file of kb.files ?? []) {
        console.log(`  file ${file.filename} [${file.status ?? 'active'}]`);
      }
      for (const url of kb.urls ?? []) {
        console.log(`  url  ${url.url} [${url.status ?? 'active'}]`);
      }
      if (dryRun) {
        continue;
      }

      await service.prepareReindex(id, kb);
      await service.reindexSources(id, kb);

      const after = await repository.filterById(id);
      for (const file of after?.files ?? []) {
        console.log(`  -> file ${file.filename}: ${file.embedding_status}`);
      }
      for (const url of after?.urls ?? []) {
        console.log(`  -> url  ${url.url}: ${url.embedding_status}`);
      }
    }
  } finally {
    await app.close();
  }
}

main().catch((error) => {
  new Logger('ReindexKnowledgeBases').error(error);
  process.exit(1);
});
