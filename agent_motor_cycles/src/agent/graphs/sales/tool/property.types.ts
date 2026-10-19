export interface PropertyAmenity {
  name: string;
  description: string;
}

export interface NearbyFacility {
  category: 'school' | 'hospital' | 'park' | 'restaurant' | 'mall' | 'metro' | 'other';
  name: string;
  distance: string;
}

export interface Property {
  id: string;
  name: string;
  location: string;
  price: number;
  type: string;
  bedrooms: number;
  bathrooms: number;
  sqft: number;
  highlights: string[];
  shortPitch: string;
  fullDescription: string;
  amenities: PropertyAmenity[];
  nearbyFacilities: NearbyFacility[];
}

// The Mongo-stored shape carries the embedding vector; app code otherwise
// only ever deals with `Property`.
export type PropertyDocument = Property & { embedding?: number[] };
