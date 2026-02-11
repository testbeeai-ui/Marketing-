-- StoryTeller: analytics chat tables for platform-specific AI assistants
CREATE TABLE IF NOT EXISTS analytics_chat_conversations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id TEXT NOT NULL,
  platform VARCHAR(20) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, platform)
);

CREATE TABLE IF NOT EXISTS analytics_chat_messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  conversation_id UUID NOT NULL REFERENCES analytics_chat_conversations(id) ON DELETE CASCADE,
  role VARCHAR(20) NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  context_snapshot JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS analytics_chat_preferences (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id TEXT NOT NULL,
  platform VARCHAR(20) NOT NULL,
  message_id UUID NOT NULL REFERENCES analytics_chat_messages(id) ON DELETE CASCADE,
  feedback VARCHAR(20) NOT NULL CHECK (feedback IN ('liked', 'disliked')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_analytics_chat_conversations_user_platform ON analytics_chat_conversations(user_id, platform);
CREATE INDEX idx_analytics_chat_messages_conversation ON analytics_chat_messages(conversation_id);
CREATE INDEX idx_analytics_chat_messages_created ON analytics_chat_messages(created_at DESC);
CREATE INDEX idx_analytics_chat_preferences_user_platform ON analytics_chat_preferences(user_id, platform);

-- RLS
ALTER TABLE analytics_chat_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE analytics_chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE analytics_chat_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own analytics_chat_conversations"
  ON analytics_chat_conversations FOR ALL
  USING (auth.uid()::text = user_id);

CREATE POLICY "Users can manage own analytics_chat_messages"
  ON analytics_chat_messages FOR ALL
  USING (
    conversation_id IN (
      SELECT id FROM analytics_chat_conversations WHERE user_id = auth.uid()::text
    )
  );

CREATE POLICY "Users can manage own analytics_chat_preferences"
  ON analytics_chat_preferences FOR ALL
  USING (auth.uid()::text = user_id);
