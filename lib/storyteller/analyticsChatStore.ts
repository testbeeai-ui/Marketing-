import type { SupabaseClient } from '@supabase/supabase-js';
import { promises as fs } from 'fs';
import path from 'path';

export interface ConversationRow {
  id: string;
  user_id: string;
  platform: string;
  created_at: string;
  updated_at: string;
}

export interface MessageRow {
  id: string;
  conversation_id: string;
  role: 'user' | 'assistant';
  content: string;
  context_snapshot: Record<string, unknown> | null;
  created_at: string;
}

export interface PreferenceRow {
  id: string;
  user_id: string;
  platform: string;
  message_id: string;
  feedback: 'liked' | 'disliked';
  created_at: string;
}

const DATA_DIR = path.join(process.cwd(), '.data', 'storyteller');
const CHAT_FILE = path.join(DATA_DIR, 'analytics_chat.json');

interface ChatFileSchema {
  conversations: ConversationRow[];
  messages: MessageRow[];
  preferences: PreferenceRow[];
}

function useLocalStore(): boolean {
  return process.env.STORYTELLER_USE_LOCAL_STORE === 'true';
}

async function ensureDataDir(): Promise<void> {
  await fs.mkdir(DATA_DIR, { recursive: true });
}

async function readChatFile(): Promise<ChatFileSchema> {
  try {
    const raw = await fs.readFile(CHAT_FILE, 'utf-8');
    const data = JSON.parse(raw) as ChatFileSchema;
    return {
      conversations: Array.isArray(data.conversations) ? data.conversations : [],
      messages: Array.isArray(data.messages) ? data.messages : [],
      preferences: Array.isArray(data.preferences) ? data.preferences : [],
    };
  } catch {
    return { conversations: [], messages: [], preferences: [] };
  }
}

async function writeChatFile(data: ChatFileSchema): Promise<void> {
  await ensureDataDir();
  await fs.writeFile(CHAT_FILE, JSON.stringify(data, null, 0), 'utf-8');
}

export async function getOrCreateConversationLocal(
  userId: string,
  platform: string
): Promise<ConversationRow> {
  const data = await readChatFile();
  const existing = data.conversations.find(
    (c) => c.user_id === userId && c.platform.toLowerCase() === platform.toLowerCase()
  );
  if (existing) return existing;

  const now = new Date().toISOString();
  const row: ConversationRow = {
    id: `local-conv-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    user_id: userId,
    platform: platform.toLowerCase(),
    created_at: now,
    updated_at: now,
  };
  data.conversations.push(row);
  await writeChatFile(data);
  return row;
}

export async function appendMessageLocal(
  conversationId: string,
  role: 'user' | 'assistant',
  content: string,
  contextSnapshot?: Record<string, unknown> | null
): Promise<MessageRow> {
  const data = await readChatFile();
  const exists = data.conversations.some((c) => c.id === conversationId);
  if (!exists) throw new Error('Conversation not found');

  const row: MessageRow = {
    id: `local-msg-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    conversation_id: conversationId,
    role,
    content,
    context_snapshot: contextSnapshot ?? null,
    created_at: new Date().toISOString(),
  };
  data.messages.push(row);
  await writeChatFile(data);
  return row;
}

export async function listMessagesLocal(
  conversationId: string,
  limit: number = 20
): Promise<MessageRow[]> {
  const data = await readChatFile();
  return data.messages
    .filter((m) => m.conversation_id === conversationId)
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, limit)
    .reverse();
}

