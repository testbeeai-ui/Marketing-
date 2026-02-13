-- Combined Migration Script
-- Run this script in Supabase SQL Editor to apply all organization-scoped data isolation migrations
-- Make sure to run them in order!

-- ============================================
-- Migration 1: Add organization_id columns
-- ============================================
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

-- ============================================
-- Migration 2: Migrate existing data
-- ============================================
-- Migrate existing data to default organizations
-- Creates a default organization for each user with existing data and migrates all their data to it

DO $$
DECLARE
    user_record RECORD;
    default_org_id UUID;
    user_email TEXT;
    org_slug TEXT;
    org_name TEXT;
BEGIN
    -- Loop through all users who have blocks or analytics
    FOR user_record IN 
        SELECT DISTINCT user_id 
        FROM (
            SELECT user_id FROM blocks
            UNION
            SELECT user_id FROM analytics_snapshots WHERE user_id IS NOT NULL
            UNION
            SELECT user_id FROM sessions WHERE user_id IS NOT NULL
            UNION
            SELECT user_id FROM user_memories WHERE user_id IS NOT NULL
        ) AS users_with_data
        WHERE user_id IS NOT NULL
    LOOP
        -- Get user email from auth.users
        SELECT email INTO user_email 
        FROM auth.users 
        WHERE id::text = user_record.user_id;
        
        -- Skip if user doesn't exist in auth.users
        CONTINUE WHEN user_email IS NULL;
        
        -- Generate organization name and slug
        org_name := COALESCE(user_email, 'User') || '''s Organization';
        org_slug := LOWER(REGEXP_REPLACE(COALESCE(user_email, 'user'), '[^a-z0-9]+', '-', 'g')) || '-org-' || SUBSTRING(user_record.user_id, 1, 8);
        
        -- Check if default org already exists for this user
        SELECT id INTO default_org_id
        FROM organizations
        WHERE slug = org_slug
        LIMIT 1;
        
        -- Create default organization if it doesn't exist
        IF default_org_id IS NULL THEN
            INSERT INTO organizations (id, name, slug, description, created_by)
            VALUES (
                gen_random_uuid(),
                org_name,
                org_slug,
                'Default organization for existing data',
                user_record.user_id::UUID
            )
            RETURNING id INTO default_org_id;
            
            -- Add user as owner of their default organization
            INSERT INTO organization_members (organization_id, user_id, role)
            VALUES (default_org_id, user_record.user_id::UUID, 'owner')
            ON CONFLICT (organization_id, user_id) DO NOTHING;
        END IF;
        
        -- Migrate blocks to organization
        UPDATE blocks 
        SET organization_id = default_org_id
        WHERE user_id = user_record.user_id 
        AND organization_id IS NULL;
        
        -- Migrate sub_blocks to organization (through parent block)
        UPDATE sub_blocks sb
        SET organization_id = b.organization_id
        FROM blocks b
        WHERE sb.block_id = b.id
        AND sb.organization_id IS NULL
        AND b.organization_id IS NOT NULL;
        
        -- Migrate documents to organization (through parent block)
        UPDATE documents d
        SET organization_id = b.organization_id
        FROM blocks b
        WHERE d.block_id = b.id
        AND d.organization_id IS NULL
        AND b.organization_id IS NOT NULL;
        
        -- Migrate vector_chunks to organization (through parent block)
        UPDATE vector_chunks vc
        SET organization_id = b.organization_id
        FROM blocks b
        WHERE vc.block_id = b.id
        AND vc.organization_id IS NULL
        AND b.organization_id IS NOT NULL;
        
        -- Migrate analytics_snapshots to organization
        UPDATE analytics_snapshots 
        SET organization_id = default_org_id
        WHERE user_id = user_record.user_id 
        AND organization_id IS NULL;
        
        -- Migrate sessions to organization
        UPDATE sessions 
        SET organization_id = default_org_id
        WHERE user_id = user_record.user_id 
        AND organization_id IS NULL;
        
        -- Migrate user_memories to organization
        UPDATE user_memories 
        SET organization_id = default_org_id
        WHERE user_id = user_record.user_id 
        AND organization_id IS NULL;
        
        RAISE NOTICE 'Migrated data for user % to organization %', user_record.user_id, default_org_id;
    END LOOP;
END $$;

-- Now make organization_id NOT NULL for all tables
ALTER TABLE blocks 
ALTER COLUMN organization_id SET NOT NULL;

ALTER TABLE sub_blocks 
ALTER COLUMN organization_id SET NOT NULL;

ALTER TABLE documents 
ALTER COLUMN organization_id SET NOT NULL;

ALTER TABLE vector_chunks 
ALTER COLUMN organization_id SET NOT NULL;

ALTER TABLE analytics_snapshots 
ALTER COLUMN organization_id SET NOT NULL;

ALTER TABLE sessions 
ALTER COLUMN organization_id SET NOT NULL;

ALTER TABLE user_memories 
ALTER COLUMN organization_id SET NOT NULL;

-- ============================================
-- Migration 3: Update RLS policies
-- ============================================
-- Update RLS policies to check organization membership
-- All data access is now scoped to organizations the user belongs to

-- Enable RLS on tables that don't have it yet
ALTER TABLE blocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE sub_blocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE vector_chunks ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_memories ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;

-- Drop existing RLS policies that check user_id directly
DROP POLICY IF EXISTS "Users can read own blocks" ON blocks;
DROP POLICY IF EXISTS "Users can insert own blocks" ON blocks;
DROP POLICY IF EXISTS "Users can update own blocks" ON blocks;
DROP POLICY IF EXISTS "Users can delete own blocks" ON blocks;

DROP POLICY IF EXISTS "Users can read own sub_blocks" ON sub_blocks;
DROP POLICY IF EXISTS "Users can insert own sub_blocks" ON sub_blocks;
DROP POLICY IF EXISTS "Users can update own sub_blocks" ON sub_blocks;
DROP POLICY IF EXISTS "Users can delete own sub_blocks" ON sub_blocks;

DROP POLICY IF EXISTS "Users can read own documents" ON documents;
DROP POLICY IF EXISTS "Users can insert own documents" ON documents;
DROP POLICY IF EXISTS "Users can update own documents" ON documents;
DROP POLICY IF EXISTS "Users can delete own documents" ON documents;

DROP POLICY IF EXISTS "Users can read own vector_chunks" ON vector_chunks;
DROP POLICY IF EXISTS "Users can insert own vector_chunks" ON vector_chunks;
DROP POLICY IF EXISTS "Users can update own vector_chunks" ON vector_chunks;
DROP POLICY IF EXISTS "Users can delete own vector_chunks" ON vector_chunks;

DROP POLICY IF EXISTS "Users can read own user_memories" ON user_memories;
DROP POLICY IF EXISTS "Users can insert own user_memories" ON user_memories;
DROP POLICY IF EXISTS "Users can update own user_memories" ON user_memories;
DROP POLICY IF EXISTS "Users can delete own user_memories" ON user_memories;

DROP POLICY IF EXISTS "Users can read own sessions" ON sessions;
DROP POLICY IF EXISTS "Users can insert own sessions" ON sessions;
DROP POLICY IF EXISTS "Users can update own sessions" ON sessions;
DROP POLICY IF EXISTS "Users can delete own sessions" ON sessions;

-- Blocks RLS Policies (organization-scoped)
CREATE POLICY "Users can read blocks in their organizations"
  ON blocks FOR SELECT
  USING (check_user_org_membership(organization_id));

CREATE POLICY "Users can insert blocks in their organizations"
  ON blocks FOR INSERT
  WITH CHECK (check_user_org_membership(organization_id));

CREATE POLICY "Users can update blocks in their organizations"
  ON blocks FOR UPDATE
  USING (check_user_org_membership(organization_id))
  WITH CHECK (check_user_org_membership(organization_id));

CREATE POLICY "Users can delete blocks in their organizations"
  ON blocks FOR DELETE
  USING (check_user_org_membership(organization_id));

-- Sub-blocks RLS Policies (organization-scoped)
CREATE POLICY "Users can read sub_blocks in their organizations"
  ON sub_blocks FOR SELECT
  USING (check_user_org_membership(organization_id));

CREATE POLICY "Users can insert sub_blocks in their organizations"
  ON sub_blocks FOR INSERT
  WITH CHECK (check_user_org_membership(organization_id));

CREATE POLICY "Users can update sub_blocks in their organizations"
  ON sub_blocks FOR UPDATE
  USING (check_user_org_membership(organization_id))
  WITH CHECK (check_user_org_membership(organization_id));

CREATE POLICY "Users can delete sub_blocks in their organizations"
  ON sub_blocks FOR DELETE
  USING (check_user_org_membership(organization_id));

-- Documents RLS Policies (organization-scoped)
CREATE POLICY "Users can read documents in their organizations"
  ON documents FOR SELECT
  USING (check_user_org_membership(organization_id));

CREATE POLICY "Users can insert documents in their organizations"
  ON documents FOR INSERT
  WITH CHECK (check_user_org_membership(organization_id));

CREATE POLICY "Users can update documents in their organizations"
  ON documents FOR UPDATE
  USING (check_user_org_membership(organization_id))
  WITH CHECK (check_user_org_membership(organization_id));

CREATE POLICY "Users can delete documents in their organizations"
  ON documents FOR DELETE
  USING (check_user_org_membership(organization_id));

-- Vector chunks RLS Policies (organization-scoped)
CREATE POLICY "Users can read vector_chunks in their organizations"
  ON vector_chunks FOR SELECT
  USING (check_user_org_membership(organization_id));

CREATE POLICY "Users can insert vector_chunks in their organizations"
  ON vector_chunks FOR INSERT
  WITH CHECK (check_user_org_membership(organization_id));

CREATE POLICY "Users can update vector_chunks in their organizations"
  ON vector_chunks FOR UPDATE
  USING (check_user_org_membership(organization_id))
  WITH CHECK (check_user_org_membership(organization_id));

CREATE POLICY "Users can delete vector_chunks in their organizations"
  ON vector_chunks FOR DELETE
  USING (check_user_org_membership(organization_id));

-- User memories RLS Policies (organization-scoped)
CREATE POLICY "Users can read user_memories in their organizations"
  ON user_memories FOR SELECT
  USING (check_user_org_membership(organization_id));

CREATE POLICY "Users can insert user_memories in their organizations"
  ON user_memories FOR INSERT
  WITH CHECK (check_user_org_membership(organization_id));

CREATE POLICY "Users can update user_memories in their organizations"
  ON user_memories FOR UPDATE
  USING (check_user_org_membership(organization_id))
  WITH CHECK (check_user_org_membership(organization_id));

CREATE POLICY "Users can delete user_memories in their organizations"
  ON user_memories FOR DELETE
  USING (check_user_org_membership(organization_id));

-- Sessions RLS Policies (organization-scoped)
CREATE POLICY "Users can read sessions in their organizations"
  ON sessions FOR SELECT
  USING (check_user_org_membership(organization_id));

CREATE POLICY "Users can insert sessions in their organizations"
  ON sessions FOR INSERT
  WITH CHECK (check_user_org_membership(organization_id));

CREATE POLICY "Users can update sessions in their organizations"
  ON sessions FOR UPDATE
  USING (check_user_org_membership(organization_id))
  WITH CHECK (check_user_org_membership(organization_id));

CREATE POLICY "Users can delete sessions in their organizations"
  ON sessions FOR DELETE
  USING (check_user_org_membership(organization_id));

-- Update analytics_snapshots RLS policies (already has RLS enabled)
DROP POLICY IF EXISTS "Users can read own analytics_snapshots" ON analytics_snapshots;
DROP POLICY IF EXISTS "Users can insert own analytics_snapshots" ON analytics_snapshots;
DROP POLICY IF EXISTS "Users can delete own analytics_snapshots" ON analytics_snapshots;

CREATE POLICY "Users can read analytics_snapshots in their organizations"
  ON analytics_snapshots FOR SELECT
  USING (check_user_org_membership(organization_id));

CREATE POLICY "Users can insert analytics_snapshots in their organizations"
  ON analytics_snapshots FOR INSERT
  WITH CHECK (check_user_org_membership(organization_id));

CREATE POLICY "Users can update analytics_snapshots in their organizations"
  ON analytics_snapshots FOR UPDATE
  USING (check_user_org_membership(organization_id))
  WITH CHECK (check_user_org_membership(organization_id));

CREATE POLICY "Users can delete analytics_snapshots in their organizations"
  ON analytics_snapshots FOR DELETE
  USING (check_user_org_membership(organization_id));

-- ============================================
-- Migration Complete!
-- ============================================
-- After running this script:
-- 1. Go to Supabase Dashboard > Settings > API
-- 2. Click "Refresh Schema Cache"
-- 3. Wait 1-2 minutes for cache to refresh
-- 4. Restart your Next.js development server
