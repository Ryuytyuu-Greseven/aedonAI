import { AgentTemplate } from '../app/core/models/agent-template.model';

export const MOCK_AGENT_TEMPLATES: AgentTemplate[] = [
  {
    template_id: 'template-real-estate-sales',
    name: 'Real Estate Sales',
    description: 'Calls prospective buyers, qualifies interest, and books property viewings.',
    default_greeting: "Hi, this is Lyre AI calling on behalf of our real estate team — do you have a moment to chat about your property search?",
    default_prompt:
      'Qualify the caller’s budget, preferred location, and timeline. Offer to schedule a viewing and answer basic questions about listings.',
    default_behavior: 'Friendly, consultative, and persistent without being pushy. Always ends with a clear next step.',
    referral_bonus_eligible: true,
  },
  {
    template_id: 'template-survey',
    name: 'Survey',
    description: 'Runs a short structured survey and records responses as leads.',
    default_greeting: 'Hi, thanks for taking a moment to share your feedback with us today.',
    default_prompt: 'Ask each survey question in order, record the response, and thank the caller at the end.',
    default_behavior: 'Neutral and efficient; keeps the call brief and does not editorialize on answers.',
    referral_bonus_eligible: false,
  },
  {
    template_id: 'template-contact-centre',
    name: 'Contact Centre',
    description: 'Handles inbound support calls and routes or resolves common requests.',
    default_greeting: 'Thanks for calling, how can I help you today?',
    default_prompt: 'Understand the caller’s issue, resolve it directly if possible, or escalate to a human agent.',
    default_behavior: 'Calm, empathetic, and solution-oriented. Confirms understanding before acting.',
    referral_bonus_eligible: false,
  },
  {
    template_id: 'template-alerting',
    name: 'Alerting',
    description: 'Places outbound calls to notify recipients of time-sensitive alerts.',
    default_greeting: 'Hello, this is an important automated notification, please listen carefully.',
    default_prompt: 'Deliver the alert message clearly, confirm the recipient understood it, and log the acknowledgment.',
    default_behavior: 'Direct and clear; repeats key details and confirms receipt before ending the call.',
    referral_bonus_eligible: false,
  },
  {
    template_id: 'template-general',
    name: 'General',
    description: 'A general-purpose conversational agent for everyday call handling.',
    default_greeting: 'Hi there, how can I help you today?',
    default_prompt: 'Have a natural, helpful conversation and assist with whatever the caller needs.',
    default_behavior: 'Friendly and adaptable, with no specific script beyond being helpful and polite.',
    referral_bonus_eligible: false,
  },
];
