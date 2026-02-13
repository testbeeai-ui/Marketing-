-- Content Approvals Table
-- Stores approval requests for platform content (text and images) sent from admins to members

CREATE TABLE IF NOT EXISTS content_approvals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  sub_block_id TEXT REFERENCES sub_blocks(id) ON DELETE CASCADE,
  story_id TEXT, -- Reference to story variation
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  assigned_to UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Content data
  platform_contents JSONB NOT NULL, -- { linkedin: { text: "...", imageUrl: "...", imagePrompt: "..." }, ... }
  content_type TEXT NOT NULL CHECK (content_type IN ('text', 'image', 'both')),
  platforms TEXT[] NOT NULL, -- ['linkedin', 'twitter', 'instagram', 'facebook']
  
  -- Approval workflow
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'changes_requested', 'rejected')),
  changes_requested TEXT, -- Feedback from member
  approved_at TIMESTAMPTZ,
  approved_by UUID REFERENCES auth.users(id),
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_content_approvals_org ON content_approvals(organization_id);
CREATE INDEX IF NOT EXISTS idx_content_approvals_assigned_to ON content_approvals(assigned_to);
CREATE INDEX IF NOT EXISTS idx_content_approvals_status ON content_approvals(status);
CREATE INDEX IF NOT EXISTS idx_content_approvals_created_by ON content_approvals(created_by);
CREATE INDEX IF NOT EXISTS idx_content_approvals_sub_block ON content_approvals(sub_block_id);

-- Add updated_at trigger (only if function exists)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'update_updated_at_column') THEN
    CREATE TRIGGER update_content_approvals_updated_at 
      BEFORE UPDATE ON content_approvals
      FOR EACH ROW 
      EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;

-- RLS Policies
ALTER TABLE content_approvals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view approvals in their organizations"
  ON content_approvals FOR SELECT
  USING (check_user_org_membership(organization_id));

CREATE POLICY "Admins can create approvals"
  ON content_approvals FOR INSERT
  WITH CHECK (
    check_user_org_membership(organization_id) AND
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_id = content_approvals.organization_id
      AND user_id = auth.uid()
      AND role IN ('owner', 'admin')
    )
  );

CREATE POLICY "Assigned members can update approvals"
  ON content_approvals FOR UPDATE
  USING (
    check_user_org_membership(organization_id) AND
    (assigned_to = auth.uid() OR created_by = auth.uid())
  )
  WITH CHECK (
    check_user_org_membership(organization_id) AND
    (assigned_to = auth.uid() OR created_by = auth.uid())
  );
