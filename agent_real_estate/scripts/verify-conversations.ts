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

  // Test 1c: Configured Initial Greeting Honored
  console.log('\n[Test 1c] Configured Initial Greeting Honored');
  {
    const configuredGreeting = "Hi, thanks for reaching out about our MVV Builders listings. I'm here to help you find the right property.";
    const state: Partial<SalesState> = {
      messages: [new HumanMessage('SYSTEM_START_CONVERSATION')],
      userQuery: 'SYSTEM_START_CONVERSATION',
      currentNode: '',
      routeDestination: 'Greeting_Pitch_Node',
      agentDetails: {
        agent_name: 'Clara',
        greeting: configuredGreeting,
      } as any,
    };

    const result = await salesGraph.invoke(state, { configurable: { thread_id: 'flow_test_1c' } });
    assert(result.currentNode === 'Greeting_Pitch_Node', 'Graph navigated to Greeting_Pitch_Node');
    const firstReply = String(result.messages[result.messages.length - 1].content);
    assert(firstReply === configuredGreeting, 'Configured initial greeting was used directly without LLM hallucination');
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
    assert(result.endCall === true, 'Graceful Rejection sets endCall to true');
  }

  // Test 6: Natural Customer Information Collection Flow (User Scenario)
  console.log('\n[Test 6] Natural Customer Information Collection Flow (User Scenario)');
  {
    const threadId = 'flow_test_6';
    let threadState: any = {
      messages: [],
      currentNode: '',
      customerName: null,
      budgetMin: null,
      budgetMax: null,
      preferredLocation: null,
      preferredType: null,
      moveInTimeline: null,
    };

    // Turn 1: Customer expresses initial search
    (llmInstance as any).withStructuredOutput = (schema: any, opts: any) => {
      if (opts?.name === 'route_sales_user') {
        return { invoke: async () => ({ routeDestination: 'Discovery_Node' }) };
      }
      if (opts?.name === 'extract_preferences') {
        return {
          invoke: async () => ({
            buyerType: 'end_user',
            preferredType: '3 BHK',
            preferredLocation: 'Hyderabad',
            moveInTimeline: null,
            budgetMin: null,
            budgetMax: null,
            customerName: null,
            customerEmail: null,
            customerPhNo: null,
            preferredContactMethod: null,
            customerAddress: null,
            siteVisitInterested: null,
            siteVisitPreferredDate: null,
            responseToUser: "Hi! I'd be happy to help you find a 3 BHK in Hyderabad. Which area are you considering, and what's your approximate budget?",
          }),
        };
      }
      return { invoke: async () => ({}) };
    };

    threadState.messages.push(new HumanMessage("Hi, I'm looking for a 3 BHK flat in Hyderabad."));
    threadState = await salesGraph.invoke(threadState, { configurable: { thread_id: threadId } });
    assert(threadState.preferredType === '3 BHK', 'Turn 1: Captured 3 BHK');
    assert(threadState.customerName === null, 'Turn 1: Customer name is still null (no interruption)');

    // Turn 2: Customer specifies location and budget -> Budget_Discovery_Node
    (llmInstance as any).withStructuredOutput = (schema: any, opts: any) => {
      if (opts?.name === 'route_sales_user') {
        return { invoke: async () => ({ routeDestination: 'Budget_Discovery_Node' }) };
      }
      if (opts?.name === 'extract_budget') {
        return {
          invoke: async () => ({
            budgetMin: null,
            budgetMax: 9_000_000,
            preferredLocation: 'Gachibowli',
            preferredType: '3 BHK',
            customerName: null,
            customerEmail: null,
            customerPhNo: null,
            preferredContactMethod: null,
            responseToUser: "Got it! I'll focus on 3 BHK options around Gachibowli within your budget. By the way, may I know your name so I can personalize our conversation?",
          }),
        };
      }
      return { invoke: async () => ({}) };
    };

    threadState.messages.push(new HumanMessage("Around Gachibowli, budget is ₹90 lakhs."));
    threadState = await salesGraph.invoke(threadState, { configurable: { thread_id: threadId } });
    assert(threadState.currentNode === 'Budget_Discovery_Node', 'Turn 2: Handled by Budget_Discovery_Node');
    assert(threadState.budgetMax === 9_000_000, 'Turn 2: Captured budgetMax as 90 lakhs');
    assert(threadState.preferredLocation === 'Gachibowli', 'Turn 2: Captured Gachibowli location');
    const lastMsgContent = String(threadState.messages[threadState.messages.length - 1].content);
    assert(lastMsgContent.includes('may I know your name'), 'Turn 2: Naturally asked for customer name');
    assert(threadState.customerName === null, 'Turn 2: Customer name still missing, waited for user response');

    // Turn 3: Customer introduces name ("I'm Rahul") and asks for ready-to-move-in flats
    (llmInstance as any).withStructuredOutput = (schema: any, opts: any) => {
      if (opts?.name === 'route_sales_user') {
        return { invoke: async () => ({ routeDestination: 'Property_Listing_Node' }) };
      }
      if (opts?.name === 'property_listing_extract') {
        return {
          invoke: async () => ({
            customerName: 'Rahul',
            moveInTimeline: 'ready to move',
            preferredType: '3 BHK',
            preferredLocation: 'Gachibowli',
            customerPhNo: null,
            customerEmail: null,
            preferredContactMethod: null,
            responseToUser: "Nice to meet you, Rahul! I'll prioritize ready-to-move-in properties. Let me check the available options. If you'd like to arrange a visit or get a callback, I can collect your contact details when you're ready.",
          }),
        };
      }
      return { invoke: async () => ({}) };
    };

    threadState.messages.push(new HumanMessage("I'm Rahul. Do you have any ready-to-move-in flats?"));
    threadState = await salesGraph.invoke(threadState, { configurable: { thread_id: threadId } });
    assert(threadState.customerName === 'Rahul', 'Turn 3: Extracted customerName as Rahul');
    assert(threadState.moveInTimeline === 'ready to move', 'Turn 3: Extracted moveInTimeline as ready to move');
    const turn3Reply = String(threadState.messages[threadState.messages.length - 1].content);
    assert(turn3Reply.includes('Nice to meet you, Rahul!'), 'Turn 3: Warmly greeted Rahul by name');
  }

  // Test 7: Graceful Goodbye and Call Termination Scenarios
  console.log('\n[Test 7] Graceful Goodbye & Call Termination Scenarios');
  {
    const scenarios = [
      {
        name: 'Scenario 1: Customer says goodbye',
        input: 'Okay, thank you. Bye!',
        expectedResponse: 'You are most welcome. Thank you for your time. Have a wonderful day. Goodbye.',
      },
      {
        name: 'Scenario 2: Customer is busy',
        input: "I'm a little busy right now. I'll talk to you later.",
        expectedResponse: "Of course, no problem at all. Take care, and feel free to reach out whenever it's convenient. Goodbye.",
      },
      {
        name: 'Scenario 3: Customer is not interested',
        input: "I'm not interested anymore. Thanks.",
        expectedResponse: 'I understand. Thank you for your time, and I appreciate you letting me know. Have a great day. Goodbye.',
      },
      {
        name: 'Scenario 4: Customer will call later',
        input: "I'll call you back if I need anything.",
        expectedResponse: "Absolutely, I will leave it with you. Thanks for your time, and have a lovely day. Goodbye.",
      },
      {
        name: 'Scenario 5: Customer thanks after getting details',
        input: "That's all I needed. Thanks for the information.",
        expectedResponse: 'You are very welcome. I am glad I could help. Thanks for speaking with me, and enjoy the rest of your day. Goodbye.',
      },
    ];

    for (let i = 0; i < scenarios.length; i++) {
      const scenario = scenarios[i];
      (llmInstance as any).withStructuredOutput = (schema: any, opts: any) => {
        if (opts?.name === 'route_sales_user') {
          return { invoke: async () => ({ routeDestination: 'Graceful_Rejection_Node' }) };
        }
        return { invoke: async () => ({}) };
      };
      (llmInstance as any).invoke = async () => new AIMessage(scenario.expectedResponse);

      const state: Partial<SalesState> = {
        messages: [new HumanMessage(scenario.input)],
        currentNode: 'Property_Listing_Node',
        customerName: 'Rahul',
      };

      const result = await salesGraph.invoke(state, { configurable: { thread_id: `flow_test_7_${i}` } });
      assert(result.currentNode === 'Graceful_Rejection_Node', `${scenario.name}: Routed to Graceful_Rejection_Node`);
      assert(result.endCall === true, `${scenario.name}: Triggered endCall flag`);
      const reply = String(result.messages[result.messages.length - 1].content);
      assert(reply === scenario.expectedResponse, `${scenario.name}: Generated warm context-appropriate farewell`);
    }
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
