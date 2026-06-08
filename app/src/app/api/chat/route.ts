import { NextResponse } from "next/server";
import { ensureSession, runAgent } from "@/lib/propertyAgent";

/*
 * Proxies search/analytics chat messages to the ADK agent (Gemini + Kibana MCP).
 *
 * Required environment variables:
 *   GOOGLE_API_KEY            – Google AI Studio key (dev) or set
 *                               GOOGLE_GENAI_USE_VERTEXAI=true + GOOGLE_CLOUD_PROJECT (prod)
 *   KIBANA_URL                – Your Kibana URL for the MCP endpoint
 *   ELASTIC_AGENT_API_KEY     – Kibana API key with feature_agentBuilder.read privilege
 *
 * Session history is managed in-process by ADK's InMemorySessionService.
 * The conversationId maps 1:1 to an ADK session ID.
 */

interface RequestBody {
  message: string;
  conversationId: string | null;
}

export async function POST(request: Request) {
  const { message, conversationId }: RequestBody = await request.json();

  // Reuse an existing session or create a new one
  const sessionId = conversationId ?? crypto.randomUUID();

  try {
    await ensureSession(sessionId);
    const { reply, filters } = await runAgent(sessionId, message);

    if (!reply) {
      return NextResponse.json(
        { error: "Empty response from agent" },
        { status: 502 }
      );
    }

    return NextResponse.json({ reply, filters, conversationId: sessionId });
  } catch (err) {
    console.error("Chat API error:", err);
    return NextResponse.json(
      { error: "Failed to reach agent" },
      { status: 500 }
    );
  }
}
