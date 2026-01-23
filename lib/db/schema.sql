-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "vector";

-- Drop existing tables if they exist (clean slate)
DROP TABLE IF EXISTS vector_chunks CASCADE;
DROP TABLE IF EXISTS documents CASCADE;
DROP TABLE IF EXISTS sub_blocks CASCADE;
DROP TABLE IF EXISTS blocks CASCADE;
DROP TABLE IF EXISTS platform_captions CASCADE;
DROP TABLE IF EXISTS sessions CASCADE;
DROP TABLE IF EXISTS user_memories CASCADE;
DROP TABLE IF EXISTS user_profiles CASCADE;

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$
language 'plpgsql';

-- User Profiles Table
CREATE TABLE user_profiles (
    user_id TEXT PRIMARY KEY,
    username TEXT,
    first_name TEXT,
    last_name TEXT,
    
    -- General Preferences
    style_preferences TEXT,                  -- e.g., "Cyberpunk, Neon, Professional"
    brand_voice TEXT,                        -- e.g., "Formal, Witty, Academic"
    
    -- Platform-Specific Brand Voices
    linkedin_voice TEXT,                     -- e.g., "Professional, Story-driven, Insightful"
    twitter_voice TEXT,                      -- e.g., "Witty, Concise, Engaging"
    instagram_voice TEXT,                    -- e.g., "Visual, Emoji-rich, Casual"
    facebook_voice TEXT,                     -- e.g., "Conversational, Community-focused"
    
    -- Onboarding & Preferences
    onboarding_completed BOOLEAN DEFAULT FALSE,
    preferred_emoji_usage VARCHAR(20),       -- 'minimal', 'moderate', 'heavy'
    preferred_formality VARCHAR(20),          -- 'formal', 'casual', 'mixed'
    
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- User Memories Table
CREATE TABLE user_memories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id TEXT REFERENCES user_profiles(user_id) ON DELETE CASCADE,
    memory_type VARCHAR(50) NOT NULL,       -- See memory types below
    content TEXT NOT NULL,                  -- The actual content (prompt, caption, story, etc.)
    context_metadata JSONB,                 -- Additional context (style analysis, etc.)
    created_at TIMESTAMP DEFAULT NOW()
);

-- Sessions Table (for session management)
CREATE TABLE sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id TEXT NOT NULL REFERENCES user_profiles(user_id) ON DELETE CASCADE,
    state VARCHAR(50) NOT NULL DEFAULT 'WAITING_INPUT',
    raw_input TEXT,
    enhanced_prompt TEXT,
    image_url TEXT,
    image_status VARCHAR(20) DEFAULT 'pending',
    text_status VARCHAR(20) DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Platform Captions Table (for platform-specific captions)
CREATE TABLE platform_captions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id UUID REFERENCES sessions(id) ON DELETE CASCADE,
    platform VARCHAR(20) NOT NULL,          -- linkedin, twitter, instagram, facebook
    caption TEXT NOT NULL,
    status VARCHAR(20) DEFAULT 'pending',   -- pending, approved, modified
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(session_id, platform)
);

-- Blocks Table
CREATE TABLE blocks (
    id TEXT PRIMARY KEY,
    user_id TEXT REFERENCES user_profiles(user_id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Documents Table (Knowledge Base)
CREATE TABLE documents (
    id TEXT PRIMARY KEY,
    block_id TEXT REFERENCES blocks(id) ON DELETE CASCADE,
    file_name TEXT NOT NULL,
    content TEXT,
    file_size INTEGER,
    status VARCHAR(20) DEFAULT 'indexing',
    uploaded_at TIMESTAMP DEFAULT NOW()
);

-- Sub-Blocks Table
CREATE TABLE sub_blocks (
    id TEXT PRIMARY KEY,
    user_id TEXT REFERENCES user_profiles(user_id) ON DELETE CASCADE,
    block_id TEXT REFERENCES blocks(id) ON DELETE CASCADE,
    name TEXT,
    prompt TEXT,
    story_variations JSONB,
    selected_variation_id TEXT,
    platform_contents JSONB,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Vector Chunks Table (for AI vector search)
CREATE TABLE vector_chunks (
    id TEXT PRIMARY KEY,
    user_id TEXT REFERENCES user_profiles(user_id) ON DELETE CASCADE,
    block_id TEXT REFERENCES blocks(id) ON DELETE CASCADE,
    file_id TEXT REFERENCES documents(id) ON DELETE CASCADE,
    text TEXT,
    embedding vector(768),
    metadata JSONB,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Add triggers for updated_at
CREATE TRIGGER update_user_profiles_updated_at BEFORE UPDATE ON user_profiles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_sessions_updated_at BEFORE UPDATE ON sessions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_platform_captions_updated_at BEFORE UPDATE ON platform_captions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_blocks_updated_at BEFORE UPDATE ON blocks
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_sub_blocks_updated_at BEFORE UPDATE ON sub_blocks
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Create indexes for performance
CREATE INDEX idx_user_memories_user_id ON user_memories(user_id);
CREATE INDEX idx_user_memories_type ON user_memories(memory_type);
CREATE INDEX idx_user_memories_created ON user_memories(created_at DESC);

CREATE INDEX idx_blocks_user_id ON blocks(user_id);
CREATE INDEX idx_documents_block_id ON documents(block_id);
CREATE INDEX idx_sub_blocks_block_id ON sub_blocks(block_id);

-- Vector store indexes
CREATE INDEX idx_vector_chunks_embedding ON vector_chunks USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
CREATE INDEX idx_vector_chunks_block_id ON vector_chunks(block_id);
CREATE INDEX idx_vector_chunks_file_id ON vector_chunks(file_id);
CREATE INDEX idx_vector_chunks_user_id ON vector_chunks(user_id);

-- Match function for vector search
CREATE OR REPLACE FUNCTION match_vector_chunks(
  query_embedding vector(1536),
  match_threshold float,
  match_count int,
  match_block_id text,
  match_user_id text DEFAULT NULL
)
RETURNS TABLE (
  id text,
  user_id text,
  block_id text,
  file_id text,
  text text,
  embedding vector(1536),
  metadata jsonb,
  similarity float
)
LANGUAGE plpgsql
AS
$$
BEGIN
  RETURN QUERY
  SELECT
    vector_chunks.id,
    vector_chunks.user_id,
    vector_chunks.block_id,
    vector_chunks.file_id,
    vector_chunks.text,
    vector_chunks.embedding,
    vector_chunks.metadata,
    1 - (vector_chunks.embedding <=> query_embedding) as similarity
  FROM vector_chunks
  WHERE 1 - (vector_chunks.embedding <=> query_embedding) > match_threshold
  AND vector_chunks.block_id = match_block_id
  AND (match_user_id IS NULL OR vector_chunks.user_id = match_user_id)
  ORDER BY vector_chunks.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- Grant permissions (adjust based on your Supabase setup)
GRANT ALL ON ALL TABLES IN SCHEMA public TO postgres;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO postgres;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO postgres;
