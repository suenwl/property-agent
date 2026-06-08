# ADK Agent — Property Search & Filter Extraction Skill

This skill is part of the combined instruction set for the Google ADK agent defined in
`app/src/lib/propertyAgent.ts`. It is no longer copy-pasted into Kibana Agent Builder.

---

## What this skill does

When the user describes properties they are looking for, the ADK agent (Gemini) uses the
Kibana MCP tools to search the `property` index and calls the `extract_property_filters`
**function tool** with structured filter values.

The web app captures the tool call arguments from the ADK event stream in `runAgent()`
and returns them as the `filters` field in the API response. The `search/page.tsx`
component merges these filters into the active filter state and re-runs the ES query.

This replaces the previous approach of embedding a ` ```json ` block in the agent's
text response and stripping it via `parseAgentResponse.ts`.

---

## Filter tool schema

The `extract_property_filters` function tool accepts:

| Field                 | Type              | Notes                                                |
|-----------------------|-------------------|------------------------------------------------------|
| `listing_type`        | string or null    | "rental" or "sale"                                   |
| `property_category`   | string or null    | "hdb" or "private"                                   |
| `bedrooms_min`        | number or null    |                                                      |
| `bedrooms_max`        | number or null    |                                                      |
| `price_per_month_min` | number or null    | SGD, rental                                          |
| `price_per_month_max` | number or null    | SGD, rental                                          |
| `price_min`           | number or null    | SGD, sale                                            |
| `price_max`           | number or null    | SGD, sale                                            |
| `town`                | string[] or null  | Singapore planning area names                        |
| `furnishing`          | string[] or null  | "Unfurnished" / "Partially Furnished" / "Fully Furnished" |
| `pets_allowed`        | boolean or null   | Rental                                               |
| `size_sqft_min`       | number or null    |                                                      |
| `flat_type`           | string or null    | HDB flat type                                        |
| `built_year_min`      | number or null    |                                                      |
| `built_year_max`      | number or null    |                                                      |

---

## Architecture

```
search/page.tsx
  └─ POST /api/chat  { message, conversationId }
       └─ runAgent(sessionId, message)   [propertyAgent.ts]
            ├─ ADK InMemoryRunner (Gemini 2.5 Flash)
            │    └─ tools: [MCPToolset → Kibana MCP, extract_property_filters FunctionTool]
            └─ returns { reply: string, filters: FilterState | null }
```

The `filters` object (or `null`) is returned directly from `runAgent()` — no text parsing needed.

---

## Kibana setup required

The ADK agent connects to the Kibana MCP server at `{KIBANA_URL}/api/agent_builder/mcp`.
The following built-in tools must be enabled on the `elastic-ai-agent` in Kibana Agent Builder:

- `platform.core.generate_esql`
- `platform.core.execute_esql`
- `platform.core.get_index_mapping`
- `platform.core.search`
- `platform.core.get_document`

The `ELASTIC_AGENT_API_KEY` must have the `feature_agentBuilder.read` Kibana privilege.
