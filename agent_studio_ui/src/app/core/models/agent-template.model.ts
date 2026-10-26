export interface AgentTemplate {
  template_id: string;
  name: string;
  description: string;
  default_greeting: string;
  default_prompt: string;
  default_behavior: string;
  referral_bonus_eligible: boolean;
}

const TEMPLATE_ICONS: Record<string, string> = {
  real_estate_sales: 'fa-solid fa-house-chimney',
  motor_cycles_sales: 'fa-solid fa-motorcycle',
  home_appliances_sales: 'fa-solid fa-blender',
  lobster_agent: 'fa-solid fa-heart',
  'template-real-estate-sales': 'fa-solid fa-house-chimney',
  'template-survey': 'fa-solid fa-clipboard-list',
  'template-contact-centre': 'fa-solid fa-headset',
  'template-alerting': 'fa-solid fa-triangle-exclamation',
  'template-general': 'fa-solid fa-comments',
};
const DEFAULT_TEMPLATE_ICON = 'fa-solid fa-robot';

export function templateIcon(templateId: string | undefined): string {
  if (!templateId) return DEFAULT_TEMPLATE_ICON;
  return TEMPLATE_ICONS[templateId] ?? DEFAULT_TEMPLATE_ICON;
}
