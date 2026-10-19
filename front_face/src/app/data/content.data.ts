import { Faq, Feature, PricingPlan, Stat, Step } from '../core/models';

export const HERO_STATS: Stat[] = [
  { value: '<800ms', label: 'Average response latency' },
  { value: '5+', label: 'Indian & global languages, code-switched mid-call' },
  { value: '24/7', label: 'Inbound & outbound coverage' },
  { value: '100%', label: 'Calls transcribed, scored & logged' },
];

export const STEPS: Step[] = [
  {
    icon: 'fa-wand-magic-sparkles',
    title: 'Pick an agent',
    description: 'Start from a battle-tested template — real estate, automotive or home appliances — or design your own flow.',
  },
  {
    icon: 'fa-book-open',
    title: 'Teach your business',
    description: 'Set the name, greeting and behaviour. Upload brochures, catalogues and FAQs to a knowledge base it can search mid-call.',
  },
  {
    icon: 'fa-plug',
    title: 'Connect numbers & leads',
    description: 'Attach a phone number, sync Meta lead ads or push contacts from your CRM. New leads get a call within minutes.',
  },
  {
    icon: 'fa-chart-line',
    title: 'Preview, launch & monitor',
    description: 'Talk to your agent before it goes live. Then watch calls, leads and outcomes roll in on a live dashboard.',
  },
];

export const PLATFORM_FEATURES: Feature[] = [
  {
    icon: 'fa-diagram-project',
    title: 'Graph-based conversation flows',
    description: 'Every agent is a graph of focused nodes — greeting, discovery, objection handling, closing — orchestrated by a semantic router that picks the right next step each turn.',
  },
  {
    icon: 'fa-language',
    title: 'Multilingual with code-switching',
    description: 'English, Hindi, Telugu, Tamil, Kannada and more. Callers can switch language mid-sentence and the agent follows — in a matching voice.',
  },
  {
    icon: 'fa-comments',
    title: 'Natural barge-in',
    description: 'Customers interrupt, agents listen. Real-time streaming speech means no awkward talking over each other.',
  },
  {
    icon: 'fa-database',
    title: 'Knowledge base & catalogue search',
    description: 'Vector search over your documents, listings and product catalogues so answers are accurate, specific and grounded in your data.',
  },
  {
    icon: 'fa-phone-volume',
    title: 'Telephony built in',
    description: 'Connect Twilio or Exotel numbers, run outbound campaigns or take inbound calls — or embed a web call on your own site.',
  },
  {
    icon: 'fa-user-check',
    title: 'Automatic lead intelligence',
    description: 'After every call, Aedon extracts structured lead data, interest level, next steps and action items — no manual notes.',
  },
  {
    icon: 'fa-paper-plane',
    title: 'Real-time exports',
    description: 'Send each outcome to your API, CRM, WhatsApp, SMS or email the moment a call ends.',
  },
  {
    icon: 'fa-file-excel',
    title: 'Scheduled reports',
    description: 'Daily, weekly or monthly Excel reports of every lead — downloaded on demand or delivered to email and WhatsApp.',
  },
  {
    icon: 'fa-user-group',
    title: 'Seamless human handoff',
    description: 'When a caller is ready to buy or needs a person, the agent transfers the call with a full summary for your team.',
  },
  {
    icon: 'fa-gift',
    title: 'Referral engine',
    description: 'Sales agents mention your referral bonus — in USD, INR, AED, GBP, EUR, THB and more — and capture friends’ numbers as new leads.',
  },
  {
    icon: 'fa-code-branch',
    title: 'Drafts, versions & clones',
    description: 'Every prompt and node change is versioned. Preview drafts, roll back in a click, or clone a winning agent for a new campaign.',
  },
  {
    icon: 'fa-gauge-high',
    title: 'Live monitoring',
    description: 'Watch active calls, inbound vs outbound volume and per-agent performance in real time across your whole fleet.',
  },
];

export const INTEGRATIONS: { name: string; icon: string }[] = [
  { name: 'Twilio', icon: 'fa-phone' },
  { name: 'Exotel', icon: 'fa-tower-cell' },
  { name: 'Meta Lead Ads', icon: 'fa-bullhorn' },
  { name: 'WhatsApp', icon: 'fa-comment-dots' },
  { name: 'Email', icon: 'fa-envelope' },
  { name: 'SMS', icon: 'fa-message' },
  { name: 'REST / Webhooks', icon: 'fa-code' },
  { name: 'Excel Reports', icon: 'fa-table' },
];

