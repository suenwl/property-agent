# ADK Agent — Property Valuation & Deal Assessment Skill

This skill is part of the combined instruction set for the Google ADK agent defined in
`app/src/lib/propertyAgent.ts`. It is no longer copy-pasted into Kibana Agent Builder.

---

## What this skill does

When the conversation begins with a `[Property Context]` block (automatically injected by
`/api/chat/valuation`), the ADK agent evaluates a specific listing against comparable
properties using Elasticsearch percentile aggregations and returns a structured verdict.

The valuation skill is activated automatically by the property context block — users
never need to type listing details manually.

---

## Valuation flow

1. **Comparable baseline** — Query `property` index for same type/category/town/size ±25%.
   Compute p25/p50/p75 on `price_per_sqft` (sale) or `psf_per_month` (rental).

2. **Comparison** — Calculate % premium/discount vs p50 comparable PSF.
   | Premium vs median | Verdict    |
   |-------------------|------------|
   | > +15%            | Overpriced |
   | −10% to +15%      | Fair value |
   | < −10%            | Good deal  |

3. **Value drivers** — Investigate floor level, furnishing, build year/lease, tenure,
   and facilities via sub-aggregations.

4. **Fair price estimate** — Adjusted p50 PSF × `size_sqft` → fair price ± 5%.

5. **Verdict** — Classification + % deviation + fair price range + one-sentence recommendation.

---

## Property context format

`/api/chat/valuation/route.ts` prepends this block to the first user message:

```
[Property Context]
Address: <address>
Type: <listing_type> / <property_category> / <flat_type or unit_type>
Price: <formatted price>
Size: <size_sqft> sqft  |  PSF: <price_per_sqft or psf_per_month>
Floor: <floor_level>  |  Furnishing: <furnishing>
Built: <built_year>  |  Tenure: <tenure>
Town: <town>

User question: <the user's first question>
```

The `buildPropertyContext()` function that generates this block lives in
`app/src/app/api/chat/valuation/route.ts`.

---

## Architecture

```
PropertyModal.tsx
  └─ PropertyChat.tsx
       └─ POST /api/chat/valuation  { message, conversationId, property }
            └─ buildPropertyContext(property)  [first turn only]
            └─ runAgent(sessionId, "[Property Context]\n...\nUser question: ...")
                 ├─ ADK InMemoryRunner (Gemini 2.5 Flash)
                 │    └─ tools: [MCPToolset → Kibana MCP tools]
                 └─ returns { reply: string, filters: null }  (never extracts filters in valuation mode)
```

The valuation agent **never** calls `extract_property_filters` because the system
instruction explicitly prohibits it in valuation mode.
