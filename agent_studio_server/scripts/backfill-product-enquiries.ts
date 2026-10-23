/**
 * One-off backfill: turns existing `conversation_summaries.propertiesDiscussed`
 * (free-text product names written by the agents' conversation analysis)
 * into `product_enquiries` `discussed` events, so the Product Stats tab has
 * history from day one.
 *
 * - Names are matched to the agent's current `sales_properties` by
 *   case-insensitive, whitespace-normalised exact match; anything else is
 *   reported as unmatched and skipped.
 * - A summary whose conversationId is also a webrtc `call_logs._id` was a
 *   playground web call → `channel: 'preview'`. Old phone previews can't be
 *   told apart and are counted as live.
 * - Idempotent: events are `$setOnInsert`-upserted on the unique
 *   (conversationId, propertyId, stage) key, so re-runs create nothing new.
 *
 * Usage (from agent_studio_server/):
 *   node --env-file=.env -r ts-node/register scripts/backfill-product-enquiries.ts --dry-run
 *   node --env-file=.env -r ts-node/register scripts/backfill-product-enquiries.ts
 */
import mongoose, { Types } from 'mongoose';

interface Summary {
  conversationId: string;
  agentId: string | null;
  companyId: string | null;
  customerPhone: string | null;
  propertiesDiscussed?: string[];
  analyzedAt: Date;
}

interface Product {
  _id: Types.ObjectId;
  name: string;
}

const normalise = (name: string) =>
  name.trim().replace(/\s+/g, ' ').toLowerCase();

async function main(): Promise<void> {
  const dryRun = process.argv.includes('--dry-run');
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error('MONGODB_URI is not set');

  await mongoose.connect(uri);
  const db = mongoose.connection.db!;
  const summaries = db.collection<Summary>('conversation_summaries');
  const products = db.collection<Product>('sales_properties');
  const agents = db.collection('agents');
  const callLogs = db.collection<{ _id: string; provider: string }>(
    'call_logs',
  );
  const enquiries = db.collection('product_enquiries');

  if (!dryRun) {
    // Same indexes the server schema declares — make sure the unique key
    // exists before upserting, in case the server hasn't booted against
    // this database yet.
    await enquiries.createIndex(
      { conversationId: 1, propertyId: 1, stage: 1 },
      { unique: true },
    );
    await enquiries.createIndex({ agentId: 1, propertyId: 1, at: -1 });
  }

  // summary.agentId → { productAgentId, products by normalised name }
  const catalogues = new Map<
    string,
    { agentId: string; byName: Map<string, Product> } | null
  >();
  async function catalogueFor(rawAgentId: string) {
    if (catalogues.has(rawAgentId)) return catalogues.get(rawAgentId)!;
    const candidates = [rawAgentId];
    const byAgentId = await agents.findOne(
      { agent_id: rawAgentId },
      { projection: { _id: 1 } },
    );
    if (byAgentId) candidates.push(String(byAgentId._id));

    let resolved: { agentId: string; byName: Map<string, Product> } | null =
      null;
    for (const agentId of candidates) {
      const list = await products.find({ agentId }).toArray();
      if (list.length > 0) {
        resolved = {
          agentId,
          byName: new Map(list.map((p) => [normalise(p.name), p])),
        };
        break;
      }
    }
    catalogues.set(rawAgentId, resolved);
    return resolved;
  }

  const report = {
    summaries: 0,
    summariesWithoutAgent: 0,
    unresolvedAgents: new Set<string>(),
    matched: 0,
    unmatched: new Map<string, number>(),
    previews: 0,
    inserted: 0,
    alreadyPresent: 0,
  };

  const cursor = summaries.find({ 'propertiesDiscussed.0': { $exists: true } });
  for await (const summary of cursor) {
    report.summaries += 1;
    if (!summary.agentId) {
      report.summariesWithoutAgent += 1;
      continue;
    }
    const catalogue = await catalogueFor(summary.agentId);
    if (!catalogue) {
      report.unresolvedAgents.add(summary.agentId);
      continue;
    }

    const webrtcLog = await callLogs.findOne(
      { _id: summary.conversationId, provider: 'webrtc' },
      { projection: { _id: 1 } },
    );
    const channel = webrtcLog ? 'preview' : 'live';
    if (webrtcLog) report.previews += 1;

    const seen = new Set<string>();
    for (const name of summary.propertiesDiscussed ?? []) {
      const product = catalogue.byName.get(normalise(name));
      if (!product) {
        const key = `${summary.agentId}: ${name}`;
        report.unmatched.set(key, (report.unmatched.get(key) ?? 0) + 1);
        continue;
      }
      const propertyId = String(product._id);
      if (seen.has(propertyId)) continue;
      seen.add(propertyId);
      report.matched += 1;
      if (dryRun) continue;

      const result = await enquiries.updateOne(
        {
          conversationId: summary.conversationId,
          propertyId,
          stage: 'discussed',
        },
        {
          $setOnInsert: {
            companyId: summary.companyId ?? null,
            agentId: catalogue.agentId,
            propertyId,
            propertyName: product.name,
            conversationId: summary.conversationId,
            callId: webrtcLog ? summary.conversationId : null,
            customerPhone: summary.customerPhone || null,
            stage: 'discussed',
            source: 'analysis',
            channel,
            at: summary.analyzedAt,
          },
        },
        { upsert: true },
      );
      if (result.upsertedCount > 0) report.inserted += 1;
      else report.alreadyPresent += 1;
    }
  }

  console.log(`\nProduct enquiry backfill${dryRun ? ' (DRY RUN)' : ''}`);
  console.log(`  summaries with products discussed: ${report.summaries}`);
  console.log(
    `  skipped, no agentId:               ${report.summariesWithoutAgent}`,
  );
  console.log(
    `  skipped, agent has no products:    ${report.unresolvedAgents.size} agent(s)`,
  );
  for (const id of report.unresolvedAgents) console.log(`    - ${id}`);
  console.log(`  web-call previews (channel=preview): ${report.previews}`);
  console.log(`  matched product mentions:          ${report.matched}`);
  if (!dryRun) {
    console.log(`  inserted:                          ${report.inserted}`);
    console.log(
      `  already present:                   ${report.alreadyPresent}`,
    );
  }
  const unmatchedTotal = [...report.unmatched.values()].reduce(
    (a, b) => a + b,
    0,
  );
  console.log(`  unmatched names:                   ${unmatchedTotal}`);
  for (const [key, count] of [...report.unmatched].sort(
    (a, b) => b[1] - a[1],
  )) {
    console.log(`    - ${key} (${count})`);
  }

  await mongoose.disconnect();
}

main().catch(async (error) => {
  console.error(error);
  await mongoose.disconnect();
  process.exit(1);
});
