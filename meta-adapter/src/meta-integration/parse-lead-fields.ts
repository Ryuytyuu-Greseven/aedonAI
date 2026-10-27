export interface ParsedLeadFields {
  fullName: string;
  phoneNumber: string;
  email: string;
  customFields: Record<string, any>;
}

/**
 * Flattens a Graph API lead's `field_data` array into the standard
 * contact fields, with any other form questions kept in customFields.
 * Shared by the webhook path and the polling sync so both store leads
 * identically.
 */
export function parseLeadFields(fieldData: { name: string; values?: string[] }[] = []): ParsedLeadFields {
  const parsed: ParsedLeadFields = { fullName: '', phoneNumber: '', email: '', customFields: {} };

  for (const field of fieldData) {
    const val = field.values?.[0] || '';
    switch (field.name) {
      case 'full_name':
        parsed.fullName = val;
        break;
      case 'phone_number':
        parsed.phoneNumber = val;
        break;
      case 'email':
        parsed.email = val;
        break;
      default:
        parsed.customFields[field.name] = val;
        break;
    }
  }

  return parsed;
}
