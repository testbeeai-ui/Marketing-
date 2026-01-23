import { supabase, isDatabaseAvailable } from '../db/client';

export interface UserProfile {
  user_id: string; // Changed from number to string to match UUID
  username?: string;
  first_name?: string;
  last_name?: string;
  style_preferences?: string;
  brand_voice?: string;
  linkedin_voice?: string;
  twitter_voice?: string;
  instagram_voice?: string;
  facebook_voice?: string;
  onboarding_completed: boolean;
  preferred_emoji_usage?: 'minimal' | 'moderate' | 'heavy';
  preferred_formality?: 'formal' | 'casual' | 'mixed';
  created_at?: string;
  updated_at?: string;
}

export class UserProfileService {
  /**
   * Get or create user profile
   */
  async getOrCreateUser(userId: string): Promise<UserProfile> {
    if (!isDatabaseAvailable()) {
      // Fallback mode: return a basic profile without database
      console.log(`[UserProfileService] Database not available, using fallback mode for user ${userId}`);
      return {
        user_id: userId,
        onboarding_completed: false,
      } as UserProfile;
    }

    try {
      // Try to get existing profile
      const { data: existingProfile, error: fetchError } = await supabase!
        .from('user_profiles')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (existingProfile) {
        return existingProfile as UserProfile;
      }

      // If profile doesn't exist, try to create it
      // But handle schema errors gracefully
      try {
        const newProfile: Partial<UserProfile> = {
          user_id: userId,
          onboarding_completed: false,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };

        const { data: createdProfile, error: createError } = await supabase!
          .from('user_profiles')
          .insert(newProfile)
          .select()
          .single();

        if (createError) {
          console.warn(`[UserProfileService] Could not create profile: ${createError.message}`);
          return {
            user_id: userId,
            onboarding_completed: false,
          } as UserProfile;
        }

        return createdProfile as UserProfile;
      } catch (createError) {
        console.warn(`[UserProfileService] Profile creation failed: ${createError}`);
        return {
          user_id: userId,
          onboarding_completed: false,
        } as UserProfile;
      }
    } catch (error) {
      console.warn(`[UserProfileService] Profile fetch failed: ${error}`);
      return {
        user_id: userId,
        onboarding_completed: false,
      } as UserProfile;
    }
  }

  /**
   * Get user profile
   */
  async getUserProfile(userId: string): Promise<UserProfile | null> {
    if (!isDatabaseAvailable()) {
      console.log(`[UserProfileService] Database not available, returning null for user ${userId}`);
      return null;
    }

    try {
      const { data, error } = await supabase!
        .from('user_profiles')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (error) {
        console.warn(`[UserProfileService] Could not fetch profile: ${error.message}`);
        return null;
      }

      return data as UserProfile;
    } catch (error) {
      console.warn(`[UserProfileService] Profile fetch failed: ${error}`);
      return null;
    }
  }

  /**
   * Update user profile
   */
  async updateUserProfile(userId: string, updates: Partial<UserProfile>): Promise<UserProfile> {
    if (!isDatabaseAvailable()) {
      console.log(`[UserProfileService] Database not available, returning fallback for user ${userId}`);
      return {
        user_id: userId,
        onboarding_completed: false,
        ...updates,
      } as UserProfile;
    }

    try {
      const { data, error } = await supabase!
        .from('user_profiles')
        .update({
          ...updates,
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', userId)
        .select()
        .single();

      if (error) {
        console.warn(`[UserProfileService] Could not update profile: ${error.message}`);
        return {
          user_id: userId,
          onboarding_completed: false,
          ...updates,
        } as UserProfile;
      }

      return data as UserProfile;
    } catch (error) {
      console.warn(`[UserProfileService] Profile update failed: ${error}`);
      return {
        user_id: userId,
        onboarding_completed: false,
        ...updates,
      } as UserProfile;
    }
  }

  /**
   * Complete onboarding for a user
   */
  async completeOnboarding(userId: string): Promise<void> {
    await this.updateUserProfile(userId, {
      onboarding_completed: true,
    });
  }
}

export const userProfileService = new UserProfileService();