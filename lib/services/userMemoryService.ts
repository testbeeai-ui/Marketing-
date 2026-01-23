import { supabase, isDatabaseAvailable } from '../db/client';

export interface UserMemory {
  id: string;
  user_id: number;
  memory_type: string;
  content: string;
  context_metadata?: Record<string, any>;
  created_at: string;
}

// Memory type constants matching demi.md
export const MEMORY_TYPES = {
  // Story styles
  LIKED_STORY_STYLE_PROFESSIONAL: 'liked_story_style_professional',
  LIKED_STORY_STYLE_VIRAL: 'liked_story_style_viral',
  LIKED_STORY_STYLE_STORYTELLER: 'liked_story_style_storyteller',
  DISLIKED_STORY_STYLE_PROFESSIONAL: 'disliked_story_style_professional',
  DISLIKED_STORY_STYLE_VIRAL: 'disliked_story_style_viral',
  DISLIKED_STORY_STYLE_STORYTELLER: 'disliked_story_style_storyteller',

  // Platform captions
  LIKED_CAPTION_STYLE_LINKEDIN: 'liked_caption_style_linkedin',
  LIKED_CAPTION_STYLE_TWITTER: 'liked_caption_style_twitter',
  LIKED_CAPTION_STYLE_INSTAGRAM: 'liked_caption_style_instagram',
  LIKED_CAPTION_STYLE_FACEBOOK: 'liked_caption_style_facebook',
  DISLIKED_CAPTION_STYLE_LINKEDIN: 'disliked_caption_style_linkedin',
  DISLIKED_CAPTION_STYLE_TWITTER: 'disliked_caption_style_twitter',
  DISLIKED_CAPTION_STYLE_INSTAGRAM: 'disliked_caption_style_instagram',
  DISLIKED_CAPTION_STYLE_FACEBOOK: 'disliked_caption_style_facebook',

  // Platform-specific image styles
  LIKED_IMAGE_STYLE: 'liked_image_style',
  DISLIKED_IMAGE_STYLE: 'disliked_image_style',
  LIKED_IMAGE_STYLE_LINKEDIN: 'liked_image_style_linkedin',
  LIKED_IMAGE_STYLE_TWITTER: 'liked_image_style_twitter',
  LIKED_IMAGE_STYLE_INSTAGRAM: 'liked_image_style_instagram',
  LIKED_IMAGE_STYLE_FACEBOOK: 'liked_image_style_facebook',
  DISLIKED_IMAGE_STYLE_LINKEDIN: 'disliked_image_style_linkedin',
  DISLIKED_IMAGE_STYLE_TWITTER: 'disliked_image_style_twitter',
  DISLIKED_IMAGE_STYLE_INSTAGRAM: 'disliked_image_style_instagram',
  DISLIKED_IMAGE_STYLE_FACEBOOK: 'disliked_image_style_facebook',

  // User style edits (strongest signal)
  USER_EDIT_CAPTION: 'user_edit_caption',
  USER_EDIT_IMAGE_PROMPT: 'user_edit_image_prompt',
} as const;

// Storage limits - 36 interactions per type as requested
const MEMORY_LIMIT = 36;

