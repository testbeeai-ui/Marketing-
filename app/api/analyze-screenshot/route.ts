import { NextRequest, NextResponse } from 'next/server';
import { VertexAI } from '@google-cloud/vertexai';
import { getAuthenticatedUser } from '@/lib/auth-server';
import {
  useStorytellerLocalStore,
  insertLocal,
  insertSupabase,
} from '@/lib/storyteller/analyticsSnapshotStore';
import { normalizeExtractedData } from '@/lib/storyteller/analyticsSchema';

const CMO_SYSTEM_INSTRUCTION = `You are a CMO Data Analyst. First determine: Is this screenshot an ANALYTICS DASHBOARD (charts, KPIs, multiple metrics) or a SINGLE POST (one tweet/post with engagement icons like likes, reposts, views)?

Output JSON based on type. Use snake_case for all metric keys. ONLY use values clearly visible; set missing fields to null.

**If ANALYTICS DASHBOARD**, use this structure. In "metrics" include ANY of the following that are visible (extract all that apply):

{
  "snapshot_type": "dashboard",
  "platform": "linkedin" | "x" | "instagram" | "facebook" | null,
  "metrics": {
    "impressions": number | null,
    "engagement_rate": number | null,
    "followers": number | null,
    "top_post_topic": string | null,
    "profile_visits": number | null,
    "engagements": number | null,
    "saves": number | null,
    "shares": number | null,
    "replies": number | null,
    "likes": number | null,
    "reposts": number | null,
    "bookmarks": number | null,
    "reach": number | null,
    "page_likes": number | null,
    "reactions": number | null,
    "comments": number | null,
    "post_clicks": number | null,
    "published_content": number | null,
    "facebook_followers": number | null,
    "follows": number | null,
    "content_interactions": number | null,
    "typically_followers": number | null,
    "typically_follows": number | null,
    "typically_interactions": number | null,
    "views": number | null,
    "viewers": number | null,
    "link_clicks": number | null,
    "reach_goal_current": number | null,
    "reach_goal_target": number | null,
    "returning_viewers": number | null,
    "engaged_followers": number | null,
    "messaging_contacts": number | null,
    "unfollows": number | null,
    "net_follows": number | null,
    "followers_lifetime": number | null,
    "estimated_audience_min": number | null,
    "estimated_audience_max": number | null,
    "daily_response_rate": number | null,
    "daily_response_time": number | null,
    "conversations_started": number | null,
    "total_messaging_contacts": number | null,
    "new_messaging_contacts": number | null,
    "returning_messaging_contacts": number | null,
    "messaging_conversations_started": number | null,
    "total_contacts": number | null,
    "new_contacts_organic": number | null,
    "new_contacts_paid": number | null,
    "returning_contacts_organic": number | null,
    "returning_contacts_paid": number | null,
    "views_3s": number | null,
    "views_1m": number | null,
    "watch_time_s": number | null,
    "views_organic": number | null,
    "views_ads": number | null,
    "approximate_earnings": number | null,
    "earnings_change_pct": number | null,
    "tasks_completed": number | null,
    "tasks_total": number | null,
    "instagram_posts_published": number | null,
    "instagram_views": number | null,
    "facebook_posts_progress": number | null,
    "first_ad_progress": number | null,
    "instagram_posts_progress": number | null,
    "views_followers_pct": number | null,
    "views_non_followers_pct": number | null,
    "posts_pct": number | null,
    "reels_pct": number | null,
    "total_interactions": number | null,
    "interactions_followers_pct": number | null,
    "interactions_non_followers_pct": number | null,
    "accounts_engaged": number | null,
    "posts_interactions_pct": number | null,
    "reels_interactions_pct": number | null,
    "profile_activity": number | null,
    "post_impressions": number | null,
    "post_impressions_change_7d": number | null,
    "followers_change_7d": number | null,
    "profile_viewers_90d": number | null,
    "search_appearances_week": number | null,
    "weekly_actions_done": number | null,
    "weekly_actions_goal": number | null,
    "posts_this_week": number | null,
    "comments_this_week": number | null
  },
  "time_series": [{ "period": string, "value": number }] | null,
  "period_start": "YYYY-MM-DD" | null,
  "period_end": "YYYY-MM-DD" | null,
  "format_performance": { "format": string | null, "insight": string | null } | null,
  "semantic_intent": [{ "label": string, "percent": number }] | null,
  "strategic_analysis": {
    "mood": "positive" | "negative" | "neutral" | null,
    "anomaly_detected": string | null,
    "actionable_advice": string | null,
    "resonance_label": string | null
  },
  "post": null,
  "sections": null,
  "recent_content": null,
  "top_content_by_views": null,
  "top_content_by_interactions": null
}

Optional: If the dashboard shows distinct sections (e.g. Benchmarking, Audience, Messaging), you may set "sections" to an object like { "benchmarking": { "published_content": 2, "facebook_followers": 0 }, "audience": { "follows": 0, "followers_lifetime": 0 }, "messaging": { "conversations_started": 0, "total_messaging_contacts": 0 }, "content_overview": { "views": 0, "views_organic": 0 }, "earnings": { "approximate_earnings": 0 }, "results": { "views": 0, "link_clicks": 0 } }. Use null for sections not visible.
Optional: If "Recent content" or "Top content" is visible, set "recent_content" or "top_content_by_views" or "top_content_by_interactions" to an array of items: [{ "content_preview": string, "post_date": string, "views": number, "likes": number, "shares": number }]. Use "shares" for referral/share icon value. Omit or null if not visible.

REFERRALS: Extract any metric labeled "referrals", "shares", "link clicks", "new contacts", "messaging conversations started", "search appearances" and map to: shares, link_clicks, new_messaging_contacts, messaging_conversations_started, search_appearances_week so they can be highlighted.

**If SINGLE POST** (one tweet/post with view count, likes, reposts, replies), use:
{
  "snapshot_type": "post",
  "platform": "x" | "linkedin" | "instagram" | "facebook" | null,
  "metrics": null,
  "time_series": null,
  "format_performance": null,
  "semantic_intent": null,
  "strategic_analysis": {
    "mood": "positive" | "negative" | "neutral" | null,
    "anomaly_detected": null,
    "actionable_advice": string | null,
    "resonance_label": null
  },
  "post": {
    "views": number | null,
    "likes": number | null,
    "reposts": number | null,
    "replies": number | null,
    "post_date": string | null,
    "content_preview": string | null,
    "format": string | null,
    "shares": number | null
  },
  "sections": null,
  "recent_content": null,
  "top_content_by_views": null,
  "top_content_by_interactions": null
}

For DASHBOARD: period_start/period_end = date range of the chart. Use YYYY-MM-DD.
For SINGLE POST: post_date = when the post was published. Use YYYY-MM-DD if inferrable, else "Jan 21". Extract views, likes, reposts, replies, shares from engagement row. Content_preview = first ~80 chars. Format = "image" | "video" | "text" | "carousel" if detectable.
Rules:
- ONLY use values clearly visible. Set missing fields to null.
- snapshot_type MUST be "dashboard" or "post" based on image content.
- Output ONLY valid JSON (no markdown, no backticks).`;

