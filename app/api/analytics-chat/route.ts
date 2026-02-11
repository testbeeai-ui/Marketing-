import { NextRequest, NextResponse } from 'next/server';
import { getUserIdFromRequest, createAuthenticatedClient } from '@/lib/auth-server';
import {
  useStorytellerLocalStore,
  listByUserLocal,
  listByUserSupabase,
} from '@/lib/storyteller/analyticsSnapshotStore';
import {
  useAnalyticsChatLocalStore,
  getOrCreateConversationLocal,
  getConversationByUserAndPlatformLocal,
  getConversationByUserAndPlatformSupabase,
  getPreferencesMapLocal,
  appendMessageLocal,
  listMessagesLocal,
  addPreferenceLocal,
  getPreferenceSummaryLocal,
  getOrCreateConversationSupabase,
  appendMessageSupabase,
  listMessagesSupabase,
  addPreferenceSupabase,
  getPreferenceSummarySupabase,
} from '@/lib/storyteller/analyticsChatStore';
import { buildDataSummaryForPrompt, buildPreferenceSummaryText } from '@/lib/storyteller/analyticsChatHelpers';
import { aiService } from '@/lib/services/aiService';

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
    'Analyze the content posted on Feb 2–3 to understand the impression spike and replicate that success. Focus on distribution—high engagement rate suggests content resonates, but reach is declining.',
  time_series_peaks: ['Feb 2: 195 impressions', 'Feb 3: 198 impressions'],
};

const TWITTER_SYSTEM_PROMPT = `You are a Twitter (X) analytics coach. STRICT RULES:
- Only answer questions about Twitter/X analytics. If asked about LinkedIn, Instagram, Facebook, or other platforms, politely say: "I'm your Twitter analytics assistant. Questions about other platforms will be supported in the future."
- Base answers ONLY on the provided analytics data. Do not invent metrics or numbers.
- Be actionable and specific to their data.
- Keep responses focused and helpful.
- FORMATTING: Use Markdown to structure your responses: use **bold** for key terms and metrics, > blockquotes for direct quotes from their content, numbered lists (1. 2. 3.) for steps, and bullet points for alternatives. For any formulas (e.g. engagement rate calculations), use LaTeX: inline math with $...$ and block math with $$...$$.`;

