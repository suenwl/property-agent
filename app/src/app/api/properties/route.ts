import { NextResponse } from "next/server";
import { getElasticClient, ES_INDEX } from "@/lib/elastic";
import { buildEsQuery } from "@/lib/buildEsQuery";
import type { FilterState, PropertyDoc } from "@/types";

const MAX_RESULTS = 200;

export async function POST(request: Request) {
  const filters: Partial<FilterState> = await request.json();

  try {
    const client = getElasticClient();
    const query = buildEsQuery(filters);

    const result = await client.search({
      index: ES_INDEX,
      size: MAX_RESULTS,
      query,
      _source: true,
    });

    const hits: PropertyDoc[] = result.hits.hits.map((hit) => ({
      _id: hit._id ?? "",
      ...(hit._source as Omit<PropertyDoc, "_id">),
    }));

    const total =
      typeof result.hits.total === "number"
        ? result.hits.total
        : (result.hits.total?.value ?? 0);

    return NextResponse.json({ hits, total });
  } catch (err) {
    console.error("Properties API error:", err);
    return NextResponse.json(
      { error: "Failed to fetch properties" },
      { status: 500 }
    );
  }
}
