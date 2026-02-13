-- Demo Mode: Demo Organization, seed data, access_requests, and RLS
-- Demo org ID: 00000000-0000-0000-0000-000000000000

-- 1. Allow organizations without a creator (for demo org)
ALTER TABLE organizations ALTER COLUMN created_by DROP NOT NULL;

-- 2. Insert Demo Organization
INSERT INTO organizations (id, name, slug, description, created_by, created_at, updated_at)
VALUES (
  '00000000-0000-0000-0000-000000000000',
  'Demo Organization',
  'demo',
  'Explore blocks and sub-blocks in read-only mode. Request access to create content.',
  NULL,
  NOW(),
  NOW()
)
ON CONFLICT (id) DO NOTHING;

-- 3. Allow all authenticated users to view the demo organization
DROP POLICY IF EXISTS "Anyone can view demo organization" ON organizations;
CREATE POLICY "Anyone can view demo organization"
  ON organizations FOR SELECT
  TO authenticated
  USING (id = '00000000-0000-0000-0000-000000000000'::uuid);

-- 4. Update check_user_org_membership to allow Demo Org (read-only access for all)
CREATE OR REPLACE FUNCTION check_user_org_membership(org_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
DECLARE
  current_user_id UUID;
  demo_org_id UUID := '00000000-0000-0000-0000-000000000000'::UUID;
BEGIN
  IF org_id = demo_org_id THEN
    RETURN TRUE;
  END IF;
  current_user_id := auth.uid();
  IF current_user_id IS NULL THEN
    RETURN FALSE;
  END IF;
  RETURN EXISTS (
    SELECT 1
    FROM organization_members
    WHERE organization_id = org_id
    AND user_id = current_user_id
  );
END;
$$;

GRANT EXECUTE ON FUNCTION check_user_org_membership(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION check_user_org_membership(UUID) TO anon;

-- 5. Seed Demo Blocks (one main "Marketing" block)
INSERT INTO blocks (id, user_id, name, description, organization_id, created_at, updated_at)
VALUES (
  'demo-block-marketing',
  NULL,
  'Marketing',
  'Sample block to explore how blocks and sub-blocks work.',
  '00000000-0000-0000-0000-000000000000',
  NOW() - INTERVAL '1 day',
  NOW() - INTERVAL '1 day'
)
ON CONFLICT (id) DO NOTHING;

-- 6. Seed Demo Sub-blocks
INSERT INTO sub_blocks (id, user_id, block_id, name, prompt, story_variations, selected_variation_id, platform_contents, organization_id, created_at, updated_at)
VALUES
  (
    'demo-sub-1',
    NULL,
    'demo-block-marketing',
    'Welcome post',
    'A short welcome message for new followers',
    '{"variations":[]}'::jsonb,
    NULL,
    '{"linkedin":"Welcome to our page! We share tips and updates here.","twitter":"Welcome! Follow for updates.","instagram":"Welcome!","facebook":"Thanks for following us."}'::jsonb,
    '00000000-0000-0000-0000-000000000000',
    NOW() - INTERVAL '1 day',
    NOW() - INTERVAL '1 day'
  ),
  (
    'demo-sub-2',
    NULL,
    'demo-block-marketing',
    'Product highlight',
    'Highlight our main product benefit',
    '{"variations":[]}'::jsonb,
    NULL,
    '{"linkedin":"Our solution helps teams save time.","twitter":"Save time with our tool.","instagram":"Check out our latest.","facebook":"See what we offer."}'::jsonb,
    '00000000-0000-0000-0000-000000000000',
    NOW() - INTERVAL '1 day',
    NOW() - INTERVAL '1 day'
  ),
  (
    'demo-sub-3',
    NULL,
    'demo-block-marketing',
    'Tip of the week',
    'Share a quick marketing tip',
    '{"variations":[]}'::jsonb,
    NULL,
    '{"linkedin":"Tip: Consistency beats perfection in content.","twitter":"Tip: Post regularly.","instagram":"Quick tip inside.","facebook":"Weekly tip for you."}'::jsonb,
    '00000000-0000-0000-0000-000000000000',
    NOW() - INTERVAL '1 day',
    NOW() - INTERVAL '1 day'
  )
ON CONFLICT (id) DO NOTHING;

-- 7. access_requests table (social handles / request access form)
CREATE TABLE IF NOT EXISTS access_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  requested_role TEXT NOT NULL DEFAULT 'member' CHECK (requested_role IN ('admin', 'member')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  message TEXT,
  details JSONB DEFAULT '{}',
  reviewed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_access_requests_org ON access_requests(organization_id);
CREATE INDEX IF NOT EXISTS idx_access_requests_user ON access_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_access_requests_status ON access_requests(status);

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'update_updated_at_column') THEN
    DROP TRIGGER IF EXISTS update_access_requests_updated_at ON access_requests;
    CREATE TRIGGER update_access_requests_updated_at
      BEFORE UPDATE ON access_requests
      FOR EACH ROW
      EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;

ALTER TABLE access_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own access requests"
  ON access_requests FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Admins can view access requests for their orgs"
  ON access_requests FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
    )
  );