export async function GET(request: NextRequest) {
  try {
    const userId = await getUserIdFromRequest(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const platform = (searchParams.get('platform') || 'x').toLowerCase();
    const demo = searchParams.get('demo') === 'true';

    if (demo) {
      return NextResponse.json({ conversationId: null, messages: [] });
    }

    let conversationId: string | null = null;
    let messages: { id: string; role: string; content: string; feedback?: string | null }[] = [];

    if (useAnalyticsChatLocalStore()) {
      const conv = await getConversationByUserAndPlatformLocal(userId, platform);
      if (conv) {
        conversationId = conv.id;
        const rows = await listMessagesLocal(conv.id, 50);
        const prefMap = await getPreferencesMapLocal(userId, platform);
        messages = rows.map((m) => ({
          id: m.id,
          role: m.role,
          content: m.content,
          feedback: prefMap.get(m.id) ?? null,
        }));
      }
    } else {
      const supabase = await createAuthenticatedClient();
      const conv = await getConversationByUserAndPlatformSupabase(supabase, userId, platform);
      if (conv) {
        conversationId = conv.id;
        const rows = await listMessagesSupabase(supabase, conv.id, 50);
        const { data: prefs } = await supabase
          .from('analytics_chat_preferences')
          .select('message_id, feedback')
          .eq('user_id', userId)
          .ilike('platform', platform);
        const prefMap = new Map<string, 'liked' | 'disliked'>();
        for (const p of prefs ?? []) {
          prefMap.set(p.message_id, p.feedback as 'liked' | 'disliked');
        }
        messages = rows.map((m) => ({
          id: m.id,
          role: m.role,
          content: m.content,
          feedback: prefMap.get(m.id) ?? null,
        }));
      }
    }

    return NextResponse.json({ conversationId, messages });
  } catch (error) {
    console.error('[analytics-chat] GET error:', error);
    return NextResponse.json(
      { error: 'Failed to load chat history', details: error instanceof Error ? error.message : 'Unknown' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const userId = await getUserIdFromRequest(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const feedback = searchParams.get('feedback') as 'liked' | 'disliked' | null;
    const messageId = searchParams.get('messageId');

    if (feedback && (feedback === 'liked' || feedback === 'disliked') && messageId) {
      const platform = searchParams.get('platform') || 'x';
      if (useAnalyticsChatLocalStore()) {
        await addPreferenceLocal(userId, platform, messageId, feedback);
      } else {
        const supabase = await createAuthenticatedClient();
        await addPreferenceSupabase(supabase, userId, platform, messageId, feedback);
      }
      return NextResponse.json({ ok: true });
    }

    const body = (await request.json()) as { message?: string; conversationId?: string; platform?: string; demo?: boolean };
    const message = body.message?.trim();
    const conversationId = body.conversationId;
    const platform = (body.platform || 'x').toLowerCase();
    const demo = body.demo === true;

    if (!message) {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 });
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
          ? { platform, note: 'No analytics data. Upload X screenshots for personalized advice.' }
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
          ? { platform, note: 'No analytics data. Upload X screenshots for personalized advice.' }
          : buildDataSummaryForPrompt(snapshots);
    }

    let convId = conversationId;
    let supabase: Awaited<ReturnType<typeof createAuthenticatedClient>> | null = null;

    if (useAnalyticsChatLocalStore()) {
      const conv = await getOrCreateConversationLocal(userId, platform);
      convId = conv.id;
    } else {
      supabase = await createAuthenticatedClient();
      const conv = await getOrCreateConversationSupabase(supabase, userId, platform);
      convId = conv.id;
    }

    if (!convId) {
      return NextResponse.json({ error: 'Failed to get or create conversation' }, { status: 500 });
    }

    if (useAnalyticsChatLocalStore()) {
      await appendMessageLocal(convId, 'user', message);
    } else if (supabase) {
      await appendMessageSupabase(supabase, convId, 'user', message);
    }

    const recentMessages = useAnalyticsChatLocalStore()
      ? await listMessagesLocal(convId, 20)
      : supabase
        ? await listMessagesSupabase(supabase, convId, 20)
        : [];

    const preferenceSummary = useAnalyticsChatLocalStore()
      ? await getPreferenceSummaryLocal(userId, platform, 20)
      : supabase
        ? await getPreferenceSummarySupabase(supabase, userId, platform, 20)
        : { liked: [] as string[], disliked: [] as string[] };

    const prefText = buildPreferenceSummaryText(preferenceSummary.liked, preferenceSummary.disliked);

    const conversationHistory = recentMessages
      .map((m) => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`)
      .join('\n\n');

    const fullPrompt = `${TWITTER_SYSTEM_PROMPT}

User preferences (adapt your style accordingly): ${prefText}

Analytics data available:
${JSON.stringify(dataSummary, null, 2)}

${conversationHistory ? `Previous conversation:\n${conversationHistory}\n\n` : ''}User: ${message}

Assistant:`;

    let reply: string;
    try {
      reply = await aiService.generateContent(fullPrompt);
    } catch (err) {
      console.error('[analytics-chat] AI generation failed:', err);
      return NextResponse.json(
        {
          error: 'Failed to generate response',
          details: err instanceof Error ? err.message : 'Unknown error',
        },
        { status: 500 }
      );
    }

    const contextSnapshot = { dataSummary };
    let assistantMsgId: string;

    if (useAnalyticsChatLocalStore()) {
      const msg = await appendMessageLocal(convId, 'assistant', reply, contextSnapshot);
      assistantMsgId = msg.id;
    } else if (supabase) {
      const msg = await appendMessageSupabase(supabase, convId, 'assistant', reply, contextSnapshot);
      assistantMsgId = msg.id;
    } else {
      assistantMsgId = `temp-${Date.now()}`;
    }

    return NextResponse.json({
      reply,
      messageId: assistantMsgId,
      conversationId: convId,
    });
  } catch (error) {
    console.error('[analytics-chat] Error:', error);
    return NextResponse.json(
      {
        error: 'Failed to process chat',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
