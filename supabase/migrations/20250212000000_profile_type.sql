-- Add profile_type to user_profiles for individual vs company (shared with user app)
ALTER TABLE user_profiles
ADD COLUMN IF NOT EXISTS profile_type VARCHAR(20) DEFAULT NULL;

COMMENT ON COLUMN user_profiles.profile_type IS 'individual or company; used by user app';
