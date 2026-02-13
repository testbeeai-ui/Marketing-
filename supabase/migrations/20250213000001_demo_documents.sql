-- Seed demo documents for the Marketing block so demo users see "4 files" and can explore the block
INSERT INTO documents (id, block_id, file_name, content, file_size, status, uploaded_at, organization_id)
VALUES
  (
    'demo-doc-1',
    'demo-block-marketing',
    'Marketing_Strategy_Overview.pdf',
    'Sample marketing strategy and best practices for social media. This is demo content visible to all demo users.',
    12400,
    'ready',
    NOW() - INTERVAL '1 day',
    '00000000-0000-0000-0000-000000000000'
  ),
  (
    'demo-doc-2',
    'demo-block-marketing',
    'Content_Calendar_Template.pdf',
    'Content calendar template for planning posts across LinkedIn, X, Instagram, and Facebook.',
    8200,
    'ready',
    NOW() - INTERVAL '1 day',
    '00000000-0000-0000-0000-000000000000'
  ),
  (
    'demo-doc-3',
    'demo-block-marketing',
    'Brand_Voice_Guide.pdf',
    'Brand voice and tone guidelines for consistent messaging.',
    5600,
    'ready',
    NOW() - INTERVAL '1 day',
    '00000000-0000-0000-0000-000000000000'
  ),
  (
    'demo-doc-4',
    'demo-block-marketing',
    'Platform_Best_Practices.pdf',
    'Platform-specific best practices and algorithm tips.',
    15200,
    'ready',
    NOW() - INTERVAL '1 day',
    '00000000-0000-0000-0000-000000000000'
  )
ON CONFLICT (id) DO NOTHING;
