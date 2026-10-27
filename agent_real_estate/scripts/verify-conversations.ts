/**
 * End-to-end conversation verification script for real estate sales agent.
 * Run with: npx tsx scripts/verify-conversations.ts
 */

import { AIMessage, HumanMessage } from '@langchain/core/messages';
import { salesGraph } from '../src/agent/graphs/sales/graph/sales.graph.js';
import { SalesState } from '../src/agent/graphs/sales/state/sales.state.js';
import { llmInstance } from '../src/agent/llms/google.llm.js';

let passed = 0;
let failed = 0;

function assert(condition: boolean, testName: string, detail?: string) {
  if (condition) {
    console.log(`  ✅ PASS: ${testName}`);
    passed++;
  } else {
    console.error(`  ❌ FAIL: ${testName}${detail ? ` - ${detail}` : ''}`);
    failed++;
  }
}

async function runTests() {
  console.log('\n=== REAL ESTATE CONVERSATION FLOW VERIFICATION ===\n');

  // Test 1: Initial Greeting Flow
  console.log('[Test 1] Initial Connection -> Greeting_Pitch_Node');
  {
    // Spy on router
    const originalWithStructured = llmInstance.withStructuredOutput.bind(llmInstance);
    const originalInvoke = llmInstance.invoke.bind(llmInstance);

    (llmInstance as any).withStructuredOutput = () => ({
      invoke: async () => ({ routeDestination: 'Greeting_Pitch_Node' }),
    });
    (llmInstance as any).invoke = async () =>
      new AIMessage("Hello, I am Clara from Prestige Estates. I am following up on your recent inquiry on our Whitefield residential community. Do you have just a quick minute?");

    const initialState: Partial<SalesState> = {
      messages: [new HumanMessage('SYSTEM_START_CONVERSATION')],
      currentNode: '',
      routeDestination: 'Greeting_Pitch_Node',
    };

    const result = await salesGraph.invoke(initialState, { configurable: { thread_id: 'flow_test_1' } });
    assert(result.currentNode === 'Greeting_Pitch_Node', 'Graph navigated to Greeting_Pitch_Node');
    assert(result.messages.length > 0, 'Greeting message generated');
  }

  // Test 1b: Agreed to Chat -> Intro_Pitch_Node
  console.log('\n[Test 1b] Agreed to Chat -> Intro_Pitch_Node');
  {
    (llmInstance as any).withStructuredOutput = () => ({
      invoke: async () => ({ routeDestination: 'Intro_Pitch_Node' }),
    });
    (llmInstance as any).invoke = async () =>
      new AIMessage("Great, thanks! I would like to share a few details about our premium residential community Sunrise Valley in Whitefield. Would you be interested?");

    const state: Partial<SalesState> = {
      messages: [new HumanMessage('Sure, go ahead.')],
      currentNode: 'Greeting_Pitch_Node',
    };

    const result = await salesGraph.invoke(state, { configurable: { thread_id: 'flow_test_1b' } });
    assert(result.currentNode === 'Intro_Pitch_Node', 'Graph navigated to Intro_Pitch_Node');
    assert(result.messages.length > 0, 'Intro pitch message generated');
    assert(Array.isArray(result.properties), 'Properties array initialized in state');
  }

  // Test 2: Consultative Discovery -> Budget Discovery
  console.log('\n[Test 2] Consultative Discovery Flow');
  {
    (llmInstance as any).withStructuredOutput = (schema: any, opts: any) => {
      if (opts?.name === 'route_sales_user') {
        return { invoke: async () => ({ routeDestination: 'Discovery_Node' }) };
      }
      if (opts?.name === 'extract_preferences') {
        return {
          invoke: async () => ({
            buyerType: 'end_user',
            preferredType: '3BHK',
            preferredLocation: 'Whitefield',
            moveInTimeline: 'ready to move',
            customerName: 'Aditya',
            customerAddress: null,
            siteVisitInterested: null,
            siteVisitPreferredDate: null,
            responseToUser: 'A spacious three BHK in Whitefield for your family is a wonderful choice! What is your rough budget comfort?',
          }),
        };
      }
      return { invoke: async () => ({}) };
    };

    const state: Partial<SalesState> = {
      messages: [new HumanMessage('I am looking for a 3BHK for my family in Whitefield.')],
      currentNode: 'Greeting_Pitch_Node',
    };

    const result = await salesGraph.invoke(state, { configurable: { thread_id: 'flow_test_2' } });
    assert(result.currentNode === 'Discovery_Node', 'Navigated to Discovery_Node');
    assert(result.buyerType === 'end_user', 'Captured buyerType as end_user');
    assert(result.preferredType === '3BHK', 'Captured configuration as 3BHK');
    assert(result.customerName === 'Aditya', 'Captured customer name');
    assert(result.customerAddress === null, 'Did NOT force caller address');
  }

  // Test 3: Closing & Site Visit Scheduling
  console.log('\n[Test 3] Closing & Site Visit Scheduling Flow');
  {
    (llmInstance as any).withStructuredOutput = (schema: any, opts: any) => {
      if (opts?.name === 'route_sales_user') {
        return { invoke: async () => ({ routeDestination: 'Closing_Node' }) };
      }
      if (opts?.name === 'closing_extract') {
        return {
          invoke: async () => ({
            agreedToVisitOrProceed: true,
            siteVisitPreferredDate: 'Saturday',
            siteVisitTimeSlot: 'morning',
            cabRequired: true,
            customerName: 'Aditya Sharma',
            customerAddress: 'Indiranagar',
            responseToUser: 'Wonderful! Your site visit is scheduled for Saturday morning with complimentary cab pickup. Our relationship manager will reach out with your digital visitor pass.',
          }),
        };
      }
      return { invoke: async () => ({}) };
    };

    const state: Partial<SalesState> = {
      messages: [new HumanMessage('Yes, 85 lakhs works for me. I would like to visit the site this Saturday morning.')],
      currentNode: 'Presentation_Node',
      properties: [
        {
          id: 'prop_001',
          companyId: 'comp_1',
          agentId: 'agent_1',
          name: 'Sunrise Valley Residences',
          description: 'A premium 3BHK in Whitefield at 85 lakhs.',
        },
      ],
      currentPropertyIndex: 0,
    };

    const result = await salesGraph.invoke(state, { configurable: { thread_id: 'flow_test_3' } });
    assert(result.currentNode === 'Closing_Node', 'Navigated to Closing_Node');
    assert(result.siteVisitPreferredDate === 'Saturday', 'Site visit date captured: Saturday');
    assert(result.siteVisitTimeSlot === 'morning', 'Site visit slot captured: morning');
    assert(result.cabRequired === true, 'Cab assistance requested');
    assert(result.serviceRequestRaised === true, 'Service request ticket was raised');
    assert(result.leadSaved === true, 'Lead profile persisted to CRM');
  }

  // Test 4: Objection Handling
  console.log('\n[Test 4] Objection Handling Flow');
  {
    (llmInstance as any).withStructuredOutput = (schema: any, opts: any) => {
      if (opts?.name === 'route_sales_user') {
        return { invoke: async () => ({ routeDestination: 'Objection_Handling_Node' }) };
      }
      return { invoke: async () => ({}) };
    };
    (llmInstance as any).invoke = async () =>
      new AIMessage("I completely understand! Buying a home is a big family milestone. How about I share the master plan and video walkthrough on WhatsApp so you can review together?");

    const state: Partial<SalesState> = {
      messages: [new HumanMessage('The price seems a bit high, and I need to discuss with my spouse first.')],
      currentNode: 'Presentation_Node',
      properties: [
        {
          id: 'prop_001',
          companyId: 'comp_1',
          agentId: 'agent_1',
          name: 'Sunrise Valley Residences',
          description: 'A premium 3BHK at 85 lakhs.',
        },
      ],
      currentPropertyIndex: 0,
    };

    const result = await salesGraph.invoke(state, { configurable: { thread_id: 'flow_test_4' } });
    assert(result.currentNode === 'Objection_Handling_Node', 'Navigated to Objection_Handling_Node');
    assert(result.messages.length > 0, 'Objection reframe response generated');
  }

  // Test 5: Graceful Rejection
  console.log('\n[Test 5] Graceful Rejection Flow');
  {
    (llmInstance as any).withStructuredOutput = (schema: any, opts: any) => {
      if (opts?.name === 'route_sales_user') {
        return { invoke: async () => ({ routeDestination: 'Graceful_Rejection_Node' }) };
      }
      return { invoke: async () => ({}) };
    };
    (llmInstance as any).invoke = async () =>
      new AIMessage("That is absolutely fine, I completely understand. If you are ever exploring properties in the future, we would love to assist. Have a wonderful day!");

    const state: Partial<SalesState> = {
      messages: [new HumanMessage('Not interested at all, please do not call me.')],
      currentNode: 'Greeting_Pitch_Node',
    };

    const result = await salesGraph.invoke(state, { configurable: { thread_id: 'flow_test_5' } });
    assert(result.currentNode === 'Graceful_Rejection_Node', 'Navigated to Graceful_Rejection_Node');
    assert(result.messages.length > 0, 'Polite exit response generated');
  }

  console.log(`\n=== SUMMARY: ${passed} PASSED, ${failed} FAILED ===\n`);
  if (failed > 0) {
    process.exit(1);
  }
  process.exit(0);
}

runTests().catch((err) => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
