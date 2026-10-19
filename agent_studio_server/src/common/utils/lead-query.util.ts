/**
 * Builds a Mongo filter for lead-listing queries: an optional case-insensitive
 * name/phone search plus an optional inclusive date range, layered on top of
 * a caller-supplied base filter (e.g. `{ customerId }`).
 */
export function buildLeadFilter(
  base: Record<string, unknown>,
  options: {
    search?: string;
    fromDate?: string;
    toDate?: string;
    dateField: string;
  },
): Record<string, unknown> {
  const filter: Record<string, unknown> = { ...base };

  if (options.search) {
    const regex = new RegExp(escapeRegex(options.search), 'i');
    filter.$or = [{ fullName: regex }, { phoneNumber: regex }];
  }

  if (options.fromDate || options.toDate) {
    const range: Record<string, Date> = {};
    if (options.fromDate) {
      range.$gte = new Date(options.fromDate);
    }
    if (options.toDate) {
      range.$lte = new Date(options.toDate);
    }
    filter[options.dateField] = range;
  }

  return filter;
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
