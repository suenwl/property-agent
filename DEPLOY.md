# Deploying to Google Cloud Run

## Prerequisites

- [gcloud CLI](https://cloud.google.com/sdk/docs/install) installed and authenticated
- Docker installed and running
- Project: `property-agent-498004`, Region: `asia-southeast1`

---

## One-time setup

### 1. Set your project and region

```bash
gcloud config set project property-agent-498004
gcloud config set run/region asia-southeast1
```

### 2. Enable required APIs

```bash
gcloud services enable \
  run.googleapis.com \
  artifactregistry.googleapis.com \
  secretmanager.googleapis.com
```

### 3. Create an Artifact Registry repository

```bash
gcloud artifacts repositories create property-agent \
  --repository-format=docker \
  --location=asia-southeast1
```

### 4. Store secrets in Secret Manager

Instead of shipping a `.env` file in the container, store sensitive values as secrets:

```bash
# Elasticsearch
echo -n "<your-es-url>" \
  | gcloud secrets create ES_URL --data-file=-

echo -n "<your-es-api-key>" \
  | gcloud secrets create ES_API_KEY --data-file=-

# Kibana / Elastic Agent
echo -n "<your-kibana-url>" \
  | gcloud secrets create KIBANA_URL --data-file=-

echo -n "<your-elastic-agent-api-key>" \
  | gcloud secrets create ELASTIC_AGENT_API_KEY --data-file=-

# App auth
echo -n "<username>"   | gcloud secrets create AUTH_USERNAME --data-file=-
echo -n "<password>"   | gcloud secrets create AUTH_PASSWORD --data-file=-
echo -n "$(openssl rand -base64 32)" | gcloud secrets create AUTH_SECRET --data-file=-
```

### 5. Create a dedicated service account for Cloud Run

```bash
gcloud iam service-accounts create property-agent-run \
  --display-name="Property Agent Cloud Run"
```

Grant it the necessary roles:

```bash
SA="property-agent-run@property-agent-498004.iam.gserviceaccount.com"

# Vertex AI (for ADK / Gemini)
gcloud projects add-iam-policy-binding property-agent-498004 \
  --member="serviceAccount:$SA" --role="roles/aiplatform.user"

# Secret Manager (to read secrets at runtime)
gcloud projects add-iam-policy-binding property-agent-498004 \
  --member="serviceAccount:$SA" --role="roles/secretmanager.secretAccessor"
```

---

## Build & deploy

### 6. Build and push the Docker image

```bash
cd app   # run from the app/ directory

IMAGE="asia-southeast1-docker.pkg.dev/property-agent-498004/property-agent/app"

gcloud auth configure-docker asia-southeast1-docker.pkg.dev

docker build --platform linux/amd64 -t "$IMAGE:latest" .
docker push "$IMAGE:latest"
```

### 7. Deploy to Cloud Run

```bash
gcloud run deploy property-agent \
  --image="$IMAGE:latest" \
  --region=asia-southeast1 \
  --service-account="property-agent-run@property-agent-498004.iam.gserviceaccount.com" \
  --set-secrets="\
ES_URL=ES_URL:latest,\
ES_API_KEY=ES_API_KEY:latest,\
KIBANA_URL=KIBANA_URL:latest,\
ELASTIC_AGENT_API_KEY=ELASTIC_AGENT_API_KEY:latest,\
AUTH_USERNAME=AUTH_USERNAME:latest,\
AUTH_PASSWORD=AUTH_PASSWORD:latest,\
AUTH_SECRET=AUTH_SECRET:latest" \
  --set-env-vars="\
GOOGLE_GENAI_USE_VERTEXAI=true,\
GOOGLE_CLOUD_PROJECT=property-agent-498004,\
GOOGLE_CLOUD_LOCATION=asia-southeast1" \
  --allow-unauthenticated \
  --memory=1Gi \
  --cpu=1 \
  --min-instances=0 \
  --max-instances=5 \
  --port=3000
```

> **Note on credentials:** `GOOGLE_APPLICATION_CREDENTIALS` is NOT set here.
> Cloud Run automatically uses the attached service account (`property-agent-run`)
> for all Google API calls via Workload Identity — no key file needed.

After the deploy command completes, gcloud prints the public service URL.

---

## Subsequent deploys (after code changes)

```bash
cd app
docker build --platform linux/amd64 -t "$IMAGE:latest" .
docker push "$IMAGE:latest"
gcloud run deploy property-agent \
  --image="$IMAGE:latest" \
  --region=asia-southeast1
```

Or use Cloud Build for CI:

```bash
gcloud builds submit --tag "$IMAGE:latest" .
```

---

## Useful commands

| Task | Command |
|------|---------|
| View logs | `gcloud run services logs read property-agent --region=asia-southeast1` |
| Stream live logs | `gcloud beta run services logs tail property-agent --region=asia-southeast1` |
| Update a secret | `echo -n "new-value" \| gcloud secrets versions add SECRET_NAME --data-file=-` |
| List deployments | `gcloud run services list` |
| Open in browser | `gcloud run services describe property-agent --region=asia-southeast1 --format="value(status.url)"` |
