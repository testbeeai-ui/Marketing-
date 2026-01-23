import { supabase } from '../db/client';

export interface PlatformContent {
  platform: string;
  content: string;
  generatedAt: string;
}

export interface StoryVariation {
  id: string; // 'professional', 'viral', 'storyteller'
  title: string;
  content: string;
  selected: boolean;
  platformContents?: Record<string, string>;
}

export interface SubBlock {
  id: string;
  userId: number; // User ID that owns this sub-block
  blockId: string; // Parent block ID
  name: string; // User-provided name
  prompt: string; // Original user prompt/question
  storyVariations: StoryVariation[]; // All 3 format variations
  selectedVariationId?: string; // Which variation user selected
  platformContents?: Record<string, string>; // Generated platform formats
  createdAt: string;
  updatedAt: string;
}

/**
 * Persistent sub-block storage using Supabase
 */
export class SubBlockStorage {

  private get db() {
    if (!supabase) {
      throw new Error('Supabase client not initialized. Check environment variables.');
    }
    return supabase;
  }

  async ensureLoaded(): Promise<void> {
    return Promise.resolve();
  }

  /**
   * Get all sub-blocks for a block (filtered by userId)
   */
  async getByBlockId(blockId: string, userId: number): Promise<SubBlock[]> {
    const { data, error } = await this.db
      .from('sub_blocks')
      .select('*')
      .eq('block_id', blockId)
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error(`Error fetching sub-blocks for block ${blockId}:`, error);
      return [];
    }

    return (data || []).map(this.mapFromDb);
  }

  async getAllByBlockId(blockId: string, userId: number): Promise<SubBlock[]> {
    return this.getByBlockId(blockId, userId);
  }

  async getSubBlocksMetadataByBlockIds(blockIds: string[]): Promise<{ blockId: string }[]> {
    if (blockIds.length === 0) return [];

    const { data, error } = await this.db
      .from('sub_blocks')
      .select('block_id')
      .in('block_id', blockIds);

    if (error) {
      console.error('[SubBlockStorage] Error fetching sub-block metadata:', error);
      return [];
    }

    return (data || []).map((row: any) => ({
      blockId: row.block_id
    }));
  }

  /**
   * Get a sub-block by ID (check userId ownership)
   */
  async get(id: string): Promise<SubBlock | undefined> {
    // Note: This method signature explicitly asks for just ID, but to enforce security
    // effectively without userId, we might return it and let caller check.
    // However, existing code might expect it to return undefined if not found.
    // The previous implementation used in-memory map which didn't strictly filter by userId in get(id),
    // but typically the caller checks ownership.
    const { data, error } = await this.db
      .from('sub_blocks')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      if (error.code !== 'PGRST116') {
        console.error(`Error fetching sub-block ${id}:`, error);
      }
      return undefined;
    }

    return this.mapFromDb(data);
  }

  /**
   * Get a sub-block by ID and userId (ensures ownership)
   */
  async getByUserId(id: string, userId: number): Promise<SubBlock | undefined> {
    const { data, error } = await this.db
      .from('sub_blocks')
      .select('*')
      .eq('id', id)
      .eq('user_id', userId)
      .single();

    if (error) {
      if (error.code !== 'PGRST116') {
        console.error(`Error fetching sub-block ${id} for user ${userId}:`, error);
      }
      return undefined;
    }

    return this.mapFromDb(data);
  }

  /**
   * Create a new sub-block
   */
  async create(subBlock: Omit<SubBlock, 'id' | 'createdAt' | 'updatedAt'>): Promise<SubBlock> {
    const id = `sub_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    const now = new Date().toISOString();

    const newSubBlock: SubBlock = {
      ...subBlock,
      id,
      createdAt: now,
      updatedAt: now,
    };

    const { error } = await this.db
      .from('sub_blocks')
      .insert({
        id: newSubBlock.id,
        user_id: newSubBlock.userId,
        block_id: newSubBlock.blockId,
        name: newSubBlock.name,
        prompt: newSubBlock.prompt,
        story_variations: newSubBlock.storyVariations,
        selected_variation_id: newSubBlock.selectedVariationId,
        platform_contents: newSubBlock.platformContents,
        created_at: newSubBlock.createdAt,
        updated_at: newSubBlock.updatedAt,
      });

    if (error) {
      throw new Error(`Failed to create sub-block: ${error.message}`);
    }

    return newSubBlock;
  }

  /**
   * Update a sub-block
   */
  async update(id: string, updates: Partial<SubBlock>): Promise<SubBlock> {
    // We need to fetch existing to verify ownership ideally, but ID should be unique.
    // existing implementation threw error if not found.

    // Map updates to snake_case
    const dbUpdates: any = {
      updated_at: new Date().toISOString()
    };
    if (updates.name !== undefined) dbUpdates.name = updates.name;
    if (updates.prompt !== undefined) dbUpdates.prompt = updates.prompt;
    if (updates.storyVariations !== undefined) dbUpdates.story_variations = updates.storyVariations;
    if (updates.selectedVariationId !== undefined) dbUpdates.selected_variation_id = updates.selectedVariationId;
    if (updates.platformContents !== undefined) dbUpdates.platform_contents = updates.platformContents;

    const { data, error } = await this.db
      .from('sub_blocks')
      .update(dbUpdates)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to update sub-block ${id}: ${error.message}`);
    }

    if (!data) {
      throw new Error(`Sub-block ${id} not found`);
    }

    return this.mapFromDb(data);
  }

  /**
   * Delete a sub-block
   */
  async delete(id: string): Promise<void> {
    const { error } = await this.db
      .from('sub_blocks')
      .delete()
      .eq('id', id);

    if (error) {
      throw new Error(`Failed to delete sub-block ${id}: ${error.message}`);
    }
  }

  /**
   * Delete all sub-blocks for a block (when block is deleted) - filtered by userId
   */
  async deleteByBlockId(blockId: string, userId: number): Promise<void> {
    const { error } = await this.db
      .from('sub_blocks')
      .delete()
      .eq('block_id', blockId)
      .eq('user_id', userId);

    if (error) {
      console.error(`Failed to delete sub-blocks for block ${blockId}:`, error);
      // Don't throw, just log, as this is often part of cleanup
    }
  }

  private mapFromDb(row: any): SubBlock {
    return {
      id: row.id,
      userId: row.user_id,
      blockId: row.block_id,
      name: row.name,
      prompt: row.prompt,
      storyVariations: row.story_variations || [],
      selectedVariationId: row.selected_variation_id,
      platformContents: row.platform_contents,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }
}

export const subBlockStorage = new SubBlockStorage();
