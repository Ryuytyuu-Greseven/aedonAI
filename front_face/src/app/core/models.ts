export type CallDirection = 'Outbound' | 'Inbound' | 'Inbound & Outbound';

export interface TranscriptLine {
  speaker: 'agent' | 'customer';
  text: string;
  /** Flow node that produced the agent turn (shown live in the simulator). */
  node?: string;
}

export interface Solution {
  slug: string;
  name: string;
  shortName: string;
  icon: string;
  tagline: string;
  summary: string;
  direction: CallDirection;
  agentName: string;
  outcomes: string[];
  flow: string[];
  captures: string[];
  conversation: TranscriptLine[];
}

export interface Feature {
  icon: string;
  title: string;
  description: string;
}

export interface Step {
  title: string;
  description: string;
  icon: string;
}

export interface Stat {
  value: string;
  label: string;
}

export interface PricingPlan {
  name: string;
  description: string;
  monthly: number | null;
  includedMinutes: string;
  overage: string;
  features: string[];
  cta: string;
  highlighted?: boolean;
}

export interface Faq {
  question: string;
  answer: string;
}

export interface DemoRequest {
  name: string;
  email: string;
  company: string;
  phone: string;
  industry: string;
  monthlyCalls: string;
  message: string;
}
