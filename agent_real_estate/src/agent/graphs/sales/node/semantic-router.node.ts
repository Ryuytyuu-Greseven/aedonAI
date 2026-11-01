import { SystemMessage } from '@langchain/core/messages';
import { Logger } from '@nestjs/common';
import { z } from 'zod';
import { SalesState } from '../state/sales.state';
import { llmInstance } from './../../../llms/google.llm';
import * as Prompts from '../prompt/sales.prompts';

const logger = new Logger('SalesNodes');

/**
 * Fast-path deterministic router for unambiguous conversational transitions.
 * Bypasses the ~1,000ms LLM structured routing call for common greetings, goodbyes,
 * silence checks, and initial conversational agreements.
 */
function matchFastPathRoute(userText: string, currentNode: string): string | null {
  const text = userText.trim().toLowerCase().replace(/[.,!?;:'"()]/g, '');
  if (!text) return 'Silence_Recovery_Node';

  // Silence / Inaudible / Audio checks
  if (['hello', 'hello?', 'are you there', 'can you hear me', 'am i audible', 'silence', '[silence]'].includes(text)) {
    return 'Silence_Recovery_Node';
  }

  // Graceful Rejection / Goodbyes / Busy / Driving / Disinterest
  const goodbyeExact = [
    'bye', 'bye bye', 'goodbye', 'see you', 'talk to you later', 'have a good day', 'take care',
    'thats all', 'thats all thank you', 'thats all thanks', 'thats all i needed', 'thats all i need',
    'thanks thats all', 'thank you thats all', 'nothing else', 'were done', 'im done',
    'not interested', 'im not interested', 'not interested anymore', 'stop calling',
    'wrong number', 'no thanks', 'no thank you', 'dont call',
  ];
  if (goodbyeExact.includes(text)) {
    return 'Graceful_Rejection_Node';
  }

  // Busy, driving, or postponement signals
  if (
    text.includes('driving') ||
    text.includes('busy right now') ||
    text.includes('little busy') ||
    text.includes('call you back') ||
    text.includes('call back later') ||
    text.includes('talk later') ||
    text.includes('not interested')
  ) {
    return 'Graceful_Rejection_Node';
  }

  // Initial agreement to talk when at Greeting_Pitch_Node
  if (currentNode === 'Greeting_Pitch_Node') {
    const agreeWords = [
      'yes', 'sure', 'yeah', 'yep', 'okay', 'ok', 'go ahead', 'tell me',
      'sure go ahead', 'sure tell me', 'proceed', 'sure why not', 'yes please',
    ];
    if (agreeWords.includes(text)) {
      return 'Intro_Pitch_Node';
    }
  }

  // Pure standalone greetings when conversation has just started
  if (!currentNode) {
    const greetings = ['hi', 'hello', 'hey', 'good morning', 'good evening', 'good afternoon', 'namaste', 'vanakkam'];
    if (greetings.includes(text)) {
      return 'Greeting_Pitch_Node';
    }
  }

  return null;
}

export async function Semantic_Router_Node(state: SalesState) {
  logger.log(`[Router] Current Node: ${state.currentNode}`);

  const lastMsg = state.messages[state.messages.length - 1];
  const lastContent = typeof lastMsg?.content === 'string' ? lastMsg.content : '';

  if (!state.currentNode && lastContent === 'SYSTEM_START_CONVERSATION') {
    return { routeDestination: 'Greeting_Pitch_Node' };
  }

  // Deterministic Fast-Path: evaluate common turns without LLM roundtrip
  const fastRoute = matchFastPathRoute(lastContent, state.currentNode);
  if (fastRoute) {
    logger.log(`[Router] Fast-Path → ${fastRoute}`);
    return { routeDestination: fastRoute };
  }

  const routerLlm = llmInstance.withStructuredOutput(
    z.object({
      routeDestination: z.enum([
        'Greeting_Pitch_Node',
        'Intro_Pitch_Node',
        'Budget_Discovery_Node',
        'Discovery_Node',
        'Property_Listing_Node',
        'Presentation_Node',
        'Amenities_Node',
        'Nearby_Facilities_Node',
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
    ? `\nAvailable Properties: ${state.properties.map((p, i) => `${i + 1}. ${p.name}`).join(' | ')}`
    : '';

  const preferencesContext = [
    state.buyerType && `Buyer intent: ${state.buyerType === 'end_user' ? 'Family living' : 'Investment'}`,
    state.preferredLocation && `Location preference: ${state.preferredLocation}`,
    state.preferredType && `Property type preference: ${state.preferredType}`,
    state.moveInTimeline && `Move-in timeline: ${state.moveInTimeline}`,
    state.siteVisitPreferredDate && `Site visit requested: ${state.siteVisitPreferredDate}`,
  ].filter(Boolean).join(', ');

  const qualifyingGapsContext = [
    !state.buyerType && 'purpose (family living vs investment)',
    !state.preferredType && 'configuration (2BHK, 3BHK, Villa)',
    !state.preferredLocation && 'preferred location',
  ].filter(Boolean).join(', ');

  const messages = [
    new SystemMessage(
      promptText +
      `\n\nCurrent Funnel Stage: ${state.currentNode || 'Start'}` +
      `\nBudget known: ${state.budgetMin !== null || state.budgetMax !== null ? 'Yes' : 'No'}` +
      (preferencesContext ? `\nCustomer Preferences: ${preferencesContext}` : '') +
      (qualifyingGapsContext ? `\nQualifying details still missing: ${qualifyingGapsContext}` : '') +
      propertiesContext +
      Prompts.customerProfileContext(state) +
      Prompts.identityContext(state),
    ),
    ...state.messages,
  ];

  const result = await routerLlm.invoke(messages);
  logger.log(`[Router] → ${result.routeDestination}`);
  return { routeDestination: result.routeDestination };
}
