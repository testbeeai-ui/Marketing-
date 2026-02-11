import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth-server';

const CMO_EXTRACT_INSTRUCTION = `You are a CMO Data Analyst. Extract data from this analytics screenshot into this strict JSON structure:
{
  "platform": "linkedin" | "x" | "instagram",
  "metrics": {
    "impressions": number,
    "engagement_rate": number,
    "followers": number,
    "top_post_topic": string
  },
  "strategic_analysis": {
    "mood": "positive" | "negative" | "neutral",
    "anomaly_detected": string,
    "actionable_advice": string
  }
}
If data is missing/not visible, use null. Return ONLY valid JSON, no markdown or extra text.`;

const GAP_ANALYSIS_PROMPT = (yourJson: string, competitorJson: string) =>
  `You are a CMO Strategist. Compare these two analytics profiles and produce a gap analysis.

YOUR PROFILE:
${yourJson}

COMPETITOR PROFILE:
${competitorJson}

Output a concise gap analysis (2-4 sentences) in this format:
"They own the keyword '[X]'. You own '[Y]'. Recommendation: [actionable suggestion]."

If you cannot determine specific keywords, focus on metrics differences and actionable advice.`;

const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_FILE_SIZE = 10 * 1024 * 1024;
const VISION_MODELS = [
  'gemini-2.5-pro',
  'gemini-2.5-flash',
  'gemini-3-pro',
  'gemini-3-flash',
  'gemini-3-nano',
];

function extractJsonFromText(text: string): Record<string, unknown> | null {
  const trimmed = text.trim();
  const jsonMatch = trimmed.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    try {
      return JSON.parse(jsonMatch[0]) as Record<string, unknown>;
    } catch {
      return null;
    }
  }
  return null;
}

async function analyzeImage(
  base64: string,
  mimeType: string
): Promise<Record<string, unknown> | null> {
  if (!process.env.GOOGLE_API_KEY) return null;

  for (const modelName of VISION_MODELS) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${process.env.GOOGLE_API_KEY}`;
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [
            {
              role: 'user',
              parts: [
                { inline_data: { mime_type: mimeType, data: base64 } },
                { text: CMO_EXTRACT_INSTRUCTION },
              ],
            },
          ],
          generationConfig: {
            temperature: 0.3,
            maxOutputTokens: 1024,
            responseMimeType: 'application/json',
          },
        }),
      });

      if (!response.ok) continue;

      const data = (await response.json()) as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> };
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (text) {
        const parsed = extractJsonFromText(text);
        if (parsed) return parsed;
      }
    } catch {
      continue;
    }
  }
  return null;
}

async function getGapAnalysis(yourJson: string, competitorJson: string): Promise<string> {
  if (!process.env.GOOGLE_API_KEY) return 'API key not configured';

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${process.env.GOOGLE_API_KEY}`;
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [
        {
          role: 'user',
          parts: [{ text: GAP_ANALYSIS_PROMPT(yourJson, competitorJson) }],
        },
      ],
      generationConfig: {
        temperature: 0.5,
        maxOutputTokens: 512,
      },
    }),
  });

  if (!response.ok) return 'Failed to generate gap analysis';

  const data = (await response.json()) as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> };
  return data.candidates?.[0]?.content?.parts?.[0]?.text || 'No analysis available';
}

export async function POST(request: NextRequest) {
  try {
    const auth = await getAuthenticatedUser(request);
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const formData = await request.formData();
    const yourFile = formData.get('yourFile') as File | null;
    const competitorFile = formData.get('competitorFile') as File | null;

    if (!yourFile || !competitorFile) {
      return NextResponse.json(
        { error: 'Both yourFile and competitorFile are required' },
        { status: 400 }
      );
    }

    for (const file of [yourFile, competitorFile]) {
      if (file.size > MAX_FILE_SIZE) {
        return NextResponse.json({ error: 'File size exceeds 10MB limit' }, { status: 400 });
      }
      if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
        return NextResponse.json({ error: 'Unsupported file type. Use JPEG, PNG, or WebP.' }, { status: 400 });
      }
    }

    const yourBuffer = await yourFile.arrayBuffer();
    const competitorBuffer = await competitorFile.arrayBuffer();
    const yourBase64 = Buffer.from(yourBuffer).toString('base64');
    const competitorBase64 = Buffer.from(competitorBuffer).toString('base64');

    const [yourData, competitorData] = await Promise.all([
      analyzeImage(yourBase64, yourFile.type),
      analyzeImage(competitorBase64, competitorFile.type),
    ]);

    if (!yourData || !competitorData) {
      return NextResponse.json(
        { error: 'Failed to extract data from one or both screenshots' },
        { status: 422 }
      );
    }

    const gapAnalysis = await getGapAnalysis(
      JSON.stringify(yourData, null, 2),
      JSON.stringify(competitorData, null, 2)
    );

    return NextResponse.json({
      success: true,
      yourData,
      competitorData,
      gapAnalysis,
    });
  } catch (error) {
    console.error('[analyze-compare] Error:', error);
    return NextResponse.json(
      {
        error: 'Failed to compare profiles',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
