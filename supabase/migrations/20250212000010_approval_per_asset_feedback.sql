-- Per-asset change requests for content approvals
-- Shape: { "linkedin": { "text": "...", "image": "..." }, "facebook": { "text": "...", "image": "..." } }

ALTER TABLE content_approvals
ADD COLUMN IF NOT EXISTS changes_requested_per_asset JSONB DEFAULT NULL;

COMMENT ON COLUMN content_approvals.changes_requested_per_asset IS 'Feedback per platform and asset type: { platformId: { text?: string, image?: string } }';
