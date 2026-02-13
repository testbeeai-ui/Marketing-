-- Add organization_id to all data tables for organization-scoped isolation
-- This migration adds organization_id columns (nullable initially, will be made NOT NULL after data migration)

-- Add organization_id to blocks table
ALTER TABLE blocks 
ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE;

-- Add organization_id to sub_blocks table
ALTER TABLE sub_blocks 
ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE;

-- Add organization_id to documents table
ALTER TABLE documents 
ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE;

-- Add organization_id to vector_chunks table
ALTER TABLE vector_chunks 
ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE;

-- Add organization_id to analytics_snapshots table
ALTER TABLE analytics_snapshots 
ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE;

-- Add organization_id to sessions table
ALTER TABLE sessions 
ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE;

-- Add organization_id to user_memories table
ALTER TABLE user_memories 
ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE;

-- Create indexes for organization_id on all tables for performance
CREATE INDEX IF NOT EXISTS idx_blocks_organization_id ON blocks(organization_id);
CREATE INDEX IF NOT EXISTS idx_sub_blocks_organization_id ON sub_blocks(organization_id);
CREATE INDEX IF NOT EXISTS idx_documents_organization_id ON documents(organization_id);
CREATE INDEX IF NOT EXISTS idx_vector_chunks_organization_id ON vector_chunks(organization_id);
CREATE INDEX IF NOT EXISTS idx_analytics_snapshots_organization_id ON analytics_snapshots(organization_id);
CREATE INDEX IF NOT EXISTS idx_sessions_organization_id ON sessions(organization_id);
CREATE INDEX IF NOT EXISTS idx_user_memories_organization_id ON user_memories(organization_id);

-- Note: organization_id is nullable initially to allow existing data migration
-- It will be made NOT NULL in the next migration after data is migrated
