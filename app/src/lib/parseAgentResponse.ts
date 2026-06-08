// Filter extraction is now handled via the ADK agent's extract_property_filters
// function tool. This file is kept as a stub for backwards compatibility.
// The actual filters are returned directly by runAgent() in propertyAgent.ts.

export function parseAgentResponse(raw: string): {
  text: string;
  filters: null;
} {
  return { text: raw.trim(), filters: null };
}
