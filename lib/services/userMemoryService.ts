import { supabase, isDatabaseAvailable } from '../db/client';

export interface UserMemory {
  id: string;
  user_id: string; // Changed from number to string to match UUID
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

export class UserMemoryService {
  /**
   * Add a memory with automatic cleanup
   */
  async addMemory(
    userId: string, // Changed from number to string
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

    if (newMemory) {
      // Clean up old memories for this type
      await this.cleanupOldMemories(userId, memoryType);
    }

    return newMemory;
  }

  /**
   * Get memories by type for a user
   */
  async getMemoriesByType(userId: string, memoryType: string): Promise<UserMemory[]> {
    if (!isDatabaseAvailable()) {
      console.log(`[UserMemoryService] Database not available, returning empty memories for user ${userId}`);
      return [];
    }

    const { data, error } = await supabase!
      .from('user_memories')
      .select('*')
      .eq('user_id', userId)
      .eq('memory_type', memoryType)
      .order('created_at', { ascending: false })
      .limit(MEMORY_LIMIT);

    if (error) {
      console.warn(`[UserMemoryService] Could not fetch memories: ${error.message}`);
      return [];
    }

    return data || [];
  }

  /**
   * Get all memories for a user
   */
  async getAllMemories(userId: string): Promise<UserMemory[]> {
    if (!isDatabaseAvailable()) {
      console.log(`[UserMemoryService] Database not available, returning empty memories for user ${userId}`);
      return [];
    }

    const { data, error } = await supabase!
      .from('user_memories')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      console.warn(`[UserMemoryService] Could not fetch memories: ${error.message}`);
      return [];
    }

    return data || [];
  }

  /**
   * Get memories by multiple types
   */
  async getMemoriesByTypes(userId: string, memoryTypes: string[]): Promise<UserMemory[]> {
    if (!isDatabaseAvailable()) {
      console.log(`[UserMemoryService] Database not available, returning empty memories for user ${userId}`);
      return [];
    }

    const { data, error } = await supabase!
      .from('user_memories')
      .select('*')
      .eq('user_id', userId)
      .in('memory_type', memoryTypes)
      .order('created_at', { ascending: false });

    if (error) {
      console.warn(`[UserMemoryService] Could not fetch memories: ${error.message}`);
      return [];
    }

    return data || [];
  }

  /**
   * Delete a specific memory
   */
  async deleteMemory(userId: string, memoryId: string): Promise<boolean> {
    if (!isDatabaseAvailable()) {
      console.log(`[UserMemoryService] Database not available, cannot delete memory ${memoryId}`);
      return false;
    }

    const { error } = await supabase!
      .from('user_memories')
      .delete()
      .eq('id', memoryId)
      .eq('user_id', userId);

    if (error) {
      console.warn(`[UserMemoryService] Could not delete memory: ${error.message}`);
      return false;
    }

    return true;
  }

  /**
   * Clear all memories for a user
   */
  async clearAllMemories(userId: string): Promise<boolean> {
    if (!isDatabaseAvailable()) {
      console.log(`[UserMemoryService] Database not available, cannot clear memories for user ${userId}`);
      return false;
    }

    const { error } = await supabase!
      .from('user_memories')
      .delete()
      .eq('user_id', userId);

    if (error) {
      console.warn(`[UserMemoryService] Could not clear memories: ${error.message}`);
      return false;
    }

    return true;
  }

  /**
   * Clean up old memories to stay within the limit
   */
  private async cleanupOldMemories(userId: string, memoryType: string): Promise<void> {
    if (!isDatabaseAvailable()) return;

    // Get current count
    const { count, error: countError } = await supabase!
      .from('user_memories')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('memory_type', memoryType);

    if (countError || !count || count <= MEMORY_LIMIT) {
      return;
    }

    // Delete oldest memories to stay within limit
    const toDelete = count - MEMORY_LIMIT;
    
    const { error: deleteError } = await supabase!
      .from('user_memories')
      .delete()
      .eq('user_id', userId)
      .eq('memory_type', memoryType)
      .order('created_at', { ascending: true })
      .limit(toDelete);

    if (deleteError) {
      console.warn(`[UserMemoryService] Could not cleanup old memories: ${deleteError.message}`);
    }
  }

  /**
   * Get memory statistics for a user
   */
  async getMemoryStats(userId: string): Promise<{
    total: number;
    byType: Record<string, number>;
  }> {
    if (!isDatabaseAvailable()) {
      return { total: 0, byType: {} };
    }

    const { data, error } = await supabase!
      .from('user_memories')
      .select('memory_type')
      .eq('user_id', userId);

    if (error) {
      console.warn(`[UserMemoryService] Could not get memory stats: ${error.message}`);
      return { total: 0, byType: {} };
    }

    const stats = {
      total: data?.length || 0,
      byType: {} as Record<string, number>,
    };

    data?.forEach(memory => {
      stats.byType[memory.memory_type] = (stats.byType[memory.memory_type] || 0) + 1;
    });

    return stats;
  }
}

export const userMemoryService = new UserMemoryService();