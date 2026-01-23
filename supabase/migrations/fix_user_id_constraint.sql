-- Remove foreign key constraint from blocks table
ALTER TABLE blocks DROP CONSTRAINT IF EXISTS blocks_user_id_fkey;

-- Update user_id column to accept UUID strings instead of bigint
ALTER TABLE blocks 
ALTER COLUMN user_id TYPE text USING user_id::text;