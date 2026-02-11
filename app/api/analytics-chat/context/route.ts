import { NextRequest, NextResponse } from 'next/server';
import { getUserIdFromRequest, createAuthenticatedClient } from '@/lib/auth-server';
import {
  useStorytellerLocalStore,
  listByUserLocal,
  listByUserSupabase,
} from '@/lib/storyteller/analyticsSnapshotStore';
import { aiService } from '@/lib/services/aiService';
import { buildDataSummaryForPrompt } from '@/lib/storyteller/analyticsChatHelpers';

const DEMO_DATA_SUMMARY = {
  platform: 'x',
  period: 'Jan 28 – Feb 10',
  metrics: {
    impressions: 798,
    engagement_rate: 19.2,
    engagements: 154,
    profile_visits: 3,
    followers: 2300,
  },
  anomaly_detected: 'Reach crashed (-19%) immediately after switching to single images.',
  actionable_advice:
    'Analyze the content posted on Feb 2–3 to understand the impression spike and replicate that success. Focus on distribution—high engagement rate suggests content resonates, but reach is declining.',
  time_series_peaks: ['Feb 2: 195 impressions', 'Feb 3: 198 impressions'],
  funnel_bottleneck: 'Profile visits (0.4% of impressions) are the weak link.',
};

function extractJsonQuestions(text: string): string[] {
  const trimmed = text.trim();
  const jsonMatch = trimmed.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    try {
      const parsed = JSON.parse(jsonMatch[0]) as { questions?: string[] };
      if (Array.isArray(parsed.questions)) {
        return parsed.questions.slice(0, 5).filter((q) => typeof q === 'string');
      }
    } catch {
      // fallback
    }
  }
  return [];
}

export async function GET(request: NextRequest) {
  try {
    const userId = await getUserIdFromRequest(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const platform = searchParams.get('platform') || 'x';
    const demo = searchParams.get('demo') === 'true';

    let dataSummary: object;

    if (demo) {
      dataSummary = DEMO_DATA_SUMMARY;
    } else if (useStorytellerLocalStore()) {
      const [dashRes, postRes] = await Promise.all([
        listByUserLocal(userId, 3, platform, 'dashboard'),
        listByUserLocal(userId, 5, platform, 'post'),
      ]);
      const snapshots = [...dashRes, ...postRes];
      dataSummary =
        snapshots.length === 0
          ? { platform, note: 'No analytics data uploaded yet. Upload X screenshots to get personalized suggested questions.' }
          : buildDataSummaryForPrompt(snapshots);
    } else {
      const supabase = await createAuthenticatedClient();
      const [dashRes, postRes] = await Promise.all([
        listByUserSupabase(supabase, userId, 3, platform, 'dashboard'),
        listByUserSupabase(supabase, userId, 5, platform, 'post'),
      ]);
      const snapshots = [...dashRes, ...postRes];
      dataSummary =
        snapshots.length === 0
          ? { platform, note: 'No analytics data uploaded yet. Upload X screenshots to get personalized suggested questions.' }
          : buildDataSummaryForPrompt(snapshots);
    }

    const prompt = `You are framing questions for a Twitter (X) analytics user. Based on the following analytics data, suggest 3-5 natural questions the user might want answered. Be specific to the data (e.g., "Why did impressions spike on Feb 2?", "How can I improve profile visits?"). If there is little or no data, suggest generic Twitter growth questions.

Data:
${JSON.stringify(dataSummary, null, 2)}

Return ONLY valid JSON in this exact format:
{ "questions": ["question 1", "question 2", "question 3"] }`;

    let suggestedQuestions: string[] = [];
    try {
      const response = await aiService.generateContent(prompt);
      suggestedQuestions = extractJsonQuestions(response);
    } catch (err) {
      console.warn('[analytics-chat/context] AI failed:', err);
    }

    return NextResponse.json({
      suggestedQuestions,
      dataSummary,
    });
  } catch (error) {
    console.error('[analytics-chat/context] Error:', error);
    return NextResponse.json(
      {
        error: 'Failed to fetch chat context',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
