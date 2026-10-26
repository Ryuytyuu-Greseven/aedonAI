import { MemorySaver, StateGraph } from '@langchain/langgraph';
import { CompanionState, CompanionStateAnnotation } from '../state/companion.state.js';
import { Understand_Node } from '../node/understand.node.js';
import * as Reply from '../node/reply.nodes.js';

// Unlike the sales funnel there are no stages to advance through: every
// turn is "understand → one reply node → wait". What carries Madhu from
// turn to turn and call to call is state (mood, profile, memories), not
// graph position.

function routeFromUnderstand(state: CompanionState) {
  return state.routeDestination as any;
}

const workflow = new StateGraph(CompanionStateAnnotation)
  .addNode('Understand_Node', Understand_Node)
  .addNode('Greeting_Node', Reply.Greeting_Node)
  .addNode('Banter_Node', Reply.Banter_Node)
  .addNode('Comfort_Node', Reply.Comfort_Node)
  .addNode('Curiosity_Node', Reply.Curiosity_Node)
  .addNode('Shared_Memory_Node', Reply.Shared_Memory_Node)
  .addNode('Plan_Node', Reply.Plan_Node)
  .addNode('Goodbye_Node', Reply.Goodbye_Node)
  .addNode('Care_Check_Node', Reply.Care_Check_Node)

  .addEdge('__start__', 'Understand_Node')
  .addConditionalEdges('Understand_Node', routeFromUnderstand)

  .addEdge('Greeting_Node', '__end__')
  .addEdge('Banter_Node', '__end__')
  .addEdge('Comfort_Node', '__end__')
  .addEdge('Curiosity_Node', '__end__')
  .addEdge('Shared_Memory_Node', '__end__')
  .addEdge('Plan_Node', '__end__')
  .addEdge('Goodbye_Node', '__end__')
  .addEdge('Care_Check_Node', '__end__');

export const companionCheckpointer = new MemorySaver();
export const companionGraph = workflow.compile({ checkpointer: companionCheckpointer });
