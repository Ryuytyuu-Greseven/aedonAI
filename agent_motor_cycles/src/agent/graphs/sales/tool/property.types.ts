export interface PropertyAmenity {
  name: string;
  description: string;
}

export interface NearbyFacility {
  category: 'showroom' | 'service_center' | 'charging_station' | 'school' | 'hospital' | 'park' | 'restaurant' | 'mall' | 'metro' | 'other';
  name: string;
  distance: string;
}

export interface Property {
  id: string;
  name: string;
  location: string;
  price: number;
  onRoadPrice?: number;
  type: string;
  engineCc?: number;
  mileageKmpl?: number;
  powerBhp?: number;
  torqueNm?: number;
  fuelCapacityLiters?: number;
  seatHeightMm?: number;
  kerbWeightKg?: number;
  sampleEmi?: string;
  highlights: string[];
  availableColors?: string[];
  shortPitch: string;
  fullDescription: string;
  amenities: PropertyAmenity[];
  nearbyFacilities: NearbyFacility[];
  // Backwards compatibility fields for legacy callers
  bedrooms?: number;
  bathrooms?: number;
  sqft?: number;
}

// The Mongo-stored shape carries the embedding vector; app code otherwise
// only ever deals with `Property`.
export type PropertyDocument = Property & { embedding?: number[] };
