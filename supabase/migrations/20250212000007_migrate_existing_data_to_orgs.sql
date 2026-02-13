-- Migrate existing data to default organizations
-- Creates a default organization for each user with existing data and migrates all their data to it

DO $$
DECLARE
    user_record RECORD;
    default_org_id UUID;
    user_email TEXT;
    org_slug TEXT;
    org_name TEXT;
BEGIN
    -- Loop through all users who have blocks or analytics
    FOR user_record IN 
        SELECT DISTINCT user_id 
        FROM (
            SELECT user_id FROM blocks
            UNION
            SELECT user_id FROM analytics_snapshots WHERE user_id IS NOT NULL
            UNION
            SELECT user_id FROM sessions WHERE user_id IS NOT NULL
            UNION
            SELECT user_id FROM user_memories WHERE user_id IS NOT NULL
        ) AS users_with_data
        WHERE user_id IS NOT NULL
    LOOP
        -- Get user email from auth.users
        SELECT email INTO user_email 
        FROM auth.users 
        WHERE id::text = user_record.user_id;
        
        -- Skip if user doesn't exist in auth.users
        CONTINUE WHEN user_email IS NULL;
        
        -- Generate organization name and slug
        org_name := COALESCE(user_email, 'User') || '''s Organization';
        org_slug := LOWER(REGEXP_REPLACE(COALESCE(user_email, 'user'), '[^a-z0-9]+', '-', 'g')) || '-org-' || SUBSTRING(user_record.user_id, 1, 8);
        
        -- Check if default org already exists for this user
        SELECT id INTO default_org_id
        FROM organizations
        WHERE slug = org_slug
        LIMIT 1;
        
        -- Create default organization if it doesn't exist
        IF default_org_id IS NULL THEN
            INSERT INTO organizations (id, name, slug, description, created_by)
            VALUES (
                gen_random_uuid(),
                org_name,
                org_slug,
                'Default organization for existing data',
                user_record.user_id::UUID
            )
            RETURNING id INTO default_org_id;
            
            -- Add user as owner of their default organization
            INSERT INTO organization_members (organization_id, user_id, role)
            VALUES (default_org_id, user_record.user_id::UUID, 'owner')
            ON CONFLICT (organization_id, user_id) DO NOTHING;
        END IF;
        
        -- Migrate blocks to organization
        UPDATE blocks 
        SET organization_id = default_org_id
        WHERE user_id = user_record.user_id 
        AND organization_id IS NULL;
        
        -- Migrate sub_blocks to organization (through parent block)
        UPDATE sub_blocks sb
        SET organization_id = b.organization_id
        FROM blocks b
        WHERE sb.block_id = b.id
        AND sb.organization_id IS NULL
        AND b.organization_id IS NOT NULL;
        
        -- Migrate documents to organization (through parent block)
        UPDATE documents d
        SET organization_id = b.organization_id
        FROM blocks b
        WHERE d.block_id = b.id
        AND d.organization_id IS NULL
        AND b.organization_id IS NOT NULL;
        
        -- Migrate vector_chunks to organization (through parent block)
        UPDATE vector_chunks vc
        SET organization_id = b.organization_id
        FROM blocks b
        WHERE vc.block_id = b.id
        AND vc.organization_id IS NULL
        AND b.organization_id IS NOT NULL;
        
        -- Migrate analytics_snapshots to organization
        UPDATE analytics_snapshots 
        SET organization_id = default_org_id
        WHERE user_id = user_record.user_id 
        AND organization_id IS NULL;
        
        -- Migrate sessions to organization
        UPDATE sessions 
        SET organization_id = default_org_id
        WHERE user_id = user_record.user_id 
        AND organization_id IS NULL;
        
        -- Migrate user_memories to organization
        UPDATE user_memories 
        SET organization_id = default_org_id
        WHERE user_id = user_record.user_id 
        AND organization_id IS NULL;
        
        RAISE NOTICE 'Migrated data for user % to organization %', user_record.user_id, default_org_id;
    END LOOP;
END $$;

-- Now make organization_id NOT NULL for all tables
ALTER TABLE blocks 
ALTER COLUMN organization_id SET NOT NULL;

ALTER TABLE sub_blocks 
ALTER COLUMN organization_id SET NOT NULL;

ALTER TABLE documents 
ALTER COLUMN organization_id SET NOT NULL;

ALTER TABLE vector_chunks 
ALTER COLUMN organization_id SET NOT NULL;

ALTER TABLE analytics_snapshots 
ALTER COLUMN organization_id SET NOT NULL;

ALTER TABLE sessions 
ALTER COLUMN organization_id SET NOT NULL;

ALTER TABLE user_memories 
ALTER COLUMN organization_id SET NOT NULL;