export const LANGUAGES: string[] = ['English', 'हिन्दी', 'తెలుగు', 'தமிழ்', 'ಕನ್ನಡ', 'Español', 'Français', 'Deutsch', 'العربية'];

export const PRICING_PLANS: PricingPlan[] = [
  {
    name: 'Starter',
    description: 'For teams testing voice AI on a single use-case.',
    monthly: 99,
    includedMinutes: '1,000 minutes',
    overage: '$0.12 / extra minute',
    features: ['1 live agent', 'All industry templates', '1 phone number', 'Lead capture & transcripts', 'Email exports'],
    cta: 'Start free trial',
  },
  {
    name: 'Growth',
    description: 'For sales and support teams running campaigns at scale.',
    monthly: 399,
    includedMinutes: '5,000 minutes',
    overage: '$0.09 / extra minute',
    features: ['Up to 10 live agents', 'Knowledge bases & catalogue search', 'Meta lead ads auto-calling', 'WhatsApp, SMS & API exports', 'Scheduled Excel reports', 'Version history & clones'],
    cta: 'Start free trial',
    highlighted: true,
  },
  {
    name: 'Enterprise',
    description: 'For multi-brand businesses and large sales teams.',
    monthly: null,
    includedMinutes: 'Volume pricing',
    overage: 'Custom rates',
    features: ['Unlimited agents', 'Custom conversation flows', 'Dedicated numbers & SIP trunks', 'SSO & role-based access', 'Priority support & SLA', 'On-prem / private cloud option'],
    cta: 'Talk to sales',
  },
];

export const FAQS: Faq[] = [
  {
    question: 'Does it really sound human?',
    answer: 'Yes. Aedon streams speech in both directions, responds in well under a second and lets callers interrupt naturally. Most customers can’t tell they’re talking to an AI until they’re told.',
  },
  {
    question: 'Which languages are supported?',
    answer: 'English, Hindi, Telugu, Tamil and Kannada with live code-switching, plus major global languages. The agent detects the switch and replies in a matching voice.',
  },
  {
    question: 'Can I use my existing phone numbers?',
    answer: 'You can bring numbers from Twilio or Exotel, buy new ones from the dashboard, or connect a SIP trunk on Enterprise.',
  },
  {
    question: 'How does the agent know about my products?',
    answer: 'Upload brochures, price lists, FAQs or a product catalogue. Aedon indexes them for semantic search and pulls exact answers during the call.',
  },
  {
    question: 'Where does call data go?',
    answer: 'Every call produces a transcript, a structured lead and action items. Push them to your CRM or API in real time, get WhatsApp/SMS/email alerts, or download scheduled Excel reports.',
  },
  {
    question: 'Can I test before going live?',
    answer: 'Absolutely. Every agent starts as a draft. Use preview to talk to it from your browser or phone, tweak it, and launch only when you’re happy.',
  },
];

/** Decorative "live fleet" feed shown in the home hero. */
export const HERO_LIVE_CALLS: { agent: string; industry: string; node: string; language: string; duration: string }[] = [
  { agent: 'Clara', industry: 'Real Estate', node: 'Nearby Facilities', language: 'EN', duration: '02:41' },
  { agent: 'Arjun', industry: 'Two-Wheelers', node: 'Specs & Features', language: 'HI', duration: '01:12' },
  { agent: 'Maya', industry: 'Appliances', node: 'Delivery & Installation', language: 'TE', duration: '00:38' },
];

/** Sample post-call lead used to illustrate conversation analysis output. */
export const SAMPLE_LEAD = {
  name: 'Priya Sharma',
  phone: '+91 98xxx xx210',
  agent: 'Clara · Real Estate',
  interest: 'Hot',
  score: 86,
  summary: 'Looking for a 3 BHK in Kondapur, budget ₹1.4–1.6 Cr, wants a school nearby. Site visit booked for Saturday 11 am.',
  fields: [
    { label: 'Budget', value: '₹1.5 Cr' },
    { label: 'Configuration', value: '3 BHK' },
    { label: 'Locality', value: 'Kondapur' },
    { label: 'Timeline', value: '< 3 months' },
  ],
  actions: ['Confirm site visit on WhatsApp', 'Share Skyline brochure', 'Assign to sales manager'],
};
