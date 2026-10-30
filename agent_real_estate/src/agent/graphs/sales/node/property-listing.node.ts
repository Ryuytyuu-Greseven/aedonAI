import { AIMessage, SystemMessage } from '@langchain/core/messages';
import { z } from 'zod';
import { SalesState } from '../state/sales.state';
import { llmInstance } from './../../../llms/google.llm';
import * as Prompts from '../prompt/sales.prompts';
import { formatPrice } from '../tool/sales.tools';
import { findPropertiesByAgentId } from '../tool/sales-property.repository';

// Property Listing — fetches every property linked to this agent
// and hands the listings to the LLM to present matching options, while
// extracting any newly introduced customer profile fields (name, timeline, etc.).
export async function Property_Listing_Node(state: SalesState) {
  const agentId = state.agentDetails?.id ?? state.agentDetails?.agent_id ?? '';
  const companyId = state.agentDetails?.companyId ?? null;
  const properties =
    state.properties && state.properties.length > 0
      ? state.properties
      : await findPropertiesByAgentId(agentId, companyId);

  const extractorLlm = llmInstance.withStructuredOutput(
    z.object({
      customerName: z
        .string()
        .nullable()
        .describe("Customer's name if introduced or mentioned in this message (e.g. 'I am Rahul', 'Rahul here'). Null otherwise."),
      moveInTimeline: z
        .string()
        .nullable()
        .describe("Move-in timeline if mentioned (e.g. 'ready to move', 'immediate', 'under construction'). Null otherwise."),
      preferredType: z
        .string()
        .nullable()
        .describe('Property configuration preference if mentioned (e.g. 2BHK, 3BHK). Null otherwise.'),
      preferredLocation: z
        .string()
        .nullable()
        .describe('Preferred locality or area if mentioned. Null otherwise.'),
      customerPhNo: z
        .string()
        .nullable()
        .describe("Customer's phone number if shared. Null otherwise."),
      customerEmail: z
        .string()
        .nullable()
        .describe("Customer's email address if shared. Null otherwise."),
      preferredContactMethod: z
        .string()
        .nullable()
        .describe("Preferred contact method if stated ('phone', 'whatsapp', 'email'). Null otherwise."),
      responseToUser: z
        .string()
        .describe(
          'Spoken response to user. ' +
          'If customer just shared their name (or if name was just introduced), acknowledge warmly: "Nice to meet you, [Name].". ' +
          'Answer their question directly (e.g. prioritizing ready-to-move properties), present matching options, ' +
          'and offer next steps (e.g. "If you\'d like to arrange a visit or get a callback, I can collect your contact details when you\'re ready."). ' +
          'Maintain a calm, steady vocal delivery without exclamation marks or shouting.',
        ),
    }),
    { name: 'property_listing_extract' }
  );

  const promptText = await Prompts.getPrompt('property_listing', state.currentLanguage);
  const propertyList =
    properties.length > 0
      ? properties
          .map((p, i) => `Property ${i + 1}: ${p.name}. ${p.description ?? 'No further details on file.'}`)
          .join('\n')
      : 'No properties currently listed in catalog. Politely let the customer know you will check with the team and offer to arrange a callback.';

  const customerContext = [
    (state.budgetMin !== null || state.budgetMax !== null) &&
      `Budget: ${formatPrice(state.budgetMin ?? 0)} to ${formatPrice(state.budgetMax ?? 999_999_999)}`,
    state.preferredLocation && `Preferred location: ${state.preferredLocation}`,
    state.preferredType && `Preferred type: ${state.preferredType}`,
    state.customerName && `Customer Name: ${state.customerName}`,
  ].filter(Boolean).join(' | ');

  const messages = [
    new SystemMessage(
      promptText +
      `\n\nAll properties linked to this agent:\n${propertyList}` +
      (customerContext ? `\n\nWhat we know about the customer so far: ${customerContext}` : '') +
      Prompts.customerProfileContext(state) +
      Prompts.identityContext(state),
    ),
    ...state.messages,
  ];

  const result = await extractorLlm.invoke(messages);

  const updates: any = {
    messages: [new AIMessage(result.responseToUser)],
    properties,
    currentPropertyIndex: 0,
    currentNode: 'Property_Listing_Node',
  };

  if (result.customerName) updates.customerName = result.customerName;
  if (result.moveInTimeline) updates.moveInTimeline = result.moveInTimeline;
  if (result.preferredType) updates.preferredType = result.preferredType;
  if (result.preferredLocation) updates.preferredLocation = result.preferredLocation;
  if (result.customerPhNo) updates.customerPhNo = result.customerPhNo;
  if (result.customerEmail) updates.customerEmail = result.customerEmail;
  if (result.preferredContactMethod) updates.preferredContactMethod = result.preferredContactMethod;

  return updates;
}
