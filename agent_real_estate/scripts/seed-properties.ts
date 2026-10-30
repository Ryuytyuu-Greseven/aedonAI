// One-off migration: reads src/config/properties.json (the human-editable
// authoring source), embeds each listing, and upserts it into the MongoDB
// `properties` collection that sales.tools.ts reads from at runtime.
//
// Requires the Atlas Vector Search index to already exist:
// - Run: npm run create:index
// - Or paste src/config/atlas-vector-search-index.json into the Atlas UI Search Index JSON Editor
//
// Run with: npm run seed:properties

import * as fs from 'fs/promises';
import * as path from 'path';
import { embeddingsInstance } from '../src/agent/llms/google.embeddings.js';
import { upsertProperty, closePropertyStoreConnection } from '../src/agent/graphs/sales/tool/property.store.js';
import { Property } from '../src/agent/graphs/sales/tool/property.types.js';

function buildEmbeddingText(property: Property): string {
  const amenities = (property.amenities ?? []).map(a => `${a.name}: ${a.description}`).join('. ');
  const nearby = (property.nearbyFacilities ?? []).map(f => `${f.name} (${f.category}, ${f.distance})`).join('. ');

  return [
    `${property.name}, a ${property.type} in ${property.location}.`,
    property.fullDescription,
    property.highlights.join(', '),
    amenities && `Amenities: ${amenities}.`,
    nearby && `Nearby: ${nearby}.`,
  ].filter(Boolean).join(' ');
}

async function main() {
  // Resolved against the process cwd (npm always runs scripts from the
  // package root) rather than __dirname, since this script's compiled
  // location under dist/ doesn't have properties.json copied alongside it.
  const filePath = path.join(process.cwd(), 'src', 'config', 'properties.json');
  const raw = await fs.readFile(filePath, 'utf-8');
  const properties = JSON.parse(raw) as Property[];

  for (const property of properties) {
    const embeddingText = buildEmbeddingText(property);
    const embedding = await embeddingsInstance.embedQuery(embeddingText);
    await upsertProperty({ ...property, embedding });
    console.log(`Seeded ${property.id} — ${property.name} (${embedding.length}-dim embedding)`);
  }

  await closePropertyStoreConnection();
  console.log(`Done. Seeded ${properties.length} properties.`);
}

main().catch((err) => {
  console.error('Seed failed:', err);
  process.exitCode = 1;
});
