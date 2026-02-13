-- Fix organizations INSERT policy to ensure it works correctly
-- This ensures authenticated users can create organizations

-- Drop existing INSERT policy if it exists
DROP POLICY IF EXISTS "Users can create organizations" ON organizations;

-- Create a simple, explicit INSERT policy
-- This allows any authenticated user to create an organization
CREATE POLICY "Users can create organizations"
ON organizations FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() IS NOT NULL 
  AND created_by = auth.uid()
);

-- Also ensure the SELECT policy allows viewing newly created orgs
-- Add a policy that allows users to see organizations they created
-- (even before they're added as members)
DROP POLICY IF EXISTS "Users can view organizations they created" ON organizations;
CREATE POLICY "Users can view organizations they created"
ON organizations FOR SELECT
TO authenticated
USING (created_by = auth.uid());

-- The existing "Users can view their organizations" policy will handle
-- viewing orgs where they're members, so this covers the creation case
