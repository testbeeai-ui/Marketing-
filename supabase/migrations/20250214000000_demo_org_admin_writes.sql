-- Allow Demo Organization owner/admin to write (blocks, sub_blocks, documents, etc.)
-- Link your account via POST /api/admin/link-demo-org; then you can upload, generate, and manage what demo users see.

CREATE OR REPLACE FUNCTION is_demo_org_admin()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM organization_members
    WHERE organization_id = '00000000-0000-0000-0000-000000000000'::uuid
      AND user_id = auth.uid()
      AND role IN ('owner', 'admin')
  );
$$;

GRANT EXECUTE ON FUNCTION is_demo_org_admin() TO authenticated;

-- Writes allowed when: (not demo org) OR (demo org AND current user is demo org owner/admin)
-- Expression: check_user_org_membership(organization_id) AND (organization_id <> demo_uuid OR is_demo_org_admin())

DROP POLICY IF EXISTS "Users can insert blocks in their organizations" ON blocks;
CREATE POLICY "Users can insert blocks in their organizations" ON blocks FOR INSERT
  WITH CHECK (check_user_org_membership(organization_id) AND (organization_id <> '00000000-0000-0000-0000-000000000000'::uuid OR is_demo_org_admin()));
DROP POLICY IF EXISTS "Users can update blocks in their organizations" ON blocks;
CREATE POLICY "Users can update blocks in their organizations" ON blocks FOR UPDATE
  USING (check_user_org_membership(organization_id) AND (organization_id <> '00000000-0000-0000-0000-000000000000'::uuid OR is_demo_org_admin()))
  WITH CHECK (check_user_org_membership(organization_id) AND (organization_id <> '00000000-0000-0000-0000-000000000000'::uuid OR is_demo_org_admin()));
DROP POLICY IF EXISTS "Users can delete blocks in their organizations" ON blocks;
CREATE POLICY "Users can delete blocks in their organizations" ON blocks FOR DELETE
  USING (check_user_org_membership(organization_id) AND (organization_id <> '00000000-0000-0000-0000-000000000000'::uuid OR is_demo_org_admin()));

DROP POLICY IF EXISTS "Users can insert sub_blocks in their organizations" ON sub_blocks;
CREATE POLICY "Users can insert sub_blocks in their organizations" ON sub_blocks FOR INSERT
  WITH CHECK (check_user_org_membership(organization_id) AND (organization_id <> '00000000-0000-0000-0000-000000000000'::uuid OR is_demo_org_admin()));
DROP POLICY IF EXISTS "Users can update sub_blocks in their organizations" ON sub_blocks;
CREATE POLICY "Users can update sub_blocks in their organizations" ON sub_blocks FOR UPDATE
  USING (check_user_org_membership(organization_id) AND (organization_id <> '00000000-0000-0000-0000-000000000000'::uuid OR is_demo_org_admin()))
  WITH CHECK (check_user_org_membership(organization_id) AND (organization_id <> '00000000-0000-0000-0000-000000000000'::uuid OR is_demo_org_admin()));
DROP POLICY IF EXISTS "Users can delete sub_blocks in their organizations" ON sub_blocks;
CREATE POLICY "Users can delete sub_blocks in their organizations" ON sub_blocks FOR DELETE
  USING (check_user_org_membership(organization_id) AND (organization_id <> '00000000-0000-0000-0000-000000000000'::uuid OR is_demo_org_admin()));

DROP POLICY IF EXISTS "Users can insert documents in their organizations" ON documents;
CREATE POLICY "Users can insert documents in their organizations" ON documents FOR INSERT
  WITH CHECK (check_user_org_membership(organization_id) AND (organization_id <> '00000000-0000-0000-0000-000000000000'::uuid OR is_demo_org_admin()));
DROP POLICY IF EXISTS "Users can update documents in their organizations" ON documents;
CREATE POLICY "Users can update documents in their organizations" ON documents FOR UPDATE
  USING (check_user_org_membership(organization_id) AND (organization_id <> '00000000-0000-0000-0000-000000000000'::uuid OR is_demo_org_admin()))
  WITH CHECK (check_user_org_membership(organization_id) AND (organization_id <> '00000000-0000-0000-0000-000000000000'::uuid OR is_demo_org_admin()));
DROP POLICY IF EXISTS "Users can delete documents in their organizations" ON documents;
CREATE POLICY "Users can delete documents in their organizations" ON documents FOR DELETE
  USING (check_user_org_membership(organization_id) AND (organization_id <> '00000000-0000-0000-0000-000000000000'::uuid OR is_demo_org_admin()));

DROP POLICY IF EXISTS "Users can insert vector_chunks in their organizations" ON vector_chunks;
CREATE POLICY "Users can insert vector_chunks in their organizations" ON vector_chunks FOR INSERT
  WITH CHECK (check_user_org_membership(organization_id) AND (organization_id <> '00000000-0000-0000-0000-000000000000'::uuid OR is_demo_org_admin()));
