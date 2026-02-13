-- Allow public read access for demo images (images/demo/*).
-- Used by demo mode: pre-generated Gemini images at images/demo/{style}-{platform}.png
CREATE POLICY "Public read for demo images"
ON storage.objects
FOR SELECT
TO public
USING (
  bucket_id = 'images'
  AND (storage.foldername(name))[1] = 'demo'
);
