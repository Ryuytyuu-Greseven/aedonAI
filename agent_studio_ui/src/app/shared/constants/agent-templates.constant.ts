/**
 * Real backend template ids for the sales agents — confirmed live, not the stale ids in
 * agent-templates.mock.ts. Each runs on its own agent server (routed by calls_input_gateway's
 * business registry, keyed by these same ids), and only agents built from them have products
 * (`sales_properties`).
 */
export const REAL_ESTATE_SALES_TEMPLATE_ID = 'real_estate_sales';
export const MOTOR_CYCLES_SALES_TEMPLATE_ID = 'motor_cycles_sales';
export const HOME_APPLIANCES_SALES_TEMPLATE_ID = 'home_appliances_sales';

export const SALES_TEMPLATE_IDS: readonly string[] = [
  REAL_ESTATE_SALES_TEMPLATE_ID,
  MOTOR_CYCLES_SALES_TEMPLATE_ID,
  HOME_APPLIANCES_SALES_TEMPLATE_ID,
];

export function isSalesTemplate(templateId: string | null | undefined): boolean {
  return !!templateId && SALES_TEMPLATE_IDS.includes(templateId);
}
