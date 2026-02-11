# StoryTeller Screenshot Analysis – Vertex AI Setup

Screenshot analysis uses **Google Cloud Vertex AI** with a service account. Follow these steps to configure it.

## 1. Enable Vertex AI API

1. Open [Google Cloud Console](https://console.cloud.google.com/)
2. Select your project (e.g. `gen-lang-client-0346028406`)
3. Go to **APIs & Services** → **Enable APIs and Services**
4. Search for **Vertex AI API**
5. Click **Enable**

Direct link (replace `YOUR_PROJECT_ID`):
```
https://console.cloud.google.com/apis/library/aiplatform.googleapis.com?project=YOUR_PROJECT_ID
```

## 2. Enable Billing

Vertex AI requires a billing account:

1. Go to **Billing** in the Google Cloud Console
2. Link a billing account to your project
3. Free tier includes a monthly quota for Gemini models

## 3. Create a Service Account

1. Go to **IAM & Admin** → **Service Accounts**
2. Click **Create Service Account**
3. Name it (e.g. `storyteller-vertex`)
4. Click **Create and Continue**
5. Under **Grant this service account access**, add role **Vertex AI User**
6. Click **Done**
7. Open the new service account → **Keys** → **Add Key** → **Create new key** → **JSON**
8. Download the JSON file

## 4. Base64 Encode the JSON

**PowerShell (Windows):**
```powershell
[Convert]::ToBase64String([IO.File]::ReadAllBytes("path\to\your-service-account.json"))
```

**macOS/Linux:**
```bash
base64 -i your-service-account.json | tr -d '\n'
```

## 5. Configure .env

Add or update these in your `.env`:

```env
GOOGLE_CLOUD_PROJECT_ID=your-gcp-project-id
GOOGLE_CLOUD_LOCATION=us-central1
GOOGLE_CLOUD_CREDENTIALS_BASE64=<paste_the_base64_string>
```

**Optional:**
- `GOOGLE_CLOUD_LOCATION=global` – Use global endpoint (can improve availability)
- `GEMINI_VERTEX_MODEL=gemini-2.5-flash` – Use a different model (default: `gemini-2.5-pro`)

## 6. Restart the Dev Server

```bash
npm run dev
```

## Troubleshooting

### "Publisher Model was not found" (404)

- Ensure Vertex AI API is enabled
- Ensure billing is enabled on the project
- Verify the service account has **Vertex AI User**
- Try `GOOGLE_CLOUD_LOCATION=global` in `.env`

### "Permission denied" (403)

- Confirm the service account has **Vertex AI User** (or **Vertex AI Admin**)
- Check that the correct project ID is set in `.env`
