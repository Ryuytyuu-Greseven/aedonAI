import { Model } from 'mongoose';
import { ConversationSummary, ConversationSummarySchema } from '../schema/conversation-summary.schema.js';
import { getConversationAnalysisConnection } from '../mongo/connection.js';

let modelPromise: Promise<Model<ConversationSummary>> | null = null;

function getModel(): Promise<Model<ConversationSummary>> {
  if (!modelPromise) {
    modelPromise = getConversationAnalysisConnection().then((connection) =>
      connection.model<ConversationSummary>(
        ConversationSummary.name,
        ConversationSummarySchema,
        'conversation_summaries',
      ),
    );
  }
  return modelPromise;
}

export interface ConversationSummaryInput {
  conversationId: string;
  agentId: string | null;
  companyId: string | null;
  customerId: string | null;
  customerPhone: string | null;
  summary: string;
  interested: boolean;
  wantsFurtherContact: boolean;
  sentiment: 'positive' | 'neutral' | 'negative' | null;
  budgetMentioned: string | null;
  propertiesDiscussed: string[];
  propertiesDiscussedIds: string[];
  amenitiesOrFacilitiesRequested: string[];
  otherInterests: string[];
  nextSteps: string | null;
}

export async function saveSummary(input: ConversationSummaryInput): Promise<void> {
  const model = await getModel();
  await model.findOneAndUpdate(
    { conversationId: input.conversationId },
    { $set: { ...input, analyzedAt: new Date() } },
    { upsert: true },
  );
}
