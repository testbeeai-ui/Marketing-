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
  anomaly_detected:
    'Reach crashed (-19%) immediately after switching to single images.',
  actionable_advice:
    'Analyze the content posted on Feb 2–3 to understand the impression spike and replicate that success.',
  time_series_peaks: ['Feb 2: 195 impressions', 'Feb 3: 198 impressions'],
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

export async function POST(request: NextRequest) {
  try {
    const userId = await getUserIdFromRequest(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = (await request.json()) as {
      lastUserMessage?: string;
      lastAssistantMessage?: string;
      platform?: string;
      demo?: boolean;
    };

    const lastUserMessage = body.lastUserMessage?.trim() ?? '';
    const lastAssistantMessage = body.lastAssistantMessage?.trim() ?? '';
    const platform = (body.platform || 'x').toLowerCase();
    const demo = body.demo === true;

    if (!lastAssistantMessage) {
      return NextResponse.json(
        { error: 'lastAssistantMessage is required' },
        { status: 400 }
      );
    }

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
          ? { platform, note: 'No analytics data yet.' }
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
          ? { platform, note: 'No analytics data yet.' }
          : buildDataSummaryForPrompt(snapshots);
    }

    const prompt = `You are framing FOLLOW-UP questions for deeper analysis. The user just had this exchange:

User asked: "${lastUserMessage}"

Assistant replied (summary): "${lastAssistantMessage.slice(0, 600)}${lastAssistantMessage.length > 600 ? '...' : ''}"

The user wants MORE analysis or DEEPER insights on the same topic. Based on the assistant's reply and the current analytics data below, suggest 3-5 new, specific follow-up questions that would lead to deeper analysis. These should NOT repeat the original question. They should drill down: "Why did X happen?", "How can I measure Y?", "What's the best approach for Z given my metrics?" Be specific to the data.

Current analytics data:
${JSON.stringify(dataSummary, null, 2)}

Return ONLY valid JSON:
{ "questions": ["question 1", "question 2", "question 3"] }`;

    let questions: string[] = [];
    try {
      const response = await aiService.generateContent(prompt);
      questions = extractJsonQuestions(response);
    } catch (err) {
      console.warn('[analytics-chat/follow-up] AI failed:', err);
    }

    return NextResponse.json({ questions });
  } catch (error) {
    console.error('[analytics-chat/follow-up] Error:', error);
    return NextResponse.json(
      {
        error: 'Failed to generate follow-up questions',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