export async function addPreferenceLocal(
  userId: string,
  platform: string,
  messageId: string,
  feedback: 'liked' | 'disliked'
): Promise<PreferenceRow> {
  const data = await readChatFile();
  const existing = data.preferences.find((p) => p.message_id === messageId);
  if (existing) {
    existing.feedback = feedback;
    await writeChatFile(data);
    return existing;
  }

  const row: PreferenceRow = {
    id: `local-pref-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    user_id: userId,
    platform: platform.toLowerCase(),
    message_id: messageId,
    feedback,
    created_at: new Date().toISOString(),
  };
  data.preferences.push(row);
  await writeChatFile(data);
  return row;
}

export async function getPreferencesMapLocal(
  userId: string,
  platform: string
): Promise<Map<string, 'liked' | 'disliked'>> {
  const data = await readChatFile();
  const map = new Map<string, 'liked' | 'disliked'>();
  for (const p of data.preferences) {
    if (p.user_id === userId && p.platform.toLowerCase() === platform.toLowerCase()) {
      map.set(p.message_id, p.feedback);
    }
  }
  return map;
}

export async function getPreferenceSummaryLocal(
  userId: string,
  platform: string,
  limit: number = 20
): Promise<{ liked: string[]; disliked: string[] }> {
  const data = await readChatFile();
  const prefs = data.preferences
    .filter(
      (p) =>
        p.user_id === userId && p.platform.toLowerCase() === platform.toLowerCase()
    )
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, limit);

  const liked: string[] = [];
  const disliked: string[] = [];
  for (const p of prefs) {
    const msg = data.messages.find((m) => m.id === p.message_id);
    if (msg && msg.role === 'assistant') {
      if (p.feedback === 'liked') liked.push(msg.content);
      else disliked.push(msg.content);
    }
  }
  return { liked, disliked };
}

// --- Supabase implementations ---

export async function getConversationByUserAndPlatformSupabase(
  supabase: SupabaseClient,
  userId: string,
  platform: string
): Promise<ConversationRow | null> {
  const { data, error } = await supabase
    .from('analytics_chat_conversations')
    .select('id, user_id, platform, created_at, updated_at')
    .eq('user_id', userId)
    .ilike('platform', platform)
    .maybeSingle();

  if (error || !data) return null;
  return {
    id: data.id,
    user_id: data.user_id,
    platform: data.platform,
    created_at: data.created_at,
    updated_at: data.updated_at,
  };
}

export async function getConversationByUserAndPlatformLocal(
  userId: string,
  platform: string
): Promise<ConversationRow | null> {
  const data = await readChatFile();
  const existing = data.conversations.find(
    (c) => c.user_id === userId && c.platform.toLowerCase() === platform.toLowerCase()
  );
  return existing ?? null;
}

export async function getOrCreateConversationSupabase(
  supabase: SupabaseClient,
  userId: string,
  platform: string
): Promise<ConversationRow> {
  const { data: existing } = await supabase
    .from('analytics_chat_conversations')
    .select('id, user_id, platform, created_at, updated_at')
    .eq('user_id', userId)
    .ilike('platform', platform)
    .single();

  if (existing) {
    return {
      id: existing.id,
      user_id: existing.user_id,
      platform: existing.platform,
      created_at: existing.created_at,
      updated_at: existing.updated_at,
    };
  }

  const { data: inserted, error } = await supabase
    .from('analytics_chat_conversations')
    .insert({
      user_id: userId,
      platform: platform.toLowerCase(),
    })
    .select('id, user_id, platform, created_at, updated_at')
    .single();

  if (error) throw error;
  return {
    id: inserted.id,
    user_id: inserted.user_id,
    platform: inserted.platform,
    created_at: inserted.created_at,
    updated_at: inserted.updated_at,
  };
}

export async function appendMessageSupabase(
  supabase: SupabaseClient,
  conversationId: string,
  role: 'user' | 'assistant',
  content: string,
  contextSnapshot?: Record<string, unknown> | null
): Promise<MessageRow> {
  const { data, error } = await supabase
    .from('analytics_chat_messages')
    .insert({
      conversation_id: conversationId,
      role,
      content,
      context_snapshot: contextSnapshot ?? null,
    })
    .select('id, conversation_id, role, content, context_snapshot, created_at')
    .single();

  if (error) throw error;
  return {
    id: data.id,
    conversation_id: data.conversation_id,
    role: data.role as 'user' | 'assistant',
    content: data.content,
    context_snapshot: data.context_snapshot as Record<string, unknown> | null,
    created_at: data.created_at,
  };
}

export async function listMessagesSupabase(
  supabase: SupabaseClient,
  conversationId: string,
  limit: number = 20
): Promise<MessageRow[]> {
  const { data, error } = await supabase
    .from('analytics_chat_messages')
    .select('id, conversation_id, role, content, context_snapshot, created_at')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true })
    .limit(limit);

  if (error) throw error;
  return (data ?? []).map((r) => ({
    id: r.id,
    conversation_id: r.conversation_id,
    role: r.role as 'user' | 'assistant',
    content: r.content,
    context_snapshot: r.context_snapshot as Record<string, unknown> | null,
    created_at: r.created_at,
  }));
}

export async function addPreferenceSupabase(
  supabase: SupabaseClient,
  userId: string,
  platform: string,
  messageId: string,
  feedback: 'liked' | 'disliked'
): Promise<PreferenceRow> {
  const { data: existing } = await supabase
    .from('analytics_chat_preferences')
    .select('id')
    .eq('message_id', messageId)
    .single();

  if (existing) {
    const { data: updated } = await supabase
      .from('analytics_chat_preferences')
      .update({ feedback })
      .eq('id', existing.id)
      .select('id, user_id, platform, message_id, feedback, created_at')
      .single();

    if (updated) {
      return {
        id: updated.id,
        user_id: updated.user_id,
        platform: updated.platform,
        message_id: updated.message_id,
        feedback: updated.feedback as 'liked' | 'disliked',
        created_at: updated.created_at,
      };
    }
  }

  const { data: inserted, error } = await supabase
    .from('analytics_chat_preferences')
    .insert({
      user_id: userId,
      platform: platform.toLowerCase(),
      message_id: messageId,
      feedback,
    })
    .select('id, user_id, platform, message_id, feedback, created_at')
    .single();

  if (error) throw error;
  return {
    id: inserted.id,
    user_id: inserted.user_id,
    platform: inserted.platform,
    message_id: inserted.message_id,
    feedback: inserted.feedback as 'liked' | 'disliked',
    created_at: inserted.created_at,
  };
}

export async function getPreferenceSummarySupabase(
  supabase: SupabaseClient,
  userId: string,
  platform: string,
  limit: number = 20
): Promise<{ liked: string[]; disliked: string[] }> {
  const { data: prefs } = await supabase
    .from('analytics_chat_preferences')
    .select('message_id, feedback')
    .eq('user_id', userId)
    .ilike('platform', platform)
    .order('created_at', { ascending: false })
    .limit(limit);

  const liked: string[] = [];
  const disliked: string[] = [];

  if (!prefs?.length) return { liked, disliked };

  const msgIds = prefs.map((p) => p.message_id);
  const { data: messages } = await supabase
    .from('analytics_chat_messages')
    .select('id, content, role')
    .in('id', msgIds)
    .eq('role', 'assistant');

  const msgMap = new Map((messages ?? []).map((m) => [m.id, m.content]));

  for (const p of prefs) {
    const content = msgMap.get(p.message_id);
    if (content) {
      if (p.feedback === 'liked') liked.push(content);
      else disliked.push(content);
    }
  }

  return { liked, disliked };
}

export function useAnalyticsChatLocalStore(): boolean {
  return useLocalStore();
}
