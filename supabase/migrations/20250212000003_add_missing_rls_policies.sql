-- Add missing INSERT, UPDATE, DELETE policies for organizations and related tables
-- This fixes the "new row violates row-level security policy" error

-- Organizations INSERT policy
DROP POLICY IF EXISTS "Users can create organizations" ON organizations;
CREATE POLICY "Users can create organizations"
ON organizations FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() IS NOT NULL 
  AND created_by = auth.uid()
);

-- SELECT: Users can view organizations they created (before membership is added)
DROP POLICY IF EXISTS "Users can view organizations they created" ON organizations;
CREATE POLICY "Users can view organizations they created"
ON organizations FOR SELECT
TO authenticated
USING (created_by = auth.uid());

-- Organizations UPDATE policy
DROP POLICY IF EXISTS "Owners and admins can update organizations" ON organizations;
CREATE POLICY "Owners and admins can update organizations"
ON organizations FOR UPDATE
USING (
  id IN (
    SELECT organization_id 
    FROM organization_members 
    WHERE user_id = auth.uid() 
    AND role IN ('owner', 'admin')
  )
)
WITH CHECK (
  id IN (
    SELECT organization_id 
    FROM organization_members 
    WHERE user_id = auth.uid() 
    AND role IN ('owner', 'admin')
  )
);

-- Organizations DELETE policy
DROP POLICY IF EXISTS "Owners can delete organizations" ON organizations;
CREATE POLICY "Owners can delete organizations"
ON organizations FOR DELETE
USING (
  id IN (
    SELECT organization_id 
    FROM organization_members 
    WHERE user_id = auth.uid() 
    AND role = 'owner'
  )
);

-- Organization Members INSERT policy
DROP POLICY IF EXISTS "Users can be added to organizations" ON organization_members;
CREATE POLICY "Users can be added to organizations"
ON organization_members FOR INSERT
WITH CHECK (
  -- User can add themselves (for joining via invitation or creating org)
  user_id = auth.uid()
);

-- Organization Members UPDATE policy
DROP POLICY IF EXISTS "Owners and admins can update members" ON organization_members;
CREATE POLICY "Owners and admins can update members"
ON organization_members FOR UPDATE
USING (check_user_org_membership(organization_id))
WITH CHECK (check_user_org_membership(organization_id));

-- Organization Members DELETE policy
DROP POLICY IF EXISTS "Users can leave or be removed from organizations" ON organization_members;
CREATE POLICY "Users can leave or be removed from organizations"
ON organization_members FOR DELETE
USING (
  -- User can remove themselves (leave)
  user_id = auth.uid()
  OR
  -- Or owner/admin can remove others
  check_user_org_membership(organization_id)
);

-- Organization Invitations INSERT policy
DROP POLICY IF EXISTS "Admins can create invitations" ON organization_invitations;
CREATE POLICY "Admins can create invitations"
ON organization_invitations FOR INSERT
WITH CHECK (
  organization_id IN (
    SELECT organization_id 
    FROM organization_members 
    WHERE user_id = auth.uid() 
    AND role IN ('owner', 'admin')
  )
  AND created_by = auth.uid()
);

-- Organization Invitations UPDATE policy
DROP POLICY IF EXISTS "Admins can update invitations" ON organization_invitations;
CREATE POLICY "Admins can update invitations"
ON organization_invitations FOR UPDATE
USING (
  organization_id IN (
    SELECT organization_id 
    FROM organization_members 
    WHERE user_id = auth.uid() 
    AND role IN ('owner', 'admin')
  )
)
WITH CHECK (
  organization_id IN (
    SELECT organization_id 
    FROM organization_members 
    WHERE user_id = auth.uid() 
    AND role IN ('owner', 'admin')
  )
);

-- Organization Invitations DELETE policy
DROP POLICY IF EXISTS "Admins can delete invitations" ON organization_invitations;
CREATE POLICY "Admins can delete invitations"
ON organization_invitations FOR DELETE
USING (
  organization_id IN (
    SELECT organization_id 
    FROM organization_members 
    WHERE user_id = auth.uid() 
    AND role IN ('owner', 'admin')
  )
);
