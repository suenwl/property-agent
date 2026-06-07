export interface FilterState {
  listing_type: "rental" | "sale" | null;
  property_category: "hdb" | "private" | null;
  bedrooms_min: number | null;
  bedrooms_max: number | null;
  price_per_month_min: number | null;
  price_per_month_max: number | null;
  price_min: number | null;
  price_max: number | null;
  town: string[] | null;
  furnishing: Array<"Unfurnished" | "Partially Furnished" | "Fully Furnished"> | null;
  pets_allowed: boolean | null;
  size_sqft_min: number | null;
  flat_type: string | null;
  built_year_min: number | null;
  built_year_max: number | null;
}

export interface PropertyDoc {
  _id: string;
  listing_id: string;
  town: string;
  location: { lat: number; lon: number };
  built_year: number;
  indexed_at: string;
  listing_type: "rental" | "sale";
  property_category: "hdb" | "private";
  address: string;
  bedrooms: number;
  bathrooms: number;
  size_sqft: number;
  furnishing: string;
  floor_level: string;
  tenure: string;
  // Rental fields
  price_per_month?: number;
  psf_per_month?: number;
  available_from?: string;
  min_lease_months?: number;
  pets_allowed?: boolean;
  // HDB-specific
  flat_type?: string;
  hdb_estate?: string;
  // Private rental
  property_name?: string;
  unit_type?: string;
  facilities?: string[];
  // Sale fields
  price?: number;
  price_per_sqft?: number;
  remaining_lease_years?: number;
  ethnic_quota_met?: boolean;
  hdb_grant_eligible?: boolean;
}

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export interface ChatResponse {
  reply: string;
  filters: FilterState | null;
  conversationId: string | null;
}

export interface PropertiesResponse {
  hits: PropertyDoc[];
  total: number;
}
