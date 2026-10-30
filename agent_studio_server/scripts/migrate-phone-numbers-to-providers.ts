/**
 * One-off migration for provider-backed phone numbers (Twilio US / Exotel IN).
 *
 * - Drops the old unique { country_code, phone_number } index, which would
 *   block re-buying a number after it was released.
 * - Backfills `e164` (= country_code + phone_number) and the new provider
 *   fields' defaults on existing rows. Those rows were entered by hand and
 *   were never bought from a provider, so `provider` stays null.
 * - With --retire-legacy, marks those manual rows Released (and unassigns
 *   them) so only purchased numbers remain usable.
 * - Creates the new partial unique indexes on e164 and provider_sid.
 * - Idempotent: re-runs only touch rows still missing `e164`.
 *
 * Usage (from agent_studio_server/):
 *   node --env-file=.env -r ts-node/register scripts/migrate-phone-numbers-to-providers.ts --dry-run
 *   node --env-file=.env -r ts-node/register scripts/migrate-phone-numbers-to-providers.ts [--retire-legacy]
 */
import mongoose, { Types } from 'mongoose';

const OLD_INDEX = 'country_code_1_phone_number_1';

interface LegacyPhoneNumber {
  _id: Types.ObjectId;
  country_code: string;
  phone_number: string;
  e164?: string | null;
  provider?: string | null;
  assigned_agent?: string | null;
  status: string;
}

async function main(): Promise<void> {
  const dryRun = process.argv.includes('--dry-run');
  const retireLegacy = process.argv.includes('--retire-legacy');
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error('MONGODB_URI is not set');

  await mongoose.connect(uri);
  const phoneNumbers = mongoose.connection.db!.collection<LegacyPhoneNumber>(
    'phone_numbers',
  );

  const indexes = await phoneNumbers.indexes();
  if (indexes.some((i) => i.name === OLD_INDEX)) {
    console.log(`Dropping index ${OLD_INDEX}`);
    if (!dryRun) await phoneNumbers.dropIndex(OLD_INDEX);
  }

  const legacy = await phoneNumbers
    .find({ $or: [{ e164: { $exists: false } }, { e164: null }] })
    .toArray();
  console.log(`${legacy.length} legacy phone number(s) to backfill`);

  const now = new Date();
  for (const doc of legacy) {
    const e164 = `${doc.country_code}${doc.phone_number}`.replace(
      /[^\d+]/g,
      '',
    );
    const retire = retireLegacy && doc.status !== 'Released';
    console.log(
      `  ${e164}${doc.assigned_agent ? ` (agent ${doc.assigned_agent})` : ''}${retire ? ' → Released' : ''}`,
    );
    if (dryRun) continue;

    await phoneNumbers.updateOne(
      { _id: doc._id },
      {
        $set: {
          e164,
          provider: doc.provider ?? null,
          provider_sid: null,
          friendly_name: null,
          iso_country: null,
          number_type: null,
          region: null,
          capabilities: null,
          monthly_price: null,
          currency: null,
          inbound_configured: false,
          purchased_at: null,
          purchased_by: null,
          released_at: retire ? now : null,
          ...(retire ? { status: 'Released', assigned_agent: null } : {}),
        },
      },
    );
  }

  if (!dryRun) {
    // Same indexes the server schema declares, in case the server hasn't
    // booted against this database yet.
    await phoneNumbers.createIndex(
      { e164: 1 },
      {
        unique: true,
        partialFilterExpression: {
          e164: { $type: 'string' },
          released_at: { $type: 'null' },
        },
      },
    );
    await phoneNumbers.createIndex(
      { provider: 1, provider_sid: 1 },
      {
        unique: true,
        partialFilterExpression: { provider_sid: { $type: 'string' } },
      },
    );
  }

  console.log(dryRun ? 'Dry run — nothing written' : 'Done');
  await mongoose.disconnect();
}

main().catch(async (error) => {
  console.error(error);
  await mongoose.disconnect();
  process.exit(1);
});