CREATE POLICY "Users can create access requests"
  ON access_requests FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Admins can update access requests"
  ON access_requests FOR UPDATE
  USING (
    organization_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
    )
  );

COMMENT ON TABLE access_requests IS 'User requests to join organizations (e.g. from demo mode)';
COMMENT ON COLUMN access_requests.details IS 'JSON e.g. social handles, company name';

-- 8. Demo org is read-only: restrict INSERT/UPDATE/DELETE to non-demo orgs
-- (SELECT already allowed via check_user_org_membership; re-create write policies to exclude demo org)
-- Use literal UUID in policies (policy expressions are evaluated in table context, not PL/pgSQL).
DROP POLICY IF EXISTS "Users can insert blocks in their organizations" ON blocks;
CREATE POLICY "Users can insert blocks in their organizations" ON blocks FOR INSERT
  WITH CHECK (check_user_org_membership(organization_id) AND organization_id <> '00000000-0000-0000-0000-000000000000'::uuid);
DROP POLICY IF EXISTS "Users can update blocks in their organizations" ON blocks;
CREATE POLICY "Users can update blocks in their organizations" ON blocks FOR UPDATE
  USING (check_user_org_membership(organization_id) AND organization_id <> '00000000-0000-0000-0000-000000000000'::uuid)
  WITH CHECK (check_user_org_membership(organization_id) AND organization_id <> '00000000-0000-0000-0000-000000000000'::uuid);
DROP POLICY IF EXISTS "Users can delete blocks in their organizations" ON blocks;
CREATE POLICY "Users can delete blocks in their organizations" ON blocks FOR DELETE
  USING (check_user_org_membership(organization_id) AND organization_id <> '00000000-0000-0000-0000-000000000000'::uuid);

DROP POLICY IF EXISTS "Users can insert sub_blocks in their organizations" ON sub_blocks;
CREATE POLICY "Users can insert sub_blocks in their organizations" ON sub_blocks FOR INSERT
  WITH CHECK (check_user_org_membership(organization_id) AND organization_id <> '00000000-0000-0000-0000-000000000000'::uuid);
DROP POLICY IF EXISTS "Users can update sub_blocks in their organizations" ON sub_blocks;
CREATE POLICY "Users can update sub_blocks in their organizations" ON sub_blocks FOR UPDATE
  USING (check_user_org_membership(organization_id) AND organization_id <> '00000000-0000-0000-0000-000000000000'::uuid)
  WITH CHECK (check_user_org_membership(organization_id) AND organization_id <> '00000000-0000-0000-0000-000000000000'::uuid);
DROP POLICY IF EXISTS "Users can delete sub_blocks in their organizations" ON sub_blocks;
CREATE POLICY "Users can delete sub_blocks in their organizations" ON sub_blocks FOR DELETE
  USING (check_user_org_membership(organization_id) AND organization_id <> '00000000-0000-0000-0000-000000000000'::uuid);

DROP POLICY IF EXISTS "Users can insert documents in their organizations" ON documents;
CREATE POLICY "Users can insert documents in their organizations" ON documents FOR INSERT
  WITH CHECK (check_user_org_membership(organization_id) AND organization_id <> '00000000-0000-0000-0000-000000000000'::uuid);
DROP POLICY IF EXISTS "Users can update documents in their organizations" ON documents;
CREATE POLICY "Users can update documents in their organizations" ON documents FOR UPDATE
  USING (check_user_org_membership(organization_id) AND organization_id <> '00000000-0000-0000-0000-000000000000'::uuid)
  WITH CHECK (check_user_org_membership(organization_id) AND organization_id <> '00000000-0000-0000-0000-000000000000'::uuid);
DROP POLICY IF EXISTS "Users can delete documents in their organizations" ON documents;
CREATE POLICY "Users can delete documents in their organizations" ON documents FOR DELETE
  USING (check_user_org_membership(organization_id) AND organization_id <> '00000000-0000-0000-0000-000000000000'::uuid);

