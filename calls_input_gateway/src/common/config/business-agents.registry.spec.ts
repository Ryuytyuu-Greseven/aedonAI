import {
  BUSINESS_AGENT_URLS,
  getAgentUrl,
  isKnownBusiness,
} from './business-agents.registry';

// Per-business routing is checked with the lobster_agent override off ('').

describe('business-agents registry — sales agents', () => {
  it.each([
    ['real_estate_sales', 'SALES_AGENT_URL', 'ws://localhost:4006'],
    ['motor_cycles_sales', 'MOTOR_CYCLES_AGENT_URL', 'ws://localhost:4013'],
    ['home_appliances_sales', 'HOME_APPLIANCES_AGENT_URL', 'ws://localhost:4014'],
  ])('routes %s to its own agent server', (templateId, envVar, localDefault) => {
    expect(isKnownBusiness(templateId)).toBe(true);
    expect(getAgentUrl(templateId, '')).toBe(process.env[envVar] ?? localDefault);
  });

  it('gives the three sales agents distinct servers', () => {
    const urls = ['real_estate_sales', 'motor_cycles_sales', 'home_appliances_sales'].map((id) => getAgentUrl(id, ''));
    expect(new Set(urls).size).toBe(3);
  });
});

describe('business-agents registry — lobster_agent override', () => {
  it('sends every call to lobster_agent when forced', () => {
    for (const business of ['real_estate_sales', 'hiring', 'unknown-thing', undefined]) {
      expect(getAgentUrl(business, 'lobster_agent')).toBe(BUSINESS_AGENT_URLS.lobster_agent);
    }
  });

  it('falls back to normal routing when the forced business is unknown', () => {
    expect(getAgentUrl('real_estate_sales', 'nope')).toBe(getAgentUrl('real_estate_sales', ''));
  });
});
