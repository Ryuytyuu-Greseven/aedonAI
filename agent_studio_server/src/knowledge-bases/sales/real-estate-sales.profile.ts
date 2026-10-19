/**
 * The one formatting profile supported today ("real_estate_sales",
 * hardcoded — see KnowledgeBaseSalesFormatterService). Defines the fixed
 * section schema an uploaded document/url is reorganized into, the prompt
 * instructing the model how to fill it, and a deterministic renderer that
 * turns the populated sections back into plain text for chunking/embedding.
 */
export interface RealEstateSalesSections {
  projectOverview: string | null;
  projectHighlights: string | null;
  propertyDetails: string | null;
  amenities: string | null;
  specifications: string | null;
  nearbyFacilities: string | null;
  locationConnectivity: string | null;
  additionalFeatures: string | null;
  aboutDeveloper: string | null;
}

/** Fixed rendering order + heading text for each section. */
export const REAL_ESTATE_SALES_SECTIONS: {
  key: keyof RealEstateSalesSections;
  heading: string;
  description: string;
}[] = [
  {
    key: 'projectOverview',
    heading: 'Project Overview',
    description: 'A general summary of the project/property as a whole.',
  },
  {
    key: 'projectHighlights',
    heading: 'Project Highlights',
    description: 'Standout selling points called out as highlights.',
  },
  {
    key: 'propertyDetails',
    heading: 'Property Details',
    description:
      'Concrete details about the property itself: unit types, sizes, configurations, pricing, possession/completion dates, etc.',
  },
  {
    key: 'amenities',
    heading: 'Amenities',
    description:
      'On-site amenities such as pool, gym, clubhouse, garden, play area, etc.',
  },
  {
    key: 'specifications',
    heading: 'Specifications',
    description:
      'Technical/build specifications: internet/connectivity, painting, parking, security systems, billing systems, LPG/PNG connections, lifts/elevators, and similar.',
  },
  {
    key: 'nearbyFacilities',
    heading: 'Nearby Facilities',
    description:
      'General facilities near the property not covered by location connectivity below (e.g. malls, restaurants, parks).',
  },
  {
    key: 'locationConnectivity',
    heading: 'Location & Connectivity',
    description:
      'Distance/connectivity to schools, colleges, healthcare facilities, transit, and similar.',
  },
  {
    key: 'additionalFeatures',
    heading: 'Additional Features',
    description:
      'Any other notable features or facilities about the building or property not captured above.',
  },
  {
    key: 'aboutDeveloper',
    heading: 'About the Developer',
    description: 'Background on the developer/builder behind the project.',
  },
];

export const REAL_ESTATE_SALES_PROMPT = `You are formatting a real-estate document or web page into a fixed set of sections for a sales agent's knowledge base.

Read the raw text below and extract content for each of these sections:
${REAL_ESTATE_SALES_SECTIONS.map((s) => `- ${s.key}: ${s.description}`).join('\n')}

Rules:
- Only include information that is actually present in the raw text. Do not invent, assume, or fabricate content for a section.
- If the raw text has no relevant information for a section, set that field to null.
- Where present, preserve concrete facts (numbers, names, distances, prices) exactly as stated.
- Write each populated section as clear plain text (short paragraphs and/or bullet points are fine).
- Do not include the section headings in the field values — just the content.

Raw text:
"""
{{RAW_TEXT}}
"""`;

/**
 * Deterministically renders populated sections into plain text with fixed
 * headings, skipping any section the model returned null for. This is what
 * actually gets chunked/embedded — never the model's raw JSON.
 */
export function renderRealEstateSections(
  sections: RealEstateSalesSections,
): string {
  return REAL_ESTATE_SALES_SECTIONS.filter(
    ({ key }) => sections[key] && sections[key].trim().length > 0,
  )
    .map(({ key, heading }) => `## ${heading}\n${sections[key]!.trim()}`)
    .join('\n\n');
}
