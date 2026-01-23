-- Run this in your Supabase SQL Editor to fix the missing tables issue

-- Blocks Table
CREATE TABLE IF NOT EXISTS blocks (
    id TEXT PRIMARY KEY,
    user_id BIGINT REFERENCES user_profiles(user_id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Documents Table (Knowledge Base)
CREATE TABLE IF NOT EXISTS documents (
    id TEXT PRIMARY KEY,
    block_id TEXT REFERENCES blocks(id) ON DELETE CASCADE,
    file_name TEXT NOT NULL,
    content TEXT,
    file_size INTEGER,
    status VARCHAR(20) DEFAULT 'indexing',
    uploaded_at TIMESTAMP DEFAULT NOW()
);

-- Sub-Blocks Table
CREATE TABLE IF NOT EXISTS sub_blocks (
    id TEXT PRIMARY KEY,
    user_id BIGINT REFERENCES user_profiles(user_id) ON DELETE CASCADE,
    block_id TEXT REFERENCES blocks(id) ON DELETE CASCADE,
    name TEXT,
    prompt TEXT,
    story_variations JSONB,
    selected_variation_id TEXT,
    platform_contents JSONB,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Add indexes
CREATE INDEX IF NOT EXISTS idx_blocks_user_id ON blocks(user_id);
CREATE INDEX IF NOT EXISTS idx_documents_block_id ON documents(block_id);
CREATE INDEX IF NOT EXISTS idx_sub_blocks_block_id ON sub_blocks(block_id);
