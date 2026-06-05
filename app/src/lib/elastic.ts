import { Client } from "@elastic/elasticsearch";

let client: Client | null = null;

export function getElasticClient(): Client {
  if (!client) {
    const url = process.env.ES_URL;
    const apiKey = process.env.ES_API_KEY;

    if (!url || !apiKey) {
      throw new Error("ES_URL and ES_API_KEY environment variables must be set");
    }

    client = new Client({
      node: url,
      auth: { apiKey },
    });
  }
  return client;
}

export const ES_INDEX = "property";
