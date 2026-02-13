# Database Migration Guide

## Organization-Scoped Data Isolation Migrations

This guide will help you apply the database migrations required for organization-scoped data isolation.

## Prerequisites

- Access to Supabase Dashboard
- SQL Editor access in Supabase

## Migration Files

The following migrations need to be run in order:

1. **20250212000006_add_organization_id_to_tables.sql** - Adds `organization_id` columns to all tables
2. **20250212000007_migrate_existing_data_to_orgs.sql** - Migrates existing data to default organizations
3. **20250212000008_update_rls_for_orgs.sql** - Updates RLS policies for organization-based access

## Step-by-Step Instructions

### Option 1: Using Supabase Dashboard (Recommended)

1. **Open Supabase Dashboard**
   - Go to your project dashboard
   - Navigate to **SQL Editor**

2. **Run Migration 1: Add organization_id columns**
   - Open `supabase/migrations/20250212000006_add_organization_id_to_tables.sql`
   - Copy the entire contents
   - Paste into SQL Editor
   - Click **Run** or press `Ctrl+Enter` (Windows) / `Cmd+Enter` (Mac)
   - Wait for success message

3. **Run Migration 2: Migrate existing data**
   - Open `supabase/migrations/20250212000007_migrate_existing_data_to_orgs.sql`
   - Copy the entire contents
   - Paste into SQL Editor
   - Click **Run**
   - This may take a few moments if you have existing data

4. **Run Migration 3: Update RLS policies**
   - Open `supabase/migrations/20250212000008_update_rls_for_orgs.sql`
   - Copy the entire contents
   - Paste into SQL Editor
   - Click **Run**

5. **Refresh Schema Cache**
   - Go to **Settings** > **API**
   - Click **Refresh Schema Cache** or wait a few minutes for automatic refresh
   - Alternatively, restart your Supabase project

### Option 2: Using Supabase CLI

If you have Supabase CLI installed:

```bash
# Navigate to project directory
cd "c:\Users\Michael\Documents\RDM Projects\All Marketing\Marketing"

# Link to your Supabase project (if not already linked)
supabase link --project-ref your-project-ref

# Push migrations
supabase db push
```

### Option 3: Manual SQL Execution

If you prefer to run migrations manually:

1. Connect to your Supabase database using any PostgreSQL client
2. Run each migration file in order
3. Verify columns exist:
   ```sql
   SELECT column_name 
   FROM information_schema.columns 
   WHERE table_name = 'blocks' AND column_name = 'organization_id';
   ```

## Verification

After running migrations, verify they were applied:

```sql
-- Check if organization_id column exists in blocks table
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'blocks' AND column_name = 'organization_id';

-- Check if default organizations were created
SELECT id, name, created_by 
FROM organizations 
ORDER BY created_at;

-- Check if data was migrated
SELECT COUNT(*) as total_blocks, 
       COUNT(DISTINCT organization_id) as organizations_with_blocks
FROM blocks;
```

## Troubleshooting

### Error: "Could not find the 'organization_id' column"

**Cause**: Migration hasn't been run or schema cache needs refresh.

**Solution**:
1. Verify migrations were run successfully
2. Refresh schema cache in Supabase Dashboard
3. Wait 2-3 minutes for cache to refresh automatically
4. Restart your application

### Error: "new row violates row-level security policy"

**Cause**: RLS policies haven't been updated.

**Solution**: Run migration `20250212000008_update_rls_for_orgs.sql`

### Error: "organization_id cannot be null"

**Cause**: Migration 2 (data migration) hasn't been run.

**Solution**: Run migration `20250212000007_migrate_existing_data_to_orgs.sql`

### Schema Cache Not Refreshing

If schema cache doesn't refresh automatically:

1. Go to Supabase Dashboard > Settings > API
2. Click "Refresh Schema Cache"
3. Wait 1-2 minutes
4. Restart your Next.js development server

## Post-Migration Checklist

- [ ] All three migrations run successfully
- [ ] Schema cache refreshed
- [ ] Can create blocks with organization_id
- [ ] Can query blocks filtered by organization_id
- [ ] Existing data migrated to default organizations
- [ ] RLS policies working correctly

## Need Help?

If you encounter issues:

1. Check Supabase Dashboard > Logs for detailed error messages
2. Verify your database connection
3. Ensure you have proper permissions
4. Check that all prerequisite migrations have been run
