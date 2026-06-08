import {
  Agent,
  FunctionTool,
  MCPToolset,
  InMemoryRunner,
  getFunctionCalls,
  isFinalResponse,
} from "@google/adk";
import { Type } from "@google/genai";
import type { FilterState } from "@/types";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const APP_NAME = "property-agent";
const USER_ID = "default";

// Uncomment to restrict tools; leave undefined to load all MCP tools (useful for debugging)
// const MCP_TOOL_FILTER = [
//   "platform.core.generate_esql",
//   "platform.core.execute_esql",
//   "platform.core.get_index_mapping",
//   "platform.core.search",
//   "platform.core.get_document",
// ];

// ---------------------------------------------------------------------------
// Combined agent instruction
// ---------------------------------------------------------------------------

const AGENT_INSTRUCTION = `
You are a Singapore property assistant. You operate in three modes depending on the
conversation context. All three modes share access to the same Elasticsearch index
called \`property\`.

---

## Mode 1 — Property Search & Filter Extraction

When the user describes properties they are looking for (e.g. "I want to rent a 3-bedroom
HDB in Tampines for under $3,000"), do the following:

1. Respond naturally with helpful information about what you found or what you will search for.
2. Call the \`extract_property_filters\` tool with the appropriate filter values derived from
   the user's request. Set a field to null if the user did not mention it. Do not infer
   values the user did not explicitly specify.
3. Do NOT include any JSON block in your text response — use the tool instead.

### Filter tool field reference

- \`listing_type\`: "rental" | "sale" | null
- \`property_category\`: "hdb" | "private" | null
- \`bedrooms_min\`: integer or null
- \`bedrooms_max\`: integer or null
- \`price_per_month_min\`: integer SGD or null  (rental)
- \`price_per_month_max\`: integer SGD or null  (rental)
- \`price_min\`: integer SGD or null  (sale)
- \`price_max\`: integer SGD or null  (sale)
- \`town\`: array of Singapore planning area names or null
- \`furnishing\`: array of "Unfurnished" | "Partially Furnished" | "Fully Furnished" or null
- \`pets_allowed\`: true | false | null  (rental)
- \`size_sqft_min\`: integer or null
- \`flat_type\`: "2-Room Flexi" | "3-Room" | "4-Room" | "5-Room" | "Executive" or null
- \`built_year_min\`: 4-digit year or null
- \`built_year_max\`: 4-digit year or null

Valid Singapore planning area names for \`town\`:
Ang Mo Kio, Bedok, Bishan, Bukit Batok, Bukit Merah, Bukit Panjang, Bukit Timah,
Clementi, Geylang, Hougang, Jurong East, Jurong West, Kallang, Marine Parade,
Newton, Novena, Orchard, Pasir Ris, Punggol, Queenstown, Rochor, Sembawang,
Sengkang, Serangoon, Tampines, Toa Payoh, Woodlands, Yishun.

If the user asks a non-search question (e.g. "what is PSF?"), do NOT call
\`extract_property_filters\`.

---

## Mode 2 — Market Analytics

When the user asks analytical or market research questions (e.g. "what is the typical
price of a 4-room HDB in Bishan?", "which estates are most affordable?", "how much does
furnishing add to rent?"), act as a Singapore property market analyst:

### Index name
\`property\`

### Available fields
| Field               | Type          | Description                                              |
|---------------------|---------------|----------------------------------------------------------|
| listing_type        | keyword       | "rental" or "sale"                                       |
| property_category   | keyword       | "hdb" or "private"                                       |
| town                | keyword       | Singapore planning area (e.g. "Bishan", "Tampines")      |
| flat_type           | keyword       | HDB flat type: "2-Room Flexi", "3-Room", "4-Room", "5-Room", "Executive" |
| bedrooms            | integer       | Number of bedrooms                                       |
| bathrooms           | integer       | Number of bathrooms                                      |
| size_sqft           | float         | Floor area in square feet                                |
| furnishing          | keyword       | "Unfurnished", "Partially Furnished", "Fully Furnished"  |
| floor_level         | keyword       | e.g. "Low", "Mid", "High"                                |
| tenure              | keyword       | e.g. "99-year leasehold", "Freehold"                     |
| price               | integer       | Sale price in SGD                                        |
| price_per_sqft      | float         | Sale price per sq ft in SGD                              |
| price_per_month     | integer       | Monthly rental in SGD                                    |
| psf_per_month       | float         | Rental price per sq ft per month in SGD                  |
| built_year          | integer       | Year the building was completed                          |
| remaining_lease_years | integer     | Years of lease remaining (HDB sale)                      |
| pets_allowed        | boolean       | Whether pets are allowed (rental)                        |
| hdb_grant_eligible  | boolean       | Whether CPF grant is applicable (HDB sale)               |
| hdb_estate          | keyword       | HDB estate name                                          |
| facilities          | keyword[]     | Amenities offered (private listings)                     |

### How to answer market questions

1. Identify whether the question is about typical/median prices, relative affordability,
   cost impact of an attribute, listing volume, or price trends.
2. Use the appropriate aggregation: \`avg\` or \`percentiles\` (p25/p50/p75) for price
   distributions; \`terms\` on \`town\` or \`flat_type\` with nested \`avg\` for comparisons;
   \`filters\` on \`furnishing\` for tier comparisons; \`range\` on \`built_year\` for trends.
3. Always filter on \`listing_type\` when the question clearly refers to one.
4. Lead with the direct answer, then provide supporting numbers. Use SGD formatting
   (e.g. $850,000 or $3,200/month). Round to the nearest hundred for readability.
   Mention sample size so the user can gauge reliability.
5. If fewer than 10 listings match, note that the sample is small.
6. Never expose raw ES query DSL. Translate all results into natural language.
7. Do NOT call \`extract_property_filters\` for analytics questions.

---

## Mode 3 — Property Valuation

When the conversation begins with a **[Property Context]** block, you are evaluating a
specific listing. Use all fields in the block as ground truth. Do not ask the user to
repeat them.

### What the [Property Context] block looks like
  [Property Context]
  Address: <address>
  Type: <listing_type> / <property_category> / <flat_type or unit_type>
  Price: <formatted price>
  Size: <size_sqft> sqft  |  PSF: <price_per_sqft or psf_per_month>
  Floor: <floor_level>  |  Furnishing: <furnishing>
  Built: <built_year>  |  Tenure: <tenure>
  Town: <town>

### Evaluation steps

1. **Comparable baseline** — Query for listings matching: same listing_type, property_category,
   town, flat_type (HDB) or bedrooms (private), size_sqft within ±25%.
   Compute percentiles (p25, p50, p75) on price_per_sqft (sale) or psf_per_month (rental).
   If fewer than 10 matches, widen to broader town or neighbouring towns and note the limitation.

2. **Comparison** — Calculate % premium or discount vs p50 comparable PSF.
   | Premium vs median | Verdict    |
   |-------------------|------------|
   | > +15%            | Overpriced |
   | −10% to +15%      | Fair value |
   | < −10%            | Good deal  |

3. **Value drivers** — Investigate via sub-aggregations:
   - Floor level: compare avg PSF for High/Mid/Low floor
   - Furnishing: compare avg PSF for each tier
   - Built year / remaining lease (HDB sale)
   - Tenure (private sale): Freehold vs leasehold PSF
   - Facilities (private): note premium facilities

4. **Fair price estimate** — Start from p50 comparable PSF, apply adjustments for floor,
   furnishing, and age. Derive adjusted fair PSF × size_sqft = fair price ± 5%.

5. **Verdict** — Lead with classification (Overpriced / Fair value / Good deal) and the
   % deviation. Give the fair price estimate. Briefly explain key factors. End with a
   one-sentence recommendation.

### Valuation rules
- **Never call \`extract_property_filters\` in valuation responses.**
- Never expose raw ES query DSL to the user.
- Always state what you are comparing against (e.g. "vs 42 comparable 4-Room HDB
  rentals in Bishan of similar size").
- If no [Property Context] block is present, treat the conversation as Mode 2
  (market analytics).
`.trim();

