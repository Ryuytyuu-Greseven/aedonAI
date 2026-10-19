import { Model } from 'mongoose';
import { AnalysisQueueItem, AnalysisQueueItemSchema } from '../schema/analysis-queue-item.schema.js';
import { getConversationAnalysisConnection } from '../mongo/connection.js';
import { EnqueueConversationInput } from '../types.js';

let modelPromise: Promise<Model<AnalysisQueueItem>> | null = null;

function getModel(): Promise<Model<AnalysisQueueItem>> {
  if (!modelPromise) {
    modelPromise = getConversationAnalysisConnection().then((connection) =>
      connection.model<AnalysisQueueItem>(
        AnalysisQueueItem.name,
        AnalysisQueueItemSchema,
        'conversation_analysis_queue',
      ),
    );
  }
  return modelPromise;
}

/**
 * Adds a conversation to the queue. This is the ONLY write path the rest of
 * the app should ever call into this module through. Upserted by
 * conversationId so a duplicate enqueue (e.g. a flaky disconnect firing
 * twice) doesn't create two jobs for the same call.
 */
export async function enqueue(input: EnqueueConversationInput): Promise<void> {
  const model = await getModel();
  await model.findOneAndUpdate(
    { conversationId: input.conversationId },
    {
      $setOnInsert: {
        conversationId: input.conversationId,
        status: 'pending',
        transcript: input.transcript,
        agentId: input.agentId ?? null,
        companyId: input.companyId ?? null,
        customerId: input.customerId ?? null,
        customerPhone: input.customerPhone ?? null,
        attempts: 0,
        lastError: null,
        enqueuedAt: new Date(),
        startedAt: null,
        completedAt: null,
      },
    },
    { upsert: true },
  );
}

/**
 * Atomically claims the oldest pending item and marks it 'processing'. Uses
 * findOneAndUpdate as the mutual-exclusion mechanism, so even if this were
 * ever run as more than one process (e.g. after this module becomes its own
 * horizontally-scaled server), two workers could never claim the same job —
 * the "only one ended call at once" guarantee holds per-job regardless of
 * how many workers exist, not just because this process only runs one loop.
 */
export async function claimNext(): Promise<AnalysisQueueItem | null> {
  const model = await getModel();
  return model.findOneAndUpdate(
    { status: 'pending' },
    { $set: { status: 'processing', startedAt: new Date() }, $inc: { attempts: 1 } },
    { sort: { enqueuedAt: 1 }, returnDocument: 'after' },
  );
}

export async function markDone(id: string): Promise<void> {
  const model = await getModel();
  await model.updateOne({ _id: id }, { $set: { status: 'done', completedAt: new Date() } });
}

export async function markFailed(id: string, errorMessage: string): Promise<void> {
  const model = await getModel();
  await model.updateOne(
    { _id: id },
    { $set: { status: 'failed', completedAt: new Date(), lastError: errorMessage.slice(0, 2000) } },
  );
}
