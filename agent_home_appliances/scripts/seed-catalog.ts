// Seeds a sample product catalog into the `sales_properties` collection for
// one agent — the same collection Product_Listing_Node reads from at runtime
// (see src/agent/graphs/sales/tool/sales-property.repository.ts). Each entry
// is just a name + free-text description, matching SalesProperty.
//
// Upserts by (agentId, name), so re-running it updates the descriptions
// instead of creating duplicates.
//
// Run with:
//   AGENT_ID=<agent mongo _id> COMPANY_ID=<optional> npm run seed:catalog
//   CATALOG_FILE=src/config/other-catalog.json AGENT_ID=... npm run seed:catalog

import * as fs from 'fs/promises';
import * as path from 'path';
import { SalesProperty, SalesPropertySchema } from '../src/schema/sales-properties.schema.js';
import { getMongooseConnection, closeMongooseConnection } from '../src/agent/graphs/sales/tool/mongoose-connection.js';

interface CatalogEntry {
  name: string;
  description: string | null;
}

async function main() {
  const agentId = process.env.AGENT_ID;
  if (!agentId) throw new Error('AGENT_ID is not set');
  const companyId = process.env.COMPANY_ID || null;

  // Resolved against the process cwd (npm always runs scripts from the
  // package root) rather than __dirname.
  const catalogFile = process.env.CATALOG_FILE ?? path.join('src', 'config', 'sample-catalog.samsung.json');
  const raw = await fs.readFile(path.join(process.cwd(), catalogFile), 'utf-8');
  const entries = JSON.parse(raw) as CatalogEntry[];

  const connection = await getMongooseConnection();
  const model = connection.model<SalesProperty>(SalesProperty.name, SalesPropertySchema, 'sales_properties');

  for (const entry of entries) {
    await model.updateOne(
      { agentId, name: entry.name },
      { $set: { companyId, description: entry.description } },
      { upsert: true },
    );
    console.log(`Seeded "${entry.name}" for agent ${agentId}`);
  }

  await closeMongooseConnection();
  console.log(`Done. Seeded ${entries.length} catalog entries.`);
}

main().catch((err) => {
  console.error('Seed failed:', err);
  process.exitCode = 1;
});
