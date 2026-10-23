import { SystemMessage } from '@langchain/core/messages';
import { SalesState } from '../state/sales.state';
import { llmInstance } from './../../../llms/google.llm';
import * as Prompts from '../prompt/sales.prompts';
import { findPropertiesByAgentId } from '../tool/sales-property.repository';

// Intro Pitch — second step of the opening. Greeting_Pitch_Node only asks
// "do you have a minute?"; once the customer agrees, this node
// says what we want to share (product names from the agent's linked listings) and asks
// whether they're interested. A "yes" then routes to Product_Listing_Node.
export async function Intro_Pitch_Node(state: SalesState) {
  const agentId = state.agentDetails?.id ?? state.agentDetails?.agent_id ?? '';
  const companyId = state.agentDetails?.companyId ?? null;
  const properties = await findPropertiesByAgentId(agentId, companyId);

  const promptText = await Prompts.getPrompt('intro_pitch', state.currentLanguage);
  const itemNames = properties.length > 0
    ? `\n\nProducts you can mention:\n${properties.map((p) => `- ${p.name}. ${p.description ?? ''}`).join('\n')}`
    : '';

  const messages = [
    new SystemMessage(promptText + itemNames + Prompts.identityContext(state)),
    ...state.messages,
  ];
  const response = await llmInstance.invoke(messages);
  return { messages: [response], currentNode: 'Intro_Pitch_Node' };
}
