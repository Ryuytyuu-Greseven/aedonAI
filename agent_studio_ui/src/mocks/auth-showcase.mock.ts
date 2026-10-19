/** Decorative content for the logged-out showcase panel (login / forgot / reset password). */

export interface ShowcaseAgent {
  name: string;
  language: string;
}

export interface ShowcaseEvent {
  icon: string;
  tone: 'brand' | 'success' | 'warm' | 'info';
  title: string;
  detail: string;
}

export const SHOWCASE_AGENTS: ShowcaseAgent[] = [
  { name: 'Clara', language: 'EN' },
  { name: 'Arjun', language: 'HI' },
  { name: 'Maya', language: 'TE' },
];

export const SHOWCASE_VERBS = ['calling new leads', 'qualifying buyers', 'booking site visits', 'closing deals'];

export const SHOWCASE_EVENTS: ShowcaseEvent[] = [
  { icon: 'fa-calendar-check', tone: 'success', title: 'Site visit booked', detail: 'Clara · Kondapur · Sat 11:00' },
  { icon: 'fa-language', tone: 'info', title: 'Switched to Hindi mid-call', detail: 'Arjun · Two-wheelers' },
  { icon: 'fa-fire', tone: 'warm', title: 'Hot lead · score 86', detail: 'Priya S. · 3 BHK · ₹1.5 Cr' },
  { icon: 'fa-motorcycle', tone: 'brand', title: 'Test ride scheduled', detail: 'Arjun · Madhapur showroom' },
  { icon: 'fa-paper-plane', tone: 'info', title: 'Lead pushed to CRM', detail: 'Webhook · 142 ms' },
  { icon: 'fa-store', tone: 'success', title: 'Store request raised', detail: 'Maya · 340 L refrigerator' },
  { icon: 'fa-brands fa-whatsapp', tone: 'success', title: 'Owner notified on WhatsApp', detail: 'Daily summary · 38 leads' },
];

export const SHOWCASE_COUNTERS = [
  { label: 'Calls today', start: 1284, step: 3 },
  { label: 'Leads captured', start: 312, step: 1 },
];
