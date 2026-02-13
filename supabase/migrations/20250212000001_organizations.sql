-- Organizations System Migration
-- Creates tables for multi-tenant organization support

-- Organizations Table
CREATE TABLE IF NOT EXISTS organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  description TEXT,
  logo_url TEXT,
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_organizations_slug ON organizations(slug);
CREATE INDEX IF NOT EXISTS idx_organizations_created_by ON organizations(created_by);

-- Organization Members Table (Many-to-Many)
CREATE TABLE IF NOT EXISTS organization_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('owner', 'admin', 'member')),
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(organization_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_org_members_org ON organization_members(organization_id);
CREATE INDEX IF NOT EXISTS idx_org_members_user ON organization_members(user_id);

-- Organization Invitations Table
CREATE TABLE IF NOT EXISTS organization_invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Invitation Code
  invitation_code TEXT UNIQUE NOT NULL,
  expires_at TIMESTAMPTZ,
  max_uses INTEGER DEFAULT 1,
  uses_count INTEGER DEFAULT 0,
  
  -- Email-based invitation
  email TEXT,
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('admin', 'member')),
  
  -- Status
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'expired', 'revoked')),
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  accepted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_invitations_code ON organization_invitations(invitation_code);
CREATE INDEX IF NOT EXISTS idx_invitations_org ON organization_invitations(organization_id);
CREATE INDEX IF NOT EXISTS idx_invitations_email ON organization_invitations(email);

-- Add organization_id to existing tables (optional - can be done later)
-- ALTER TABLE blocks ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE;
-- ALTER TABLE analytics_snapshots ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE;
-- CREATE INDEX IF NOT EXISTS idx_blocks_org ON blocks(organization_id);
-- CREATE INDEX IF NOT EXISTS idx_analytics_org ON analytics_snapshots(organization_id);

-- Row Level Security Policies

-- Organizations: Users can see orgs they're members of
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;

-- SELECT: Users can view organizations they're members of
DROP POLICY IF EXISTS "Users can view their organizations" ON organizations;
CREATE POLICY "Users can view their organizations"
ON organizations FOR SELECT
USING (
  id IN (
    SELECT organization_id 
    FROM organization_members 
    WHERE user_id = auth.uid()
  )
);

-- INSERT: Authenticated users can create organizations
DROP POLICY IF EXISTS "Users can create organizations" ON organizations;
CREATE POLICY "Users can create organizations"
ON organizations FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() IS NOT NULL 
  AND created_by = auth.uid()
);

-- SELECT: Users can also view organizations they created (before membership is added)
DROP POLICY IF EXISTS "Users can view organizations they created" ON organizations;
CREATE POLICY "Users can view organizations they created"
ON organizations FOR SELECT
TO authenticated
USING (created_by = auth.uid());

-- UPDATE: Owners and admins can update their organizations
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

-- DELETE: Only owners can delete organizations
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

-- Organization Members: Users can see members of their orgs
ALTER TABLE organization_members ENABLE ROW LEVEL SECURITY;

-- Create a security definer function that bypasses RLS
-- This function runs with postgres privileges and can query without triggering RLS
CREATE OR REPLACE FUNCTION check_user_org_membership(org_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
DECLARE
  current_user_id UUID;
BEGIN
  -- Get the current user ID
  current_user_id := auth.uid();
  
  -- If no user, return false
  IF current_user_id IS NULL THEN
    RETURN FALSE;
  END IF;
  
  -- Check membership directly (bypasses RLS due to SECURITY DEFINER)
  RETURN EXISTS (
    SELECT 1 
    FROM organization_members 
    WHERE organization_id = org_id 
    AND user_id = current_user_id
  );
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION check_user_org_membership(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION check_user_org_membership(UUID) TO anon;

-- Policy: Users can see their own membership records directly (no recursion)
DROP POLICY IF EXISTS "Users can view their own memberships" ON organization_members;
CREATE POLICY "Users can view their own memberships"
ON organization_members FOR SELECT
USING (user_id = auth.uid());

-- Policy: Users can see members of organizations they belong to
-- Uses the security definer function to avoid recursion
DROP POLICY IF EXISTS "Users can view members of their organizations" ON organization_members;
CREATE POLICY "Users can view members of their organizations"
ON organization_members FOR SELECT
USING (check_user_org_membership(organization_id));

-- INSERT: Users can be added to organizations (for joining via invitation)
-- Also allow owners/admins to add members
DROP POLICY IF EXISTS "Users can be added to organizations" ON organization_members;
CREATE POLICY "Users can be added to organizations"
ON organization_members FOR INSERT
WITH CHECK (
  -- User can add themselves (for joining via invitation)
  user_id = auth.uid()
  OR
  -- Or user is owner/admin adding someone else
  check_user_org_membership(organization_id) 
  AND EXISTS (
    SELECT 1 FROM organization_members
    WHERE organization_id = organization_members.organization_id
    AND user_id = auth.uid()
    AND role IN ('owner', 'admin')
  )
);

-- UPDATE: Owners/admins can update member roles
DROP POLICY IF EXISTS "Owners and admins can update members" ON organization_members;
CREATE POLICY "Owners and admins can update members"
ON organization_members FOR UPDATE
USING (
  check_user_org_membership(organization_id)
  AND EXISTS (
    SELECT 1 FROM organization_members
    WHERE organization_id = organization_members.organization_id
    AND user_id = auth.uid()
    AND role IN ('owner', 'admin')
  )
)
WITH CHECK (
  check_user_org_membership(organization_id)
  AND EXISTS (
    SELECT 1 FROM organization_members
    WHERE organization_id = organization_members.organization_id
    AND user_id = auth.uid()
    AND role IN ('owner', 'admin')
  )
);

-- DELETE: Owners/admins can remove members, users can leave
DROP POLICY IF EXISTS "Users can leave or be removed from organizations" ON organization_members;
CREATE POLICY "Users can leave or be removed from organizations"
ON organization_members FOR DELETE
USING (
  -- User can remove themselves (leave)
  user_id = auth.uid()
  OR
  -- Or owner/admin can remove others
  (
    check_user_org_membership(organization_id)
    AND EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_id = organization_members.organization_id
      AND user_id = auth.uid()
      AND role IN ('owner', 'admin')
    )
  )
);

-- Invitations: Admins can view invitations for their orgs
ALTER TABLE organization_invitations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can view invitations" ON organization_invitations;
CREATE POLICY "Admins can view invitations"
ON organization_invitations FOR SELECT
USING (
  organization_id IN (
    SELECT organization_id 
    FROM organization_members 
    WHERE user_id = auth.uid() 
    AND role IN ('owner', 'admin')
  )
);

-- Anyone can view pending invitations by code (for signup page)
DROP POLICY IF EXISTS "Anyone can view pending invitations by code" ON organization_invitations;
CREATE POLICY "Anyone can view pending invitations by code"
ON organization_invitations FOR SELECT
USING (status = 'pending');

-- INSERT: Owners/admins can create invitations
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

-- UPDATE: Owners/admins can update invitations
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

-- DELETE: Owners/admins can delete invitations
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

COMMENT ON TABLE organizations IS 'Multi-tenant organizations for workspace separation';
COMMENT ON TABLE organization_members IS 'Many-to-many relationship between users and organizations';
COMMENT ON TABLE organization_invitations IS 'Invitation codes and email-based invitations for joining organizations';
