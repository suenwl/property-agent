import { NextResponse } from "next/server";
import type { PropertyDoc } from "@/types";

/*
 * Proxies property-valuation questions to the Elastic Agent Builder converse API.
 * Unlike /api/chat, this route:
 *   1. Accepts an optional `property` object in the request body.
 *   2. On the first turn (conversationId === null), prepends a [Property Context]
 *      block to the user message so the agent has full listing details without the
 *      user having to type them.
 *   3. Never parses filter JSON from the response — valuation replies are plain text.
 *
 * Uses the same KIBANA_URL / ELASTIC_AGENT_ID / ELASTIC_AGENT_API_KEY env vars as
 * the main chat route. The valuation skill is added to the same agent's system prompt
 * via PROPERTY_VALUATION.md.
 */

interface RequestBody {
  message: string;
  conversationId: string | null;
  property: PropertyDoc | null;
}

interface ElasticConverseResponse {
  conversation_id: string;
  round_id: string;
  status: string;
  response: {
    message: string;
  };
}

function buildPropertyContext(property: PropertyDoc): string {
  const isRental = property.listing_type === "rental";

  const priceStr = isRental
    ? property.price_per_month
      ? `$${property.price_per_month.toLocaleString()}/month`
      : "N/A"
    : property.price
    ? `$${property.price.toLocaleString()}`
    : "N/A";

  const psfStr = isRental
    ? property.psf_per_month
      ? `$${property.psf_per_month.toFixed(2)}/sqft/month`
      : "N/A"
    : property.price_per_sqft
    ? `$${property.price_per_sqft.toLocaleString()}/sqft`
    : "N/A";

  const typeStr = [
    property.listing_type,
    property.property_category,
    property.flat_type ?? property.unit_type,
  ]
    .filter(Boolean)
    .join(" / ");

  const lines: string[] = [
    "[Property Context]",
    `Address: ${property.address}`,
    `Type: ${typeStr}`,
    `Price: ${priceStr}`,
    `Size: ${property.size_sqft.toLocaleString()} sqft  |  PSF: ${psfStr}`,
    `Floor: ${property.floor_level}  |  Furnishing: ${property.furnishing}`,
    `Built: ${property.built_year}  |  Tenure: ${property.tenure}`,
    `Town: ${property.town}`,
  ];

  if (property.bedrooms) {
    lines.push(`Bedrooms: ${property.bedrooms}  |  Bathrooms: ${property.bathrooms}`);
  }
  if (property.hdb_estate) {
    lines.push(`HDB Estate: ${property.hdb_estate}`);
  }
  if (!isRental && property.remaining_lease_years) {
    lines.push(`Remaining Lease: ${property.remaining_lease_years} years`);
  }
  if (property.facilities && property.facilities.length > 0) {
    lines.push(`Facilities: ${property.facilities.join(", ")}`);
  }

  return lines.join("\n");
}

export async function POST(request: Request) {
  const { message, conversationId, property }: RequestBody =
    await request.json();

  const kibanaUrl = process.env.KIBANA_URL;
  const agentId = process.env.ELASTIC_AGENT_ID;
  const apiKey = process.env.ELASTIC_AGENT_API_KEY;

  if (!kibanaUrl || !agentId || !apiKey) {
    return NextResponse.json(
      {
        error:
          "KIBANA_URL, ELASTIC_AGENT_ID and ELASTIC_AGENT_API_KEY must be configured",
      },
      { status: 500 }
    );
  }

  const endpoint = `${kibanaUrl.replace(/\/$/, "")}/api/agent_builder/converse`;

  // On the first turn, prepend the property context block so the agent has
  // full listing details without the user needing to type them.
  let input = message;
  if (!conversationId && property) {
    const context = buildPropertyContext(property);
    input = `${context}\n\nUser question: ${message}`;
  }

  const body: Record<string, string> = {
    input,
    agent_id: agentId,
  };

  if (conversationId) {
    body.conversation_id = conversationId;
  }

  try {
    const agentResponse = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `ApiKey ${apiKey}`,
        "kbn-xsrf": "true",
      },
      body: JSON.stringify(body),
    });

    if (!agentResponse.ok) {
      const errorText = await agentResponse.text();
      console.error("Elastic agent error:", agentResponse.status, errorText);
      return NextResponse.json(
        { error: `Agent returned ${agentResponse.status}: ${errorText}` },
        { status: 502 }
      );
    }

    const data: ElasticConverseResponse = await agentResponse.json();
    const reply = data?.response?.message ?? "";

    if (!reply) {
      return NextResponse.json(
        { error: "Empty response from agent" },
        { status: 502 }
      );
    }

    return NextResponse.json({
      reply,
      conversationId: data.conversation_id,
    });
  } catch (err) {
    console.error("Valuation API error:", err);
    return NextResponse.json(
      { error: "Failed to reach agent" },
      { status: 500 }
    );
  }
}