export const MAX_MEMORIES_PER_TYPE: Record<string, number> = {
  [MEMORY_TYPES.LIKED_STORY_STYLE_PROFESSIONAL]: MEMORY_LIMIT,
  [MEMORY_TYPES.LIKED_STORY_STYLE_VIRAL]: MEMORY_LIMIT,
  [MEMORY_TYPES.LIKED_STORY_STYLE_STORYTELLER]: MEMORY_LIMIT,
  [MEMORY_TYPES.DISLIKED_STORY_STYLE_PROFESSIONAL]: MEMORY_LIMIT,
  [MEMORY_TYPES.DISLIKED_STORY_STYLE_VIRAL]: MEMORY_LIMIT,
  [MEMORY_TYPES.DISLIKED_STORY_STYLE_STORYTELLER]: MEMORY_LIMIT,
  [MEMORY_TYPES.LIKED_CAPTION_STYLE_LINKEDIN]: MEMORY_LIMIT,
  [MEMORY_TYPES.LIKED_CAPTION_STYLE_TWITTER]: MEMORY_LIMIT,
  [MEMORY_TYPES.LIKED_CAPTION_STYLE_INSTAGRAM]: MEMORY_LIMIT,
  [MEMORY_TYPES.LIKED_CAPTION_STYLE_FACEBOOK]: MEMORY_LIMIT,
  [MEMORY_TYPES.DISLIKED_CAPTION_STYLE_LINKEDIN]: MEMORY_LIMIT,
  [MEMORY_TYPES.DISLIKED_CAPTION_STYLE_TWITTER]: MEMORY_LIMIT,
  [MEMORY_TYPES.DISLIKED_CAPTION_STYLE_INSTAGRAM]: MEMORY_LIMIT,
  [MEMORY_TYPES.DISLIKED_CAPTION_STYLE_FACEBOOK]: MEMORY_LIMIT,
  [MEMORY_TYPES.LIKED_IMAGE_STYLE]: MEMORY_LIMIT,
  [MEMORY_TYPES.DISLIKED_IMAGE_STYLE]: MEMORY_LIMIT,
  [MEMORY_TYPES.LIKED_IMAGE_STYLE_LINKEDIN]: MEMORY_LIMIT,
  [MEMORY_TYPES.LIKED_IMAGE_STYLE_TWITTER]: MEMORY_LIMIT,
  [MEMORY_TYPES.LIKED_IMAGE_STYLE_INSTAGRAM]: MEMORY_LIMIT,
  [MEMORY_TYPES.LIKED_IMAGE_STYLE_FACEBOOK]: MEMORY_LIMIT,
  [MEMORY_TYPES.DISLIKED_IMAGE_STYLE_LINKEDIN]: MEMORY_LIMIT,
  [MEMORY_TYPES.DISLIKED_IMAGE_STYLE_TWITTER]: MEMORY_LIMIT,
  [MEMORY_TYPES.DISLIKED_IMAGE_STYLE_INSTAGRAM]: MEMORY_LIMIT,
  [MEMORY_TYPES.DISLIKED_IMAGE_STYLE_FACEBOOK]: MEMORY_LIMIT,
  [MEMORY_TYPES.USER_EDIT_CAPTION]: MEMORY_LIMIT,
  [MEMORY_TYPES.USER_EDIT_IMAGE_PROMPT]: MEMORY_LIMIT,
};

// Retrieval limits
export const DEFAULT_RETRIEVAL_LIMITS: Record<string, number> = {
  liked_story_style: 15,
  disliked_story_style: 12,
  liked_caption_style: 15,
  disliked_caption_style: 12,
  liked_image_style: 15,
  disliked_image_style: 12,
};

export class UserMemoryService {
  /**
   * Add a memory with automatic cleanup
   */
  async addMemory(
    userId: number,
    memoryType: string,
    content: string,
    contextMetadata?: Record<string, any>
  ): Promise<UserMemory> {
    if (!isDatabaseAvailable()) {
      // Fallback mode: log but don't persist
      console.log(`[UserMemoryService] Database not available, memory not persisted: ${memoryType} for user ${userId}`);
      return {
        id: `fallback-${Date.now()}`,
        user_id: userId,
        memory_type: memoryType,
        content,
        context_metadata: contextMetadata || {},
        created_at: new Date().toISOString(),
      };
    }

    // Insert new memory
    const { data: newMemory, error: insertError } = await supabase!
      .from('user_memories')
      .insert({
        user_id: userId,
        memory_type: memoryType,
        content,
        context_metadata: contextMetadata || {},
      })
      .select()
      .single();

    if (insertError) {
      // Handle gracefully - log but don't crash
      console.warn(`[UserMemoryService] Could not save memory (${memoryType}): ${insertError.message}`);
      // Return a fallback memory object
      return {
        id: `fallback-${Date.now()}`,
        user_id: userId,
        memory_type: memoryType,
        content,
        context_metadata: contextMetadata || {},
        created_at: new Date().toISOString(),
      };
    }

    // Check if limit exceeded and cleanup
    const maxLimit = MAX_MEMORIES_PER_TYPE[memoryType];
    if (maxLimit) {
      await this.cleanupOldMemories(userId, memoryType, maxLimit);
    }

    return newMemory as UserMemory;
  }

  /**
   * Get memories by type with limit
   */
  async getMemories(
    userId: number,
    memoryType: string,
    limit: number = 15
  ): Promise<UserMemory[]> {
    if (!isDatabaseAvailable()) {
      return []; // Return empty array if DB not available
    }

    const { data, error } = await supabase!
      .from('user_memories')
      .select('*')
      .eq('user_id', userId)
      .eq('memory_type', memoryType)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error(`Failed to get memories: ${error.message}`);
      return [];
    }

