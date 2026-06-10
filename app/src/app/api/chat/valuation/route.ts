import { NextResponse } from "next/server";
import type { PropertyDoc } from "@/types";
import { ensureSession, runAgent, runAgentWithCalendar } from "@/lib/propertyAgent";
import { auth } from "@/auth";

/*
 * Proxies property-valuation questions to the ADK agent (Gemini + Kibana MCP).
 *
 * Unlike /api/chat, this route:
 *   1. Accepts an optional `property` object in the request body.
 *   2. On the first turn (conversationId === null), prepends a [Property Context]
 *      block to the user message so the agent has full listing details.
 *   3. Never returns filter data — valuation replies are plain text.
 *
 * Required environment variables: same as /api/chat.
 */

interface RequestBody {
  message: string;
  conversationId: string | null;
  property: PropertyDoc | null;
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
    lines.push(
      `Bedrooms: ${property.bedrooms}  |  Bathrooms: ${property.bathrooms}`
    );
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
  const [{ message, conversationId, property }, session] = await Promise.all([
    request.json() as Promise<RequestBody>,
    auth(),
  ]);

  const googleAccessToken = session?.accessToken;
  const sessionId = conversationId ?? crypto.randomUUID();

  // On the first turn, prepend the property context so the agent has full
  // listing details without the user needing to type them.
  let input = message;
  if (!conversationId && property) {
    const context = buildPropertyContext(property);
    input = `${context}\n\nUser question: ${message}`;
  }

  try {
    await ensureSession(sessionId, googleAccessToken);
    const { reply } = googleAccessToken
      ? await runAgentWithCalendar(sessionId, input, googleAccessToken)
      : await runAgent(sessionId, input);

    if (!reply) {
      return NextResponse.json(
        { error: "Empty response from agent" },
        { status: 502 }
      );
    }

    return NextResponse.json({ reply, conversationId: sessionId });
  } catch (err) {
    console.error("Valuation API error:", err);
    return NextResponse.json(
      { error: "Failed to reach agent" },
      { status: 500 }
    );
  }
}
