import type { FilterState } from "@/types";

const FILTER_KEYS: (keyof FilterState)[] = [
  "listing_type",
  "property_category",
  "bedrooms_min",
  "bedrooms_max",
  "price_per_month_min",
  "price_per_month_max",
  "price_min",
  "price_max",
  "town",
  "furnishing",
  "pets_allowed",
  "size_sqft_min",
  "flat_type",
  "built_year_min",
  "built_year_max",
];

/**
 * Extracts the last ```json ... ``` block from the agent reply and returns
 * {text, filters}. The JSON block is stripped from the displayed text.
 */
export function parseAgentResponse(raw: string): {
  text: string;
  filters: FilterState | null;
} {
  const jsonBlockRe = /```json\s*([\s\S]*?)```/g;
  let lastMatch: RegExpExecArray | null = null;
  let match: RegExpExecArray | null;

  while ((match = jsonBlockRe.exec(raw)) !== null) {
    lastMatch = match;
  }

  if (!lastMatch) {
    return { text: raw.trim(), filters: null };
  }

  const jsonStr = lastMatch[1].trim();
  const text = raw.slice(0, lastMatch.index).trim() +
    raw.slice(lastMatch.index + lastMatch[0].length).trim();

  try {
    const parsed = JSON.parse(jsonStr);
    const filters: FilterState = {
      listing_type: null,
      property_category: null,
      bedrooms_min: null,
      bedrooms_max: null,
      price_per_month_min: null,
      price_per_month_max: null,
      price_min: null,
      price_max: null,
      town: null,
      furnishing: null,
      pets_allowed: null,
      size_sqft_min: null,
      flat_type: null,
      built_year_min: null,
      built_year_max: null,
    };

    for (const key of FILTER_KEYS) {
      const val = parsed[key];
      if (val !== undefined && val !== null) {
        // Normalise array fields: agent may return a single string instead of an array
        if ((key === "furnishing" || key === "town") && typeof val === "string") {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (filters as any)[key] = [val];
        } else {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (filters as any)[key] = val;
        }
      }
    }

    return { text: text.trim(), filters };
  } catch {
    return { text: raw.trim(), filters: null };
  }
}