DROP POLICY IF EXISTS "Users can insert vector_chunks in their organizations" ON vector_chunks;
CREATE POLICY "Users can insert vector_chunks in their organizations" ON vector_chunks FOR INSERT
  WITH CHECK (check_user_org_membership(organization_id) AND organization_id <> '00000000-0000-0000-0000-000000000000'::uuid);
DROP POLICY IF EXISTS "Users can update vector_chunks in their organizations" ON vector_chunks;
CREATE POLICY "Users can update vector_chunks in their organizations" ON vector_chunks FOR UPDATE
  USING (check_user_org_membership(organization_id) AND organization_id <> '00000000-0000-0000-0000-000000000000'::uuid)
  WITH CHECK (check_user_org_membership(organization_id) AND organization_id <> '00000000-0000-0000-0000-000000000000'::uuid);
DROP POLICY IF EXISTS "Users can delete vector_chunks in their organizations" ON vector_chunks;
CREATE POLICY "Users can delete vector_chunks in their organizations" ON vector_chunks FOR DELETE
  USING (check_user_org_membership(organization_id) AND organization_id <> '00000000-0000-0000-0000-000000000000'::uuid);

DROP POLICY IF EXISTS "Users can insert user_memories in their organizations" ON user_memories;
CREATE POLICY "Users can insert user_memories in their organizations" ON user_memories FOR INSERT
  WITH CHECK (check_user_org_membership(organization_id) AND organization_id <> '00000000-0000-0000-0000-000000000000'::uuid);
DROP POLICY IF EXISTS "Users can update user_memories in their organizations" ON user_memories;
CREATE POLICY "Users can update user_memories in their organizations" ON user_memories FOR UPDATE
  USING (check_user_org_membership(organization_id) AND organization_id <> '00000000-0000-0000-0000-000000000000'::uuid)
  WITH CHECK (check_user_org_membership(organization_id) AND organization_id <> '00000000-0000-0000-0000-000000000000'::uuid);
DROP POLICY IF EXISTS "Users can delete user_memories in their organizations" ON user_memories;
CREATE POLICY "Users can delete user_memories in their organizations" ON user_memories FOR DELETE
  USING (check_user_org_membership(organization_id) AND organization_id <> '00000000-0000-0000-0000-000000000000'::uuid);

DROP POLICY IF EXISTS "Users can insert sessions in their organizations" ON sessions;
CREATE POLICY "Users can insert sessions in their organizations" ON sessions FOR INSERT
  WITH CHECK (check_user_org_membership(organization_id) AND organization_id <> '00000000-0000-0000-0000-000000000000'::uuid);
DROP POLICY IF EXISTS "Users can update sessions in their organizations" ON sessions;
CREATE POLICY "Users can update sessions in their organizations" ON sessions FOR UPDATE
  USING (check_user_org_membership(organization_id) AND organization_id <> '00000000-0000-0000-0000-000000000000'::uuid)
  WITH CHECK (check_user_org_membership(organization_id) AND organization_id <> '00000000-0000-0000-0000-000000000000'::uuid);
DROP POLICY IF EXISTS "Users can delete sessions in their organizations" ON sessions;
CREATE POLICY "Users can delete sessions in their organizations" ON sessions FOR DELETE
  USING (check_user_org_membership(organization_id) AND organization_id <> '00000000-0000-0000-0000-000000000000'::uuid);

DROP POLICY IF EXISTS "Users can insert analytics_snapshots in their organizations" ON analytics_snapshots;
CREATE POLICY "Users can insert analytics_snapshots in their organizations" ON analytics_snapshots FOR INSERT
  WITH CHECK (check_user_org_membership(organization_id) AND organization_id <> '00000000-0000-0000-0000-000000000000'::uuid);
DROP POLICY IF EXISTS "Users can update analytics_snapshots in their organizations" ON analytics_snapshots;
CREATE POLICY "Users can update analytics_snapshots in their organizations" ON analytics_snapshots FOR UPDATE
  USING (check_user_org_membership(organization_id) AND organization_id <> '00000000-0000-0000-0000-000000000000'::uuid)
  WITH CHECK (check_user_org_membership(organization_id) AND organization_id <> '00000000-0000-0000-0000-000000000000'::uuid);
DROP POLICY IF EXISTS "Users can delete analytics_snapshots in their organizations" ON analytics_snapshots;
CREATE POLICY "Users can delete analytics_snapshots in their organizations" ON analytics_snapshots FOR DELETE
  USING (check_user_org_membership(organization_id) AND organization_id <> '00000000-0000-0000-0000-000000000000'::uuid);
