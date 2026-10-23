import { StateGraph, MemorySaver } from '@langchain/langgraph';
import { SalesStateAnnotation, SalesState } from '../state/sales.state.js';
import * as Nodes from '../node/index.js';

// ---------------------------------------------------------------------------
// Conditional edge helpers
// ---------------------------------------------------------------------------

function routeFromRouter(state: SalesState) {
  return state.routeDestination as any;
}

// After Budget_Discovery_Node: if budget captured, chain directly into property listing
function checkBudgetDiscovery(state: SalesState) {
  if (state.budgetMin !== null || state.budgetMax !== null) {
    return 'Model_Listing_Node';
  }
  return '__end__';
}

// After Discovery_Node: if budget is already known, go straight to listing
function checkDiscoveryComplete(state: SalesState) {
  if (state.budgetMin !== null || state.budgetMax !== null) {
    return 'Model_Listing_Node';
  }
  return '__end__';
}

// After Model_Presentation_Node: price accepted → move to closing confirmation
function checkPresentationIntent(state: SalesState) {
  if (state.purchaseIntentPropertyId) {
    return 'Closing_Node';
  }
  return '__end__';
}

// After Closing_Node: previously chained into Human_Handoff_Node once a
// service request ticket was raised. Human_Handoff_Node (and the
// Referral_Capture_Node that followed it) is temporarily DISABLED — see the
// commented-out node registrations/edges below. To resume, restore this
// function to:
//   return state.serviceRequestRaised ? 'Human_Handoff_Node' : '__end__';
function checkClosingIntent(_state: SalesState) {
  return '__end__';
}

// ---------------------------------------------------------------------------
// Graph definition
// ---------------------------------------------------------------------------

const workflow = new StateGraph(SalesStateAnnotation)
  // Existing nodes
  .addNode('Semantic_Router_Node', Nodes.Semantic_Router_Node)
  .addNode('Greeting_Pitch_Node', Nodes.Greeting_Pitch_Node)
  .addNode('Intro_Pitch_Node', Nodes.Intro_Pitch_Node)
  .addNode('Budget_Discovery_Node', Nodes.Budget_Discovery_Node)
  .addNode('Model_Listing_Node', Nodes.Model_Listing_Node)
  .addNode('Model_Presentation_Node', Nodes.Model_Presentation_Node)
  .addNode('Specs_Features_Node', Nodes.Specs_Features_Node)
  .addNode('Dealer_Service_Node', Nodes.Dealer_Service_Node)
  .addNode('Objection_Handling_Node', Nodes.Objection_Handling_Node)
  // DISABLED — see checkClosingIntent above. Uncomment to resume:
  // .addNode('Human_Handoff_Node', Nodes.Human_Handoff_Node)
  .addNode('Graceful_Rejection_Node', Nodes.Graceful_Rejection_Node)
  .addNode('Silence_Recovery_Node', Nodes.Silence_Recovery_Node)

  // New nodes
  .addNode('Discovery_Node', Nodes.Discovery_Node)
  .addNode('FAQ_Node', Nodes.FAQ_Node)
  .addNode('Closing_Node', Nodes.Closing_Node)
  // DISABLED — only reachable from Human_Handoff_Node, which is disabled.
  // Uncomment together with it to resume:
  // .addNode('Referral_Capture_Node', Nodes.Referral_Capture_Node)

  // Every turn starts at the semantic router
  .addEdge('__start__', 'Semantic_Router_Node')

  // Router dispatches to the appropriate node
  .addConditionalEdges('Semantic_Router_Node', routeFromRouter)

  // Greeting: short "have a minute?" opener — wait for customer response
  .addEdge('Greeting_Pitch_Node', '__end__')

  // Intro pitch: say what we'd like to share, wait for a yes/no on interest
  .addEdge('Intro_Pitch_Node', '__end__')

  // Budget Discovery: if budget captured, chain directly into property listing
  .addConditionalEdges('Budget_Discovery_Node', checkBudgetDiscovery)

  // Discovery: if budget is known, chain into property listing; otherwise wait
  .addConditionalEdges('Discovery_Node', checkDiscoveryComplete)

  // Property listing: present options, wait for customer to pick one
  .addEdge('Model_Listing_Node', '__end__')

  // Presentation: price accepted → closing confirmation; otherwise wait
  .addConditionalEdges('Model_Presentation_Node', checkPresentationIntent)

  // Amenities / Nearby Facilities: answer and wait for next turn
  .addEdge('Specs_Features_Node', '__end__')
  .addEdge('Dealer_Service_Node', '__end__')

  // FAQ: answer and wait for next turn
  .addEdge('FAQ_Node', '__end__')

  // Objection handling: address concern and wait
  .addEdge('Objection_Handling_Node', '__end__')

  // Closing: raises the service request ticket itself and ends the turn —
  // handoff to a human agent is disabled for now (see checkClosingIntent).
  .addConditionalEdges('Closing_Node', checkClosingIntent)

  // DISABLED together with the node registrations above. Uncomment to resume:
  // .addEdge('Human_Handoff_Node', 'Referral_Capture_Node')
  // .addEdge('Referral_Capture_Node', '__end__')

  // Escape hatches
  .addEdge('Graceful_Rejection_Node', '__end__')
  .addEdge('Silence_Recovery_Node', '__end__');

export const salesCheckpointer = new MemorySaver();
export const salesGraph = workflow.compile({ checkpointer: salesCheckpointer });
