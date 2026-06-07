import type { FilterState } from "@/types";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ESClause = Record<string, any>;

export function buildEsQuery(filters: Partial<FilterState>): ESClause {
  const must: ESClause[] = [];

  if (filters.listing_type) {
    must.push({ term: { listing_type: filters.listing_type } });
  }

  if (filters.property_category) {
    must.push({ term: { property_category: filters.property_category } });
  }

  if (filters.town && filters.town.length > 0) {
    // ES stores town as text with dynamic mapping; use keyword sub-field if available,
    // otherwise match any of the town values
    must.push({ terms: { "town.keyword": filters.town } });
  }

  if (filters.furnishing && filters.furnishing.length > 0) {
    must.push({ terms: { "furnishing.keyword": filters.furnishing } });
  }

  if (filters.pets_allowed !== null && filters.pets_allowed !== undefined) {
    must.push({ term: { pets_allowed: filters.pets_allowed } });
  }

  if (filters.flat_type) {
    must.push({ term: { "flat_type.keyword": filters.flat_type } });
  }

  // Bedroom range
  const bedroomRange: ESClause = {};
  if (filters.bedrooms_min != null) bedroomRange.gte = filters.bedrooms_min;
  if (filters.bedrooms_max != null) bedroomRange.lte = filters.bedrooms_max;
  if (Object.keys(bedroomRange).length > 0) {
    must.push({ range: { bedrooms: bedroomRange } });
  }

  // Size range
  if (filters.size_sqft_min != null) {
    must.push({ range: { size_sqft: { gte: filters.size_sqft_min } } });
  }

  // Rental price range
  const rentRange: ESClause = {};
  if (filters.price_per_month_min != null)
    rentRange.gte = filters.price_per_month_min;
  if (filters.price_per_month_max != null)
    rentRange.lte = filters.price_per_month_max;
  if (Object.keys(rentRange).length > 0) {
    must.push({ range: { price_per_month: rentRange } });
  }

  // Sale price range
  const saleRange: ESClause = {};
  if (filters.price_min != null) saleRange.gte = filters.price_min;
  if (filters.price_max != null) saleRange.lte = filters.price_max;
  if (Object.keys(saleRange).length > 0) {
    must.push({ range: { price: saleRange } });
  }

  // Completion year range
  const yearRange: ESClause = {};
  if (filters.built_year_min != null) yearRange.gte = filters.built_year_min;
  if (filters.built_year_max != null) yearRange.lte = filters.built_year_max;
  if (Object.keys(yearRange).length > 0) {
    must.push({ range: { built_year: yearRange } });
  }

  if (must.length === 0) {
    return { match_all: {} };
  }

  return { bool: { must } };
}