DROP POLICY IF EXISTS "Users can update vector_chunks in their organizations" ON vector_chunks;
CREATE POLICY "Users can update vector_chunks in their organizations" ON vector_chunks FOR UPDATE
  USING (check_user_org_membership(organization_id) AND (organization_id <> '00000000-0000-0000-0000-000000000000'::uuid OR is_demo_org_admin()))
  WITH CHECK (check_user_org_membership(organization_id) AND (organization_id <> '00000000-0000-0000-0000-000000000000'::uuid OR is_demo_org_admin()));
DROP POLICY IF EXISTS "Users can delete vector_chunks in their organizations" ON vector_chunks;
CREATE POLICY "Users can delete vector_chunks in their organizations" ON vector_chunks FOR DELETE
  USING (check_user_org_membership(organization_id) AND (organization_id <> '00000000-0000-0000-0000-000000000000'::uuid OR is_demo_org_admin()));

DROP POLICY IF EXISTS "Users can insert user_memories in their organizations" ON user_memories;
CREATE POLICY "Users can insert user_memories in their organizations" ON user_memories FOR INSERT
  WITH CHECK (check_user_org_membership(organization_id) AND (organization_id <> '00000000-0000-0000-0000-000000000000'::uuid OR is_demo_org_admin()));
DROP POLICY IF EXISTS "Users can update user_memories in their organizations" ON user_memories;
CREATE POLICY "Users can update user_memories in their organizations" ON user_memories FOR UPDATE
  USING (check_user_org_membership(organization_id) AND (organization_id <> '00000000-0000-0000-0000-000000000000'::uuid OR is_demo_org_admin()))
  WITH CHECK (check_user_org_membership(organization_id) AND (organization_id <> '00000000-0000-0000-0000-000000000000'::uuid OR is_demo_org_admin()));
DROP POLICY IF EXISTS "Users can delete user_memories in their organizations" ON user_memories;
CREATE POLICY "Users can delete user_memories in their organizations" ON user_memories FOR DELETE
  USING (check_user_org_membership(organization_id) AND (organization_id <> '00000000-0000-0000-0000-000000000000'::uuid OR is_demo_org_admin()));

DROP POLICY IF EXISTS "Users can insert sessions in their organizations" ON sessions;
CREATE POLICY "Users can insert sessions in their organizations" ON sessions FOR INSERT
  WITH CHECK (check_user_org_membership(organization_id) AND (organization_id <> '00000000-0000-0000-0000-000000000000'::uuid OR is_demo_org_admin()));
DROP POLICY IF EXISTS "Users can update sessions in their organizations" ON sessions;
CREATE POLICY "Users can update sessions in their organizations" ON sessions FOR UPDATE
  USING (check_user_org_membership(organization_id) AND (organization_id <> '00000000-0000-0000-0000-000000000000'::uuid OR is_demo_org_admin()))
  WITH CHECK (check_user_org_membership(organization_id) AND (organization_id <> '00000000-0000-0000-0000-000000000000'::uuid OR is_demo_org_admin()));
DROP POLICY IF EXISTS "Users can delete sessions in their organizations" ON sessions;
CREATE POLICY "Users can delete sessions in their organizations" ON sessions FOR DELETE
  USING (check_user_org_membership(organization_id) AND (organization_id <> '00000000-0000-0000-0000-000000000000'::uuid OR is_demo_org_admin()));

DROP POLICY IF EXISTS "Users can insert analytics_snapshots in their organizations" ON analytics_snapshots;
CREATE POLICY "Users can insert analytics_snapshots in their organizations" ON analytics_snapshots FOR INSERT
  WITH CHECK (check_user_org_membership(organization_id) AND (organization_id <> '00000000-0000-0000-0000-000000000000'::uuid OR is_demo_org_admin()));
DROP POLICY IF EXISTS "Users can update analytics_snapshots in their organizations" ON analytics_snapshots;
CREATE POLICY "Users can update analytics_snapshots in their organizations" ON analytics_snapshots FOR UPDATE
  USING (check_user_org_membership(organization_id) AND (organization_id <> '00000000-0000-0000-0000-000000000000'::uuid OR is_demo_org_admin()))
  WITH CHECK (check_user_org_membership(organization_id) AND (organization_id <> '00000000-0000-0000-0000-000000000000'::uuid OR is_demo_org_admin()));
DROP POLICY IF EXISTS "Users can delete analytics_snapshots in their organizations" ON analytics_snapshots;
CREATE POLICY "Users can delete analytics_snapshots in their organizations" ON analytics_snapshots FOR DELETE
  USING (check_user_org_membership(organization_id) AND (organization_id <> '00000000-0000-0000-0000-000000000000'::uuid OR is_demo_org_admin()));
