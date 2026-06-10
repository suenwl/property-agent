# Property Agent

An AI-powered Singapore property search assistant that combines conversational chat with real-time Elasticsearch queries. Users describe what they are looking for in natural language; the agent (Gemini 2.5 Flash via Google ADK) extracts structured filters, searches an Elasticsearch index of ~700 Singapore listings, and surfaces matching properties in an interactive UI.

Built for the **[Google Cloud Rapid Agent Hackathon](https://rapid-agent.devpost.com/)** — *Building Agents for Real-World Challenges* — using the **Elastic partner track**. The agent integrates the Kibana MCP server to execute ES|QL queries and aggregations directly, giving it real-time access to property market data.

---

## Tech stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 15 (App Router), Tailwind CSS, shadcn/ui |
| AI Agent | Google ADK (Python), Gemini 2.5 Flash via Vertex AI |
| Search & Analytics | Elasticsearch + Kibana MCP server (Elastic partner) |
| Auth | NextAuth.js (Google OAuth + username/password) |
| Deployment | Google Cloud Run |

---

## Prerequisites

- Node.js ≥ 18 and npm
- Python 3.10+
- A Google Cloud project with **Vertex AI** enabled
- An **Elastic Cloud** deployment (Elasticsearch + Kibana)
- Google OAuth credentials (Client ID + Secret) _or_ set `AUTH_USERNAME` / `AUTH_PASSWORD` for basic auth

---

## Setup

### 1. Clone the repo

```bash
git clone <repo-url>
cd property-agent
```

### 2. Install Python dependencies

```bash
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt
```

### 3. Generate synthetic property listings

```bash
.venv/bin/python scripts/generate_listings.py --count 700
```

This writes `scripts/singapore_property_listings.json`.

### 4. Ingest listings into Elasticsearch

Copy `.env.example` to `.env` and fill in your Elasticsearch credentials, then run:

```bash
bash scripts/ingest.sh
```

This creates the `property` index with a `geo_point` mapping and bulk-loads all listings.

### 5. Configure the Next.js app

```bash
cp app/.env.local.example app/.env.local   # or create from scratch
```

Edit `app/.env.local` and set the following variables:

```env
# Elasticsearch (direct queries)
ES_URL=https://<your-es-host>:443
ES_API_KEY=<your-es-api-key>

# Kibana MCP server (used by the ADK agent)
KIBANA_URL=https://<your-kibana-host>
ELASTIC_AGENT_API_KEY=<kibana-api-key-with-agentBuilder.read>

# Google AI via Vertex AI
GOOGLE_GENAI_USE_VERTEXAI=true
GOOGLE_CLOUD_PROJECT=<your-gcp-project-id>
GOOGLE_CLOUD_LOCATION=asia-southeast1
# Option A — service account key file:
GOOGLE_APPLICATION_CREDENTIALS=/path/to/key.json
# Option B — run `gcloud auth application-default login` instead

# Google OAuth (NextAuth)
GOOGLE_CLIENT_ID=<your-oauth-client-id>
GOOGLE_CLIENT_SECRET=<your-oauth-client-secret>
NEXTAUTH_SECRET=<random-32-char-string>
NEXTAUTH_URL=http://localhost:3000

# Basic auth (production fallback)
AUTH_USERNAME=admin
AUTH_PASSWORD=changeme
AUTH_SECRET=<random-32-char-string>
```

### 6. Enable Kibana Agent Builder tools

In Kibana Agent Builder, open the `elastic-ai-agent` and enable the following built-in MCP tools:

- `platform.core.generate_esql`
- `platform.core.execute_esql`
- `platform.core.get_index_mapping`
- `platform.core.search`
- `platform.core.get_document`

### 7. Install frontend dependencies

```bash
cd app
npm install
```

---

## Running locally

```bash
cd app
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

Log in and navigate to **Search** to start chatting with the property agent.

---

## Deployment

See [DEPLOY.md](./DEPLOY.md) for full instructions to deploy to **Google Cloud Run** using Docker and Secret Manager.

---

## Project structure

```
property-agent/
├── app/                        # Next.js frontend + API routes
│   ├── src/app/api/chat/       # Agent API endpoint
│   ├── src/components/         # UI components (PropertyList, ChatPanel, …)
│   └── src/lib/propertyAgent.ts# Google ADK agent definition
├── scripts/
│   ├── generate_listings.py    # Synthetic data generator
│   └── ingest.sh               # Elasticsearch bulk ingest script
├── AGENT_SKILL.md              # Agent filter-extraction skill spec
├── PROPERTY_SEARCH.md          # Agent market-analytics skill spec
├── DEPLOY.md                   # Cloud Run deployment guide
└── readme.md
```

---

## About

This project was submitted to the **[Google Cloud Rapid Agent Hackathon](https://rapid-agent.devpost.com/)** (deadline Jun 11, 2026) under the **Elastic partner track**. The hackathon challenges builders to create agents — powered by Gemini and Google Cloud Agent Builder — that move beyond simple chat to accomplish real-world tasks using partner MCP servers.

---

## License

MIT License

Copyright (c) 2026

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
