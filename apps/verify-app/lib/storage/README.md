

<!-- AUTO-GENERATED START -->
# `lib/storage`

## GCS runbook (production)
- `GCS_PROJECT_ID`: your GCP project id
- `GCS_BUCKET`: bucket name for object storage

### Auth model
- Browser clients use session auth + org membership checks, then request signed URLs.
- Server-to-server calls can use `API_KEY`/stored API keys via `guardApiRequest`.

### Recommended IAM
- Prefer Workload Identity / service account attached to the runtime (no JSON keys).
- Grant the runtime identity permissions to sign URLs and read/write objects in the bucket.

## Entry points (detected)

- `gcs.ts`
<!-- AUTO-GENERATED END -->
