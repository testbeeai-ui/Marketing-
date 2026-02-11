-- StoryTeller: analytics_snapshots table for screenshot-based analytics
CREATE TABLE IF NOT EXISTS analytics_snapshots (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id TEXT NOT NULL,
  platform VARCHAR(20) NOT NULL,
  image_url TEXT NOT NULL,
  extracted_data JSONB,
  ai_insights JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_analytics_snapshots_user_id ON analytics_snapshots(user_id);
CREATE INDEX idx_analytics_snapshots_platform ON analytics_snapshots(platform);
CREATE INDEX idx_analytics_snapshots_created ON analytics_snapshots(created_at DESC);

-- RLS policies for analytics_snapshots
ALTER TABLE analytics_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own analytics_snapshots"
  ON analytics_snapshots FOR SELECT
  USING (auth.uid()::text = user_id);

CREATE POLICY "Users can insert own analytics_snapshots"
  ON analytics_snapshots FOR INSERT
  WITH CHECK (auth.uid()::text = user_id);

CREATE POLICY "Users can delete own analytics_snapshots"
  ON analytics_snapshots FOR DELETE
  USING (auth.uid()::text = user_id);

-- Create storage bucket for analytics screenshots (if not exists)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'analytics-screenshots',
  'analytics-screenshots',
  false,
  10485760,
  ARRAY['image/jpeg', 'image/png', 'image/webp']::text[]
)
ON CONFLICT (id) DO NOTHING;

-- RLS policies for storage.objects in analytics-screenshots bucket
CREATE POLICY "Users can upload own analytics screenshots"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'analytics-screenshots'
    AND auth.role() = 'authenticated'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Users can read own analytics screenshots"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'analytics-screenshots'
    AND auth.role() = 'authenticated'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Users can delete own analytics screenshots"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'analytics-screenshots'
    AND auth.role() = 'authenticated'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );
