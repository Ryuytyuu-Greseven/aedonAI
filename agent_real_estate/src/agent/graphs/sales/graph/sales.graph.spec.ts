import { AIMessage } from '@langchain/core/messages';
import { salesGraph } from './sales.graph';
import { SalesState } from '../state/sales.state.js';

jest.mock('../../../llms/google.llm', () => ({
  llmInstance: {
    invoke: jest.fn(),
    withStructuredOutput: jest.fn(),
  },
}));

jest.mock('../prompt/sales.prompts', () => ({
  getPrompt: jest.fn().mockResolvedValue('Mocked prompt'),
  identityContext: jest.fn().mockReturnValue('Mocked identity'),
  buildGlobalGuardrails: jest.fn().mockReturnValue('Mocked guardrails'),
}));

jest.mock('../tool/sales-property.repository', () => ({
  findPropertiesByAgentId: jest.fn().mockResolvedValue([
    {
      id: 'prop_001',
      name: 'Sunrise Valley Residences',
      companyId: 'comp_1',
      agentId: 'agent_1',
      description: 'A premium 3BHK at 85 lakhs in Whitefield.',
    },
    {
      id: 'prop_002',
      name: 'Green Crest Villas',
      companyId: 'comp_1',
      agentId: 'agent_1',
      description: 'A 4BHK villa at 1.25 crore in Sarjapur.',
    },
  ]),
}));

jest.mock('../tool/rag.tools', () => ({
  retrievePresentationContext: jest.fn().mockResolvedValue(null),
  retrieveAmenitiesContext: jest.fn().mockResolvedValue(null),
  retrieveNearbyFacilitiesContext: jest.fn().mockResolvedValue(null),
  retrieveFaqContext: jest.fn().mockResolvedValue(null),
}));

jest.mock('../tool/sales.tools', () => ({
  formatPrice: jest.fn((price: number) => `${price} INR`),
  lookupFaq: jest.fn().mockReturnValue(null),
  raiseServiceRequestTicket: jest.fn().mockResolvedValue({
    confirmed: true,
    ticketId: 'SR-TEST-123',
    message: 'Ticket confirmed',
  }),
  saveLeadToCrm: jest.fn().mockResolvedValue(true),
}));

import { llmInstance } from '../../../llms/google.llm.js';

