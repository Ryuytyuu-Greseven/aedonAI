/**
 * The one formatting profile supported today ("real_estate_sales",
 * hardcoded — see KnowledgeBaseSalesFormatterService). Defines the fixed
 * section schema an uploaded document/url is reorganized into, the prompt
 * instructing the model how to fill it, and a deterministic step that turns
 * the populated sections into ordered, headed text for chunking/embedding.
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

/** The formatter model's full structured output: the sections plus the document's subject. */
export type RealEstateSalesFormatterOutput = RealEstateSalesSections & {
  subjectName: string | null;
};

export const SUBJECT_NAME_DESCRIPTION =
  'The name of the main project/property this document is about (e.g. "The Sky View Grand"), exactly as written. Null if there is no single main project.';

/** One populated section, in fixed rendering order. */
export interface FormattedSection {
  key: keyof RealEstateSalesSections;
  heading: string;
  text: string;
}

export interface FormattedSalesDocument {
  subjectName: string | null;
  sections: FormattedSection[];
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

Also set subjectName: ${SUBJECT_NAME_DESCRIPTION}

Rules:
- Reorganize, do not summarize. Every fact in the raw text must appear in exactly one section: every list item, every table row, every name, number, distance, price, date and condition. A sales agent will answer customer questions only from your output, so anything you drop is lost.
- Keep lists as lists (one item per line, prefixed with "- "), and turn table rows into lines such as "- Apollo Hospitals, Health City, Arilova: 4 km".
- Facts that fit no other section (payment plans, booking amounts, offers, FAQs, site-visit timings, contact details) go in additionalFeatures.
- Only include information that is actually present in the raw text. Do not invent, assume, or fabricate content for a section.
- If the raw text has no relevant information for a section, set that field to null.
- Preserve concrete facts (numbers, names, distances, prices) exactly as stated.
- Drop page furniture only: repeated page headers/footers, page numbers and disclaimers that repeat on every page.
- Do not include the section headings in the field values — just the content.

Raw text:
"""
{{RAW_TEXT}}
"""`;

/**
 * Deterministically turns the model's output into ordered sections with
 * fixed headings, skipping any section the model returned null/blank for.
 * Each section is chunked separately, so a chunk never spans two sections.
 */
export function toFormattedSalesDocument(
  output: RealEstateSalesFormatterOutput,
): FormattedSalesDocument {
  return {
    subjectName: output.subjectName?.trim() || null,
    sections: REAL_ESTATE_SALES_SECTIONS.flatMap(({ key, heading }) => {
      const text = output[key]?.trim();
      return text ? [{ key, heading, text }] : [];
    }),
  };
}
