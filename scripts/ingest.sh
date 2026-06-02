#!/usr/bin/env bash
set -euo pipefail

# Load variables from .env (located one level up from this script)
set -o allexport
source "$(dirname "$0")/../.env"
set +o allexport

curl -X PUT "https://my-elasticsearch-project-ed75ef.es.asia-southeast1.gcp.elastic.cloud:443/property" \
  -H "Content-Type: application/json" \
  -H "Authorization: ApiKey ${ES_INGEST_API_KEY}" \
  -d '{
    "mappings": {
      "properties": {
        "location": { "type": "geo_point" }
      }
    }
  }'


python3 -c "
import json, sys
index = 'property'
with open('singapore_property_listings.json') as f:
    docs = json.load(f)
for doc in docs:
    sys.stdout.write(json.dumps({'index': {'_index': index, '_id': doc['listing_id']}}) + '\n')
    sys.stdout.write(json.dumps(doc) + '\n')
" | curl -X POST "https://my-elasticsearch-project-ed75ef.es.asia-southeast1.gcp.elastic.cloud:443/_bulk" \
    -H "Content-Type: application/x-ndjson" \
    -H "Authorization: ApiKey ${ES_INGEST_API_KEY}" \
    --data-binary @-