const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

const VERTEX_404_FIX = `Vertex AI returned "model not found". Fix it:
1. Enable Vertex AI API: https://console.cloud.google.com/apis/library/aiplatform.googleapis.com?project=YOUR_PROJECT
2. Enable billing: https://console.cloud.google.com/billing?project=YOUR_PROJECT
3. Grant your service account "Vertex AI User": IAM → find marketing@... → Add role "Vertex AI User"
4. Try location "global" in .env: GOOGLE_CLOUD_LOCATION=global`;


function extractJsonFromText(text: string): Record<string, unknown> | null {
  const trimmed = text.trim();
  // Strip markdown code blocks if present (```json ... ``` or ``` ... ```)
  let candidate = trimmed.replace(/^```(?:json)?\s*\n?/, '').replace(/\n?```\s*$/, '');
  const jsonMatch = candidate.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    try {
      return JSON.parse(jsonMatch[0]) as Record<string, unknown>;
    } catch {
      return null;
    }
  }
  return null;
}

function getVertexAIClient(): { vertex: VertexAI } | { error: string } {
  const projectId = process.env.GOOGLE_CLOUD_PROJECT_ID || process.env.GOOGLE_CLOUD_PROJECT;
  const location = process.env.GOOGLE_CLOUD_LOCATION || 'us-central1';
  const credentialsBase64 = process.env.GOOGLE_CLOUD_CREDENTIALS_BASE64?.trim();
  const credentialsPath = process.env.GOOGLE_APPLICATION_CREDENTIALS?.trim();

  if (!projectId) return { error: 'GOOGLE_CLOUD_PROJECT_ID is missing in .env' };

  let googleAuthOptions: { credentials?: { client_email: string; private_key: string } } | undefined;

  if (credentialsPath) {
    // Use JSON file path - Vertex AI will use GOOGLE_APPLICATION_CREDENTIALS automatically
    const vertex = new VertexAI({ project: projectId, location });
    return { vertex };
  }

  if (!credentialsBase64) {
    return { error: 'Set GOOGLE_APPLICATION_CREDENTIALS=./gcp-key.json (path to service account JSON) OR GOOGLE_CLOUD_CREDENTIALS_BASE64 (base64 of full JSON)' };
  }

  try {
    const credentialsJson = Buffer.from(credentialsBase64, 'base64').toString('utf-8');
    const parsed = JSON.parse(credentialsJson);
    const credentials = {
      client_email: parsed.client_email,
      private_key: parsed.private_key,
    };
    if (!credentials.client_email || !credentials.private_key) {
      return { error: 'Invalid credentials: client_email or private_key missing in JSON' };
    }

    const vertex = new VertexAI({
      project: projectId,
      location,
      googleAuthOptions: { credentials },
    });
    return { vertex };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { error: `Invalid base64. Use GOOGLE_APPLICATION_CREDENTIALS=./gcp-key.json instead (save your JSON file, add path to .env)` };
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await getAuthenticatedUser(request);
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { user, supabase } = auth;
    const userId = user.id;

    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const platform = (formData.get('platform') as string) || 'unknown';
    const organizationId = formData.get('organizationId') as string | null;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    if (!organizationId) {
      return NextResponse.json({ error: 'Organization ID is required' }, { status: 400 });
    }

    // Verify user is member of the organization
    const { data: membership } = await supabase
      .from('organization_members')
      .select('role')
      .eq('organization_id', organizationId)
      .eq('user_id', userId)
      .single();

    if (!membership) {
      return NextResponse.json({ error: 'Not a member of this organization' }, { status: 403 });
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ error: 'File size exceeds 10MB limit' }, { status: 400 });
    }

    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
      return NextResponse.json(
        { error: 'Unsupported file type. Use JPEG, PNG, or WebP.' },
        { status: 400 }
      );
    }

    const buffer = await file.arrayBuffer();
    const base64 = Buffer.from(buffer).toString('base64');
    const mimeType = file.type;
    const ext = file.name.split('.').pop() || 'png';
    const storagePath = `${userId}/${Date.now()}-screenshot.${ext}`;
    const useLocal = useStorytellerLocalStore();

    if (!useLocal) {
      const { error: uploadError } = await supabase.storage
        .from('analytics-screenshots')
        .upload(storagePath, buffer, {
          contentType: mimeType,
          upsert: false,
        });

      if (uploadError) {
        console.error('[analyze-screenshot] Storage upload failed:', uploadError);
        return NextResponse.json(
          { error: 'Failed to upload image to storage', details: uploadError.message },
          { status: 500 }
        );
      }
    }

    const vertexResult = getVertexAIClient();
    if ('error' in vertexResult) {
      return NextResponse.json(
        {
          error: 'Vertex AI not configured',
          details: vertexResult.error,
          fix: 'Add to .env: GOOGLE_CLOUD_PROJECT_ID=gen-lang-client-0346028406, GOOGLE_CLOUD_LOCATION=us-central1, GOOGLE_CLOUD_CREDENTIALS_BASE64=<base64 of service account JSON>',
        },
        { status: 500 }
      );
    }
    const { vertex } = vertexResult;

    const modelName =
      process.env.GEMINI_VERTEX_MODEL || 'gemini-2.5-pro';
    const location = process.env.GOOGLE_CLOUD_LOCATION || 'us-central1';
    const projectId = process.env.GOOGLE_CLOUD_PROJECT_ID || process.env.GOOGLE_CLOUD_PROJECT || '';

    let extractedData: Record<string, unknown> | null = null;
    let aiInsights: Record<string, unknown> | null = null;
    let rawAiText: string | undefined;

    try {
      const model = vertex.preview.getGenerativeModel({
        model: modelName,
        generationConfig: {
          temperature: 0.3,
          maxOutputTokens: 8192,
          responseMimeType: 'application/json',
        },
      });

      const result = await model.generateContent({
        contents: [
          {
            role: 'user',
            parts: [
              { inlineData: { mimeType, data: base64 } },
              { text: CMO_SYSTEM_INSTRUCTION },
            ],
          },
        ],
      });

      const candidate = result.response.candidates?.[0];
      const reason = candidate?.finishReason;
      const blocked =
        reason &&
        ['SAFETY', 'RECITATION', 'PROHIBITED_CONTENT', 'BLOCKLIST'].includes(String(reason));
      if (blocked) {
        console.error('[analyze-screenshot] Model blocked:', reason, candidate);
        rawAiText = undefined;
      } else {
        const text = candidate?.content?.parts?.[0]?.text;
        rawAiText = text;
        if (text) {
          const parsed = extractJsonFromText(text);
          if (parsed) {
            if (!parsed.snapshot_type) {
              parsed.snapshot_type = parsed.post ? 'post' : 'dashboard';
            }
            extractedData = parsed;
            const sa = parsed.strategic_analysis;
            aiInsights =
              sa && typeof sa === 'object'
                ? (sa as Record<string, unknown>)
                : { mood: 'neutral', anomaly_detected: null, actionable_advice: null };
          }
        }
      }
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      const is404 = errMsg.includes('404') || errMsg.includes('not found');
      const fix = VERTEX_404_FIX.replace(/YOUR_PROJECT/g, projectId);

      console.error('[analyze-screenshot] Vertex AI error:', err);

      if (is404) {
        return NextResponse.json(
          {
            error: 'Vertex AI model not available for your project',
            model: modelName,
            location,
            fix,
          },
          { status: 503 }
        );
      }

      return NextResponse.json(
        {
          error: 'Vertex AI request failed',
          details: errMsg,
        },
        { status: 503 }
      );
    }

    if (!extractedData) {
      const rawPreview = rawAiText ? `${rawAiText.slice(0, 500)}${rawAiText.length > 500 ? '...' : ''}` : '(empty)';
      console.error('[analyze-screenshot] AI returned unparseable JSON. Raw response:', rawPreview);
      return NextResponse.json(
        {
          error: 'AI returned invalid data. Ensure the screenshot shows analytics (numbers, charts, metrics).',
          hint: !rawAiText ? 'Model returned no text.' : 'Response was not valid JSON. Check server logs for raw output.',
        },
        { status: 422 }
      );
    }

    const detectedPlatform =
      (extractedData.platform as string) || platform;
    const normalizedPlatform = ['linkedin', 'x', 'instagram', 'facebook'].includes(detectedPlatform.toLowerCase())
      ? detectedPlatform.toLowerCase()
      : platform;

    const normalizedData = normalizeExtractedData(extractedData);

    let snapshot;
    if (useLocal) {
      snapshot = await insertLocal(
        userId,
        normalizedPlatform,
        buffer,
        mimeType,
        ext,
        normalizedData,
        aiInsights
      );
    } else {
      try {
        snapshot = await insertSupabase(
          supabase,
          userId,
          normalizedPlatform,
          storagePath,
          normalizedData,
          aiInsights,
          organizationId
        );
      } catch (insertError) {
        console.error('[analyze-screenshot] Insert failed:', insertError);
        return NextResponse.json(
          {
            error: 'Failed to save snapshot',
            details: insertError instanceof Error ? insertError.message : 'Unknown error',
          },
          { status: 500 }
        );
      }
    }

    return NextResponse.json({
      success: true,
      snapshot,
    });
  } catch (error) {
    console.error('[analyze-screenshot] Error:', error);
    return NextResponse.json(
      {
        error: 'Failed to analyze screenshot',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
