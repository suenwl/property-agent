# ADK Agent — Property Market Insights Skill

This skill is part of the combined instruction set for the Google ADK agent defined in
`app/src/lib/propertyAgent.ts`. It is no longer copy-pasted into Kibana Agent Builder.

---

## What this skill does

When the user asks analytical or market research questions about Singapore property
(e.g. "what is the typical price of a 4-room HDB in Bishan?", "which estates are most
affordable?", "does furnishing significantly affect rent?"), the ADK agent uses the
Kibana MCP tools to run Elasticsearch aggregations and returns clear, factual insights.

This skill complements the filter skill (AGENT_SKILL.md). The agent auto-detects which
mode to use based on the user's intent:
- Search request ("find me a flat…") → filter skill + `extract_property_filters` tool call
- Analytics question ("how much…", "which is cheapest…") → this skill, no tool call

---

## Aggregation patterns used

| Question type           | ES aggregation                                        |
|-------------------------|-------------------------------------------------------|
| Typical / median price  | `percentiles` (p25, p50, p75) on price or PSF field   |
| Cheapest estates        | `terms` on `town`, nested `avg` on price, sorted asc  |
| Furnishing premium      | `terms` on `furnishing`, nested `avg` on price        |
| Freehold vs leasehold   | `terms` on `tenure`, nested `avg` + `percentiles`     |
| Listing volume          | `terms` on `town` with `doc_count`                    |
| Price by build year     | `range` or `histogram` on `built_year`                |

---

## Index reference

Index: `property`

Key fields: `listing_type`, `property_category`, `town`, `flat_type`, `bedrooms`,
`size_sqft`, `furnishing`, `floor_level`, `tenure`, `price`, `price_per_sqft`,
`price_per_month`, `psf_per_month`, `built_year`, `remaining_lease_years`,
`pets_allowed`, `hdb_grant_eligible`, `hdb_estate`, `facilities`.

---

## Architecture

```
search/page.tsx  (or PropertyChat.tsx)
  └─ POST /api/chat  { message, conversationId }
       └─ runAgent(sessionId, message)   [propertyAgent.ts]
            ├─ ADK InMemoryRunner (Gemini 2.5 Flash)
            │    └─ tools: [MCPToolset → Kibana MCP tools]
            └─ returns { reply: string, filters: null }  (no filter extraction for analytics)
```