// ---------------------------------------------------------------------------
// extract_property_filters tool
// ---------------------------------------------------------------------------

const extractFiltersTool = new FunctionTool({
  name: "extract_property_filters",
  description:
    "Call this tool when the user is searching for properties and you have determined " +
    "search filter values from their request. Do not include any JSON in your text response " +
    "— use this tool to communicate the filters to the UI instead.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      listing_type: {
        type: Type.STRING,
        description: '"rental" or "sale"',
        nullable: true,
      },
      property_category: {
        type: Type.STRING,
        description: '"hdb" or "private"',
        nullable: true,
      },
      bedrooms_min: { type: Type.NUMBER, nullable: true },
      bedrooms_max: { type: Type.NUMBER, nullable: true },
      price_per_month_min: { type: Type.NUMBER, nullable: true },
      price_per_month_max: { type: Type.NUMBER, nullable: true },
      price_min: { type: Type.NUMBER, nullable: true },
      price_max: { type: Type.NUMBER, nullable: true },
      town: {
        type: Type.ARRAY,
        items: { type: Type.STRING },
        description: "Array of Singapore planning area names",
        nullable: true,
      },
      furnishing: {
        type: Type.ARRAY,
        items: { type: Type.STRING },
        description:
          'Array of "Unfurnished", "Partially Furnished", "Fully Furnished"',
        nullable: true,
      },
      pets_allowed: { type: Type.BOOLEAN, nullable: true },
      size_sqft_min: { type: Type.NUMBER, nullable: true },
      flat_type: {
        type: Type.STRING,
        description:
          '"2-Room Flexi" | "3-Room" | "4-Room" | "5-Room" | "Executive"',
        nullable: true,
      },
      built_year_min: { type: Type.NUMBER, nullable: true },
      built_year_max: { type: Type.NUMBER, nullable: true },
    },
  },
  execute: async () => {
    // The actual filter values are captured from the event stream in runAgent.
    // This function just needs to signal success to the agent.
    return { success: true };
  },
});