describe('Sales Agent E2E Flow', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const getInitialState = (): Partial<SalesState> => ({
    messages: [],
    customerName: null,
    budgetMin: null,
    budgetMax: null,
    buyerType: null,
    preferredType: null,
    preferredLocation: null,
    properties: [],
    currentPropertyIndex: 0,
    purchaseIntentPropertyId: null,
    siteVisitInterested: null,
    siteVisitPreferredDate: null,
    siteVisitTimeSlot: null,
    currentNode: '',
    routeDestination: '',
  });

  it('should greet customer on initial connection', async () => {
    const mockRouter = {
      invoke: jest.fn().mockResolvedValueOnce({ routeDestination: 'Greeting_Pitch_Node' }),
    };

    (llmInstance.withStructuredOutput as jest.Mock).mockImplementation((_, options) => {
      if (options.name === 'route_sales_user') return mockRouter;
    });
    (llmInstance.invoke as jest.Mock).mockResolvedValue(new AIMessage('Hello! I am calling from XYZ Properties.'));

    const state = await salesGraph.invoke(getInitialState(), { configurable: { thread_id: 'test_1' } });

    expect(state.currentNode).toBe('Greeting_Pitch_Node');
  });

  it('should complete Consultative Flow: Greeting → Consultative Discovery → Listing → Presentation → Closing (Site Visit)', async () => {
    const mockRouter = { invoke: jest.fn() };
    const mockDiscovery = { invoke: jest.fn() };
    const mockBudget = { invoke: jest.fn() };
    const mockPresentation = { invoke: jest.fn() };
    const mockClosing = { invoke: jest.fn() };

    (llmInstance.withStructuredOutput as jest.Mock).mockImplementation((_, options) => {
      if (options.name === 'route_sales_user') return mockRouter;
      if (options.name === 'extract_preferences') return mockDiscovery;
      if (options.name === 'extract_budget') return mockBudget;
      if (options.name === 'extract_presentation') return mockPresentation;
      if (options.name === 'closing_extract') return mockClosing;
    });
    (llmInstance.invoke as jest.Mock).mockResolvedValue(new AIMessage('Conversational response'));

    // Turn 1: Start → Greeting
    mockRouter.invoke.mockResolvedValueOnce({ routeDestination: 'Greeting_Pitch_Node' });
    let state = await salesGraph.invoke(getInitialState(), { configurable: { thread_id: 'test_2' } });
    expect(state.currentNode).toBe('Greeting_Pitch_Node');

    // Turn 2: Customer shares preference (Discovery)
    mockRouter.invoke.mockResolvedValueOnce({ routeDestination: 'Discovery_Node' });
    mockDiscovery.invoke.mockResolvedValueOnce({
      buyerType: 'end_user',
      preferredType: '3BHK',
      preferredLocation: 'Whitefield',
      moveInTimeline: 'ready to move',
      customerName: 'Ravi',
      customerAddress: null,
      siteVisitInterested: null,
      siteVisitPreferredDate: null,
      responseToUser: 'A 3BHK in Whitefield for your family is a wonderful choice! What is your rough budget?',
    });
    state.messages.push(new AIMessage('I am looking for a 3BHK for my family in Whitefield.'));
    state = await salesGraph.invoke(state, { configurable: { thread_id: 'test_2' } });
    expect(state.currentNode).toBe('Discovery_Node');
    expect(state.buyerType).toBe('end_user');
    expect(state.preferredType).toBe('3BHK');
    expect(state.customerName).toBe('Ravi');

    // Turn 3: Customer shares budget → Budget Discovery → chains into Property Listing
    mockRouter.invoke.mockResolvedValueOnce({ routeDestination: 'Budget_Discovery_Node' });
    mockBudget.invoke.mockResolvedValueOnce({
      budgetMin: 7_000_000,
      budgetMax: 10_000_000,
      customerName: 'Ravi',
      preferredLocation: 'Whitefield',
      responseToUser: 'Great, let me pull up properties in that range.',
    });
    state.messages.push(new AIMessage('My budget is around 70 lakhs to 1 crore.'));
    state = await salesGraph.invoke(state, { configurable: { thread_id: 'test_2' } });
    expect(state.currentNode).toBe('Property_Listing_Node');
    expect(state.budgetMin).toBe(7_000_000);
    expect(state.budgetMax).toBe(10_000_000);

    // Turn 4: Customer explores Option 1 → Presentation Node
    mockRouter.invoke.mockResolvedValueOnce({ routeDestination: 'Presentation_Node' });
    mockPresentation.invoke.mockResolvedValueOnce({
      requestedIndex: 0,
      purchaseIntent: true,
      shortlistProperty: true,
      responseToUser: 'Sunrise Valley offers 1850 square feet with large balconies. Pricing starts at 85 lakhs. Does that work for your budget?',
    });
    state.messages.push(new AIMessage('Tell me about the first one with large balconies.'));
    state = await salesGraph.invoke(state, { configurable: { thread_id: 'test_2' } });
    expect(state.currentNode).toBe('Presentation_Node');
    expect(state.currentPropertyIndex).toBe(0);

    // Turn 5: Customer agrees and schedules site visit → Closing Node
    mockRouter.invoke.mockResolvedValueOnce({ routeDestination: 'Closing_Node' });
    mockClosing.invoke.mockResolvedValueOnce({
      agreedToVisitOrProceed: true,
      siteVisitPreferredDate: 'Saturday',
      siteVisitTimeSlot: 'morning',
      cabRequired: true,
      customerName: 'Ravi Kumar',
      customerAddress: 'Indiranagar',
      responseToUser: 'Wonderful! Your site visit is scheduled for Saturday morning with complimentary cab pickup. Our manager will connect with your pass.',
    });
    state.messages.push(new AIMessage('Yes, that price works. I would like to visit this Saturday morning.'));
    state = await salesGraph.invoke(state, { configurable: { thread_id: 'test_2' } });
    expect(state.currentNode).toBe('Closing_Node');
    expect(state.siteVisitPreferredDate).toBe('Saturday');
    expect(state.siteVisitTimeSlot).toBe('morning');
    expect(state.serviceRequestRaised).toBe(true);
    expect(state.leadSaved).toBe(true);
  });

  it('should route to Graceful Rejection when customer is not interested', async () => {
    const mockRouter = {
      invoke: jest.fn().mockResolvedValueOnce({ routeDestination: 'Graceful_Rejection_Node' }),
    };

    (llmInstance.withStructuredOutput as jest.Mock).mockImplementation((_, options) => {
      if (options.name === 'route_sales_user') return mockRouter;
    });
    (llmInstance.invoke as jest.Mock).mockResolvedValue(new AIMessage('Thank you for your time. Goodbye!'));

    const initial = { ...getInitialState(), currentNode: 'Greeting_Pitch_Node' };
    const state = await salesGraph.invoke(initial, { configurable: { thread_id: 'test_3' } });

    expect(state.currentNode).toBe('Graceful_Rejection_Node');
  });

  it('should allow property switching via Presentation_Node', async () => {
    const mockRouter = { invoke: jest.fn().mockResolvedValue({ routeDestination: 'Presentation_Node' }) };
    const mockPresentation = {
      invoke: jest.fn().mockResolvedValueOnce({
        requestedIndex: 1, // switched to property 2
        purchaseIntent: false,
        shortlistProperty: false,
        responseToUser: 'Green Crest offers 4BHK independent villas with private gardens.',
      }),
    };

    (llmInstance.withStructuredOutput as jest.Mock).mockImplementation((_, options) => {
      if (options.name === 'route_sales_user') return mockRouter;
      if (options.name === 'extract_presentation') return mockPresentation;
    });
    (llmInstance.invoke as jest.Mock).mockResolvedValue(new AIMessage('General response'));

    const initial: Partial<SalesState> = {
      ...getInitialState(),
      currentNode: 'Property_Listing_Node',
      budgetMin: 5_000_000,
      budgetMax: 15_000_000,
      properties: [
        {
          id: 'prop_001', name: 'Sunrise Valley Residences', companyId: 'comp_1', agentId: 'agent_1',
          description: '3BHK apartment in Whitefield',
        },
        {
          id: 'prop_002', name: 'Green Crest Villas', companyId: 'comp_1', agentId: 'agent_1',
          description: '4BHK villa in Sarjapur',
        },
      ],
      currentPropertyIndex: 0,
    };

    initial.messages = [new AIMessage('What about the second property?')];
    const state = await salesGraph.invoke(initial, { configurable: { thread_id: 'test_4' } });

    expect(state.currentNode).toBe('Presentation_Node');
    expect(state.currentPropertyIndex).toBe(1);
  });
});
