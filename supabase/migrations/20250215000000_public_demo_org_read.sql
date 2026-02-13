-- Allow all authenticated users to read (SELECT) the public demo organization's content.
-- Org 1305bb82-5c49-4e27-bccd-9c942fa7fb06 is shown to new users; they can view blocks/sub_blocks/documents read-only.

CREATE OR REPLACE FUNCTION public_demo_organization_id()
RETURNS UUID
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT '1305bb82-5c49-4e27-bccd-9c942fa7fb06'::uuid;
$$;

GRANT EXECUTE ON FUNCTION public_demo_organization_id() TO authenticated;

-- Blocks: allow SELECT for public demo org
DROP POLICY IF EXISTS "Users can read blocks in their organizations" ON blocks;
CREATE POLICY "Users can read blocks in their organizations" ON blocks FOR SELECT
  USING (check_user_org_membership(organization_id) OR organization_id = public_demo_organization_id());

-- Sub-blocks: allow SELECT for public demo org
DROP POLICY IF EXISTS "Users can read sub_blocks in their organizations" ON sub_blocks;
CREATE POLICY "Users can read sub_blocks in their organizations" ON sub_blocks FOR SELECT
  USING (check_user_org_membership(organization_id) OR organization_id = public_demo_organization_id());

-- Documents: allow SELECT for public demo org
DROP POLICY IF EXISTS "Users can read documents in their organizations" ON documents;
CREATE POLICY "Users can read documents in their organizations" ON documents FOR SELECT
  USING (check_user_org_membership(organization_id) OR organization_id = public_demo_organization_id());
