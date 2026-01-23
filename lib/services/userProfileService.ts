import { supabase, isDatabaseAvailable } from '../db/client';

export interface UserProfile {
  user_id: number;
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
  async getOrCreateUser(userId: number): Promise<UserProfile> {
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
        };

        const { data: createdProfile, error: createError } = await supabase!
          .from('user_profiles')
          .insert(newProfile)
          .select()
          .single();

        if (createError) {
          console.warn(`[UserProfileService] Could not create profile: ${createError.message}`);
          // Return fallback profile
          return {
            user_id: userId,
            onboarding_completed: false,
          } as UserProfile;
        }

        return createdProfile as UserProfile;
      } catch (insertError) {
        console.warn(`[UserProfileService] Insert failed, using fallback:`, insertError);
        return {
          user_id: userId,
          onboarding_completed: false,
        } as UserProfile;
      }
    } catch (error) {
      console.warn(`[UserProfileService] Error getting profile, using fallback:`, error);
      return {
        user_id: userId,
        onboarding_completed: false,
      } as UserProfile;
    }
  }

  /**
   * Get user profile by ID
   */
  async getUserProfile(userId: number): Promise<UserProfile | null> {
    if (!isDatabaseAvailable()) {
      // Fallback mode: return null (will trigger onboarding)
      return null;
    }

    const { data, error } = await supabase!
      .from('user_profiles')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        // Not found
        return null;
      }
      throw new Error(`Failed to get user profile: ${error.message}`);
    }

    return data as UserProfile;
  }

  /**
   * Update user profile
   */
  async updateUserProfile(userId: number, updates: Partial<UserProfile>): Promise<UserProfile> {
    if (!isDatabaseAvailable()) {
      // Fallback mode: return updated profile without persisting
      console.log(`[UserProfileService] Database not available, profile update not persisted for user ${userId}`);
      return {
        user_id: userId,
        ...updates,
      } as UserProfile;
    }

    const { data, error } = await supabase!
      .from('user_profiles')
      .update(updates)
      .eq('user_id', userId)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to update user profile: ${error.message}`);
    }

    return data as UserProfile;
  }

  /**
   * Mark onboarding as completed
   */
  async completeOnboarding(userId: number): Promise<void> {
    await this.updateUserProfile(userId, { onboarding_completed: true });
  }
}

export const userProfileService = new UserProfileService();
