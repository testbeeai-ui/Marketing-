-- Fix infinite recursion in organization_members RLS policy
-- Drop the problematic policy and recreate with a security definer function

-- Drop existing policy
DROP POLICY IF EXISTS "Users can view members of their organizations" ON organization_members;

-- Drop old function if exists
DROP FUNCTION IF EXISTS user_is_org_member(UUID);
DROP FUNCTION IF EXISTS check_user_org_membership(UUID, UUID);

-- Create a security definer function that bypasses RLS
-- This function runs with the privileges of the function creator (postgres)
-- and can query organization_members without triggering RLS policies
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

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION check_user_org_membership(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION check_user_org_membership(UUID) TO anon;

-- Recreate the policy using the security definer function
CREATE POLICY "Users can view members of their organizations"
ON organization_members FOR SELECT
USING (check_user_org_membership(organization_id));

-- Also allow users to see their own membership records directly (no recursion)
DROP POLICY IF EXISTS "Users can view their own memberships" ON organization_members;
CREATE POLICY "Users can view their own memberships"
ON organization_members FOR SELECT
USING (user_id = auth.uid());