    return (data || []) as UserMemory[];
  }

  /**
   * Get liked styles (for stories, captions, or images)
   */
  async getLikedStyles(
    userId: number,
    contentType: 'story' | 'caption' | 'image',
    platform?: string,
    limit: number = 15
  ): Promise<UserMemory[]> {
    let memoryType: string;

    if (contentType === 'story') {
      // Get all liked story styles
      const professional = await this.getMemories(userId, MEMORY_TYPES.LIKED_STORY_STYLE_PROFESSIONAL, limit);
      const viral = await this.getMemories(userId, MEMORY_TYPES.LIKED_STORY_STYLE_VIRAL, limit);
      const storyteller = await this.getMemories(userId, MEMORY_TYPES.LIKED_STORY_STYLE_STORYTELLER, limit);
      return [...professional, ...viral, ...storyteller].slice(0, limit);
    } else if (contentType === 'caption' && platform) {
      const platformMap: Record<string, string> = {
        linkedin: MEMORY_TYPES.LIKED_CAPTION_STYLE_LINKEDIN,
        twitter: MEMORY_TYPES.LIKED_CAPTION_STYLE_TWITTER,
        instagram: MEMORY_TYPES.LIKED_CAPTION_STYLE_INSTAGRAM,
        facebook: MEMORY_TYPES.LIKED_CAPTION_STYLE_FACEBOOK,
      };
      memoryType = platformMap[platform.toLowerCase()];
      if (!memoryType) {
        return [];
      }
      return await this.getMemories(userId, memoryType, limit);
    } else if (contentType === 'image') {
      return await this.getMemories(userId, MEMORY_TYPES.LIKED_IMAGE_STYLE, limit);
    }

    return [];
  }

  /**
   * Get disliked styles
   */
  async getDislikedStyles(
    userId: number,
    contentType: 'story' | 'caption' | 'image',
    platform?: string,
    limit: number = 12
  ): Promise<UserMemory[]> {
    let memoryType: string;

    if (contentType === 'story') {
      // Get all disliked story styles
      const professional = await this.getMemories(userId, MEMORY_TYPES.DISLIKED_STORY_STYLE_PROFESSIONAL, limit);
      const viral = await this.getMemories(userId, MEMORY_TYPES.DISLIKED_STORY_STYLE_VIRAL, limit);
      const storyteller = await this.getMemories(userId, MEMORY_TYPES.DISLIKED_STORY_STYLE_STORYTELLER, limit);
      return [...professional, ...viral, ...storyteller].slice(0, limit);
    } else if (contentType === 'caption' && platform) {
      const platformMap: Record<string, string> = {
        linkedin: MEMORY_TYPES.DISLIKED_CAPTION_STYLE_LINKEDIN,
        twitter: MEMORY_TYPES.DISLIKED_CAPTION_STYLE_TWITTER,
        instagram: MEMORY_TYPES.DISLIKED_CAPTION_STYLE_INSTAGRAM,
        facebook: MEMORY_TYPES.DISLIKED_CAPTION_STYLE_FACEBOOK,
      };
      memoryType = platformMap[platform.toLowerCase()];
      if (!memoryType) {
        return [];
      }
      return await this.getMemories(userId, memoryType, limit);
    } else if (contentType === 'image') {
      return await this.getMemories(userId, MEMORY_TYPES.DISLIKED_IMAGE_STYLE, limit);
    }

    return [];
  }

  /**
   * Cleanup old memories when limit exceeded
   */
  private async cleanupOldMemories(
    userId: number,
    memoryType: string,
    maxLimit: number
  ): Promise<void> {
    if (!isDatabaseAvailable()) {
      return;
    }

    // Get all memories of this type, ordered by created_at DESC
    const { data: allMemories, error: fetchError } = await supabase!
      .from('user_memories')
      .select('id')
      .eq('user_id', userId)
      .eq('memory_type', memoryType)
      .order('created_at', { ascending: false });

    if (fetchError || !allMemories) {
      return;
    }

    // If we have more than maxLimit, delete the oldest ones
    if (allMemories.length > maxLimit) {
      const memoriesToDelete = allMemories.slice(maxLimit);
      const idsToDelete = memoriesToDelete.map(m => m.id);

      await supabase!
        .from('user_memories')
        .delete()
        .in('id', idsToDelete);
    }
  }

  /**
   * Delete a memory by ID
   */
  async deleteMemory(memoryId: string): Promise<void> {
    if (!isDatabaseAvailable()) {
      return;
    }

    await supabase!
      .from('user_memories')
      .delete()
      .eq('id', memoryId);
  }
}

export const userMemoryService = new UserMemoryService();