// ---------------------------------------------------------------------------
// Runner singleton
// ---------------------------------------------------------------------------

let _runner: InMemoryRunner | null = null;

function getRunner(): InMemoryRunner {
  if (_runner) return _runner;

  const kibanaUrl = process.env.KIBANA_URL;
  const elasticApiKey = process.env.ELASTIC_AGENT_API_KEY;

  if (!kibanaUrl || !elasticApiKey) {
    throw new Error("KIBANA_URL and ELASTIC_AGENT_API_KEY must be configured");
  }

  const mcpUrl = `${kibanaUrl.replace(/\/$/, "")}/api/agent_builder/mcp`;
  console.log("[ADK] Connecting to Kibana MCP at:", mcpUrl);

  const mcpToolset = new MCPToolset({
    type: "StreamableHTTPConnectionParams",
    url: mcpUrl,
    transportOptions: {
      requestInit: {
        headers: {
          Authorization: `ApiKey ${elasticApiKey}`,
        },
      },
    },
  });

  const agent = new Agent({
    name: "property_agent",
    model: "gemini-2.5-flash",
    instruction: AGENT_INSTRUCTION,
    tools: [mcpToolset, extractFiltersTool],
  });

  _runner = new InMemoryRunner({ agent, appName: APP_NAME });
  return _runner;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Ensures a session exists for the given sessionId. Creates it if it does not.
 * Call this once before the first runAgent() call for a new conversation.
 */
export async function ensureSession(sessionId: string): Promise<void> {
  const runner = getRunner();
  await runner.sessionService.getOrCreateSession({
    appName: APP_NAME,
    userId: USER_ID,
    sessionId,
  });
}

/**
 * Runs the agent with the given message in the specified session.
 * Returns the agent's text reply and any property filters extracted via tool call.
 */
export async function runAgent(
  sessionId: string,
  message: string
): Promise<{ reply: string; filters: FilterState | null }> {
  const runner = getRunner();

  const events = runner.runAsync({
    userId: USER_ID,
    sessionId,
    newMessage: {
      role: "user",
      parts: [{ text: message }],
    },
  });

  let reply = "";
  let filters: FilterState | null = null;

  for await (const event of events) {
    // Temporary debug: log every event to diagnose tool calls and responses
    console.log("[ADK:event]", JSON.stringify({
      author: event.author,
      errorCode: event.errorCode,
      isFinal: isFinalResponse(event),
      parts: event.content?.parts?.map((p) => {
        if (p.thought) return { type: "thought" };
        if (p.text) return { type: "text", text: p.text.slice(0, 200) };
        if (p.functionCall) return { type: "functionCall", name: p.functionCall.name, args: p.functionCall.args };
        if (p.functionResponse) return { type: "functionResponse", name: p.functionResponse.name, response: JSON.stringify(p.functionResponse.response).slice(0, 500) };
        return { type: "other" };
      }),
    }));

    // Surface ADK/Gemini errors immediately
    if (event.errorCode) {
      throw new Error(
        `Agent error [${event.errorCode}]: ${event.errorMessage ?? event.errorCode}`
      );
    }

    // Capture filter args from the extract_property_filters tool call event
    const calls = getFunctionCalls(event);
    for (const call of calls) {
      if (call.name === "extract_property_filters" && call.args) {
        filters = call.args as unknown as FilterState;
      }
    }

    // Only collect the reply from the agent — skip the user message event that
    // ADK emits at the start of each turn (author === "user"). Also guard against
    // Gemini 2.5 Flash thinking-only events where all parts have thought:true,
    // which would otherwise overwrite a valid reply with an empty string.
    if (
      event.author !== "user" &&
      isFinalResponse(event) &&
      event.content?.parts
    ) {
      const text = event.content.parts
        .filter((p) => !p.thought && p.text)
        .map((p) => p.text ?? "")
        .join("")
        .trim();
      if (text) {
        reply = text;
      }
    }
  }

  return { reply, filters };
}
