import { SystemMessage } from '@langchain/core/messages';
import { Logger } from '@nestjs/common';
import { z } from 'zod';
import { SalesState } from '../state/sales.state';
import { llmInstance } from './../../../llms/google.llm';
import * as Prompts from '../prompt/sales.prompts';

const logger = new Logger('SalesNodes');

export async function Semantic_Router_Node(state: SalesState) {
  logger.log(`[Router] Current Node: ${state.currentNode}`);

  const lastMsg = state.messages[state.messages.length - 1];
  if (!state.currentNode && lastMsg?.content === 'SYSTEM_START_CONVERSATION') {
    return { routeDestination: 'Greeting_Pitch_Node' };
  }

  const routerLlm = llmInstance.withStructuredOutput(
    z.object({
      routeDestination: z.enum([
        'Greeting_Pitch_Node',
        'Budget_Discovery_Node',
        'Discovery_Node',
        'Product_Listing_Node',
        'Product_Presentation_Node',
        'Specs_Features_Node',
        'Delivery_Installation_Node',
        'Objection_Handling_Node',
        'Closing_Node',
        // Human_Handoff_Node / Referral_Capture_Node are temporarily disabled
        // (see sales.graph.ts) — do not route to them; they aren't registered
        // in the graph and would crash. Re-add here when resumed.
        'FAQ_Node',
        'Graceful_Rejection_Node',
        'Silence_Recovery_Node',
      ]),
    }),
    { name: 'route_sales_user' }
  );

  const promptText = await Prompts.getPrompt('semantic_router', state.currentLanguage);

  const propertiesContext = state.properties.length > 0
    ? `\nAvailable Products: ${state.properties.map((p, i) => `${i + 1}. ${p.name}`).join(' | ')}`
    : '';

  const preferencesContext = [
    state.preferredLocation && `City/area: ${state.preferredLocation}`,
    state.preferredType && `Looking for: ${state.preferredType}`,
    state.moveInTimeline && `Purchase timeline: ${state.moveInTimeline}`,
  ].filter(Boolean).join(', ');

  const qualifyingGapsContext = [
    !state.customerName && 'name',
    !state.customerAddress && 'city/area',
    !state.moveInTimeline && 'purchase timeline',
    state.siteVisitInterested === null && 'store-visit interest',
  ].filter(Boolean).join(', ');

  const messages = [
    new SystemMessage(
      promptText +
      `\n\nCurrent Funnel Stage: ${state.currentNode || 'Start'}` +
      `\nBudget known: ${state.budgetMin !== null || state.budgetMax !== null ? 'Yes' : 'No'}` +
      (preferencesContext ? `\nCustomer Preferences: ${preferencesContext}` : '') +
      (qualifyingGapsContext ? `\nQualifying details still missing: ${qualifyingGapsContext}` : '') +
      propertiesContext +
      Prompts.identityContext(state),
    ),
    ...state.messages,
  ];

  const result = await routerLlm.invoke(messages);
  logger.log(`[Router] → ${result.routeDestination}`);
  return { routeDestination: result.routeDestination };
}
