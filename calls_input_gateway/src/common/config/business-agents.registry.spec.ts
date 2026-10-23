import { getAgentUrl, isKnownBusiness } from './business-agents.registry';

describe('business-agents registry — sales agents', () => {
  it.each([
    ['real_estate_sales', 'SALES_AGENT_URL', 'ws://localhost:4006'],
    ['motor_cycles_sales', 'MOTOR_CYCLES_AGENT_URL', 'ws://localhost:4013'],
    ['home_appliances_sales', 'HOME_APPLIANCES_AGENT_URL', 'ws://localhost:4014'],
  ])('routes %s to its own agent server', (templateId, envVar, localDefault) => {
    expect(isKnownBusiness(templateId)).toBe(true);
    expect(getAgentUrl(templateId)).toBe(process.env[envVar] ?? localDefault);
  });

  it('gives the three sales agents distinct servers', () => {
    const urls = ['real_estate_sales', 'motor_cycles_sales', 'home_appliances_sales'].map(getAgentUrl);
    expect(new Set(urls).size).toBe(3);
  });
});
