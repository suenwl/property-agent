import { NextResponse } from "next/server";
import { parseAgentResponse } from "@/lib/parseAgentResponse";

/*
 * Proxies messages to the Elastic Agent Builder converse API:
 *   POST {KIBANA_URL}/api/agent_builder/converse
 *
 * Docs: https://www.elastic.co/docs/explore-analyze/ai-features/agent-builder/agent-builder-api-tutorial#step-11-chat-with-your-custom-agent
 *
 * Required environment variables:
 *   KIBANA_URL            – Your Kibana URL (e.g. https://<deployment>.kb.<region>.gcp.elastic.cloud)
 *   ELASTIC_AGENT_ID      – The agent ID created in Kibana Agent Builder
 *   ELASTIC_AGENT_API_KEY – A Kibana API key with agent builder permissions
 *
 * Conversation history is managed server-side by Elastic. We only pass the
 * conversation_id returned from the first response to maintain context.
 */

interface RequestBody {
  message: string;
  conversationId: string | null;
}

interface ElasticConverseResponse {
  conversation_id: string;
  round_id: string;
  status: string;
  response: {
    message: string;
  };
}

export async function POST(request: Request) {
  const { message, conversationId }: RequestBody = await request.json();

  const kibanaUrl = process.env.KIBANA_URL;
  const agentId = process.env.ELASTIC_AGENT_ID;
  const apiKey = process.env.ELASTIC_AGENT_API_KEY;

  if (!kibanaUrl || !agentId || !apiKey) {
    return NextResponse.json(
      { error: "KIBANA_URL, ELASTIC_AGENT_ID and ELASTIC_AGENT_API_KEY must be configured" },
      { status: 500 }
    );
  }

  const endpoint = `${kibanaUrl.replace(/\/$/, "")}/api/agent_builder/converse`;

  const body: Record<string, string> = {
    input: message,
    agent_id: agentId,
  };

  // Pass conversation_id on subsequent turns so the agent retains context
  if (conversationId) {
    body.conversation_id = conversationId;
  }

  try {
    const agentResponse = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        // Kibana requires both ApiKey auth and the XSRF header on mutating requests
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
    const rawContent = data?.response?.message ?? "";

    if (!rawContent) {
      return NextResponse.json(
        { error: "Empty response from agent" },
        { status: 502 }
      );
    }

    const { text, filters } = parseAgentResponse(rawContent);

    return NextResponse.json({
      reply: text,
      filters,
      conversationId: data.conversation_id,
    });
  } catch (err) {
    console.error("Chat API error:", err);
    return NextResponse.json(
      { error: "Failed to reach agent" },
      { status: 500 }
    );
  }
}
