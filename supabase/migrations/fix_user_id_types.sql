-- Migration to fix user_id type mismatches across all tables
-- This changes all user_id columns from BIGINT to TEXT to support UUIDs from Supabase auth

-- Drop existing foreign key constraints
ALTER TABLE user_memories DROP CONSTRAINT IF EXISTS user_memories_user_id_fkey;
ALTER TABLE sessions DROP CONSTRAINT IF EXISTS sessions_user_id_fkey;
ALTER TABLE platform_captions DROP CONSTRAINT IF EXISTS platform_captions_session_id_fkey;
ALTER TABLE blocks DROP CONSTRAINT IF EXISTS blocks_user_id_fkey;
ALTER TABLE sub_blocks DROP CONSTRAINT IF EXISTS sub_blocks_user_id_fkey;
ALTER TABLE documents DROP CONSTRAINT IF EXISTS documents_block_id_fkey;
ALTER TABLE vector_chunks DROP CONSTRAINT IF EXISTS vector_chunks_user_id_fkey;
ALTER TABLE vector_chunks DROP CONSTRAINT IF EXISTS vector_chunks_block_id_fkey;
ALTER TABLE vector_chunks DROP CONSTRAINT IF EXISTS vector_chunks_file_id_fkey;

-- Change user_profiles primary key from BIGINT to TEXT
ALTER TABLE user_profiles ALTER COLUMN user_id TYPE TEXT USING user_id::TEXT;

-- Change user_id columns in all tables to TEXT
ALTER TABLE user_memories ALTER COLUMN user_id TYPE TEXT USING user_id::TEXT;
ALTER TABLE sessions ALTER COLUMN user_id TYPE TEXT USING user_id::TEXT;
ALTER TABLE blocks ALTER COLUMN user_id TYPE TEXT USING user_id::TEXT;
ALTER TABLE sub_blocks ALTER COLUMN user_id TYPE TEXT USING user_id::TEXT;
ALTER TABLE vector_chunks ALTER COLUMN user_id TYPE TEXT USING user_id::TEXT;

-- Re-create foreign key constraints
ALTER TABLE user_memories ADD CONSTRAINT user_memories_user_id_fkey 
    FOREIGN KEY (user_id) REFERENCES user_profiles(user_id) ON DELETE CASCADE;

ALTER TABLE sessions ADD CONSTRAINT sessions_user_id_fkey 
    FOREIGN KEY (user_id) REFERENCES user_profiles(user_id) ON DELETE CASCADE;

ALTER TABLE platform_captions ADD CONSTRAINT platform_captions_session_id_fkey 
    FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE;

ALTER TABLE blocks ADD CONSTRAINT blocks_user_id_fkey 
    FOREIGN KEY (user_id) REFERENCES user_profiles(user_id) ON DELETE CASCADE;

ALTER TABLE sub_blocks ADD CONSTRAINT sub_blocks_user_id_fkey 
    FOREIGN KEY (user_id) REFERENCES user_profiles(user_id) ON DELETE CASCADE;

ALTER TABLE documents ADD CONSTRAINT documents_block_id_fkey 
    FOREIGN KEY (block_id) REFERENCES blocks(id) ON DELETE CASCADE;

ALTER TABLE vector_chunks ADD CONSTRAINT vector_chunks_user_id_fkey 
    FOREIGN KEY (user_id) REFERENCES user_profiles(user_id) ON DELETE CASCADE;

ALTER TABLE vector_chunks ADD CONSTRAINT vector_chunks_block_id_fkey 
    FOREIGN KEY (block_id) REFERENCES blocks(id) ON DELETE CASCADE;

ALTER TABLE vector_chunks ADD CONSTRAINT vector_chunks_file_id_fkey 
    FOREIGN KEY (file_id) REFERENCES documents(id) ON DELETE CASCADE;

-- Update indexes
DROP INDEX IF EXISTS idx_user_memories_user_id;
DROP INDEX IF EXISTS idx_vector_chunks_user_id;
DROP INDEX IF EXISTS idx_blocks_user_id;
DROP INDEX IF EXISTS idx_sub_blocks_block_id;
DROP INDEX IF EXISTS idx_documents_block_id;

CREATE INDEX idx_user_memories_user_id ON user_memories(user_id);
CREATE INDEX idx_vector_chunks_user_id ON vector_chunks(user_id);
CREATE INDEX idx_blocks_user_id ON blocks(user_id);
CREATE INDEX idx_sub_blocks_block_id ON sub_blocks(block_id);
CREATE INDEX idx_documents_block_id ON documents(block_id);