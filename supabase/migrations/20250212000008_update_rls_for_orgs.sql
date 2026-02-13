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
