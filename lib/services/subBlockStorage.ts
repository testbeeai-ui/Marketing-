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
  userId: string; // Changed from number to string to match UUID
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

  private getDb() {
    if (!supabase) {
      throw new Error('Supabase client not initialized. Check environment variables.');
    }
    return supabase;
  }

  async ensureLoaded(): Promise<void> {
    // No-op for DB storage, kept for API compatibility
    return Promise.resolve();
  }

  async getAll(): Promise<SubBlock[]> {
    const { data, error } = await this.getDb()
      .from('sub_blocks')
      .select('*');

    if (error) {
      console.error('Error fetching all sub-blocks:', error);
      return [];
    }

    return (data || []).map(this.mapFromDb);
  }

  async getByBlockId(blockId: string, userId: string): Promise<SubBlock[]> {
    const { data, error } = await this.getDb()
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

  async getAllByBlockId(blockId: string, userId: string): Promise<SubBlock[]> {
    const { data, error } = await this.getDb()
      .from('sub_blocks')
      .select('*')
      .eq('block_id', blockId)
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error(`Error fetching all sub-blocks for block ${blockId}:`, error);
      return [];
    }

    return (data || []).map(this.mapFromDb);
  }

  async get(id: string): Promise<SubBlock | undefined> {
    const { data, error } = await this.getDb()
      .from('sub_blocks')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      // Supabase returns an error if .single() finds no rows, which is expected sometimes
      if (error.code !== 'PGRST116') {
        console.error(`Error fetching sub-block ${id}:`, error);
      }
      return undefined;
    }

    return this.mapFromDb(data);
  }

  async getByUserId(id: string, userId: string): Promise<SubBlock | undefined> {
    const { data, error } = await this.getDb()
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

  async create(subBlock: SubBlock): Promise<SubBlock> {
    // Get organization_id from parent block
    const { data: parentBlock, error: blockError } = await this.getDb()
      .from('blocks')
      .select('organization_id')
      .eq('id', subBlock.blockId)
      .single();

    if (blockError || !parentBlock) {
      throw new Error(`Failed to find parent block ${subBlock.blockId}: ${blockError?.message || 'Block not found'}`);
    }

    const { error } = await this.getDb()
      .from('sub_blocks')
      .insert({
        id: subBlock.id,
        user_id: subBlock.userId,
        block_id: subBlock.blockId,
        organization_id: parentBlock.organization_id,
        name: subBlock.name,
        prompt: subBlock.prompt,
        story_variations: subBlock.storyVariations,
        selected_variation_id: subBlock.selectedVariationId,
        platform_contents: subBlock.platformContents,
        created_at: subBlock.createdAt,
        updated_at: subBlock.updatedAt
      });

    if (error) {
      if (
        error.message?.includes('organization_id') ||
        error.message?.includes('schema cache') ||
        error.code === '42703'
      ) {
        throw new Error(
          `Database migration not applied: The 'organization_id' column is missing from the 'sub_blocks' table. ` +
          `Please run migration: 20250212000006_add_organization_id_to_tables.sql (see MIGRATION_GUIDE.md)`
        );
      }
      throw new Error(`Failed to create sub-block: ${error.message}`);
    }

    return subBlock;
  }

  async update(subBlock: SubBlock): Promise<SubBlock> {
    const { error } = await this.getDb()
      .from('sub_blocks')
      .update({
        name: subBlock.name,
        prompt: subBlock.prompt,
        story_variations: subBlock.storyVariations,
        selected_variation_id: subBlock.selectedVariationId,
        platform_contents: subBlock.platformContents,
        updated_at: new Date().toISOString()
      })
      .eq('id', subBlock.id)
      .eq('user_id', subBlock.userId);

    if (error) {
      throw new Error(`Failed to update sub-block: ${error.message}`);
    }

    return {
      ...subBlock,
      updatedAt: new Date().toISOString()
    };
  }

  async delete(id: string): Promise<void> {
    const { error } = await this.getDb()
      .from('sub_blocks')
      .delete()
      .eq('id', id);

    if (error) {
      console.error(`Failed to delete sub-block ${id}:`, error);
      throw new Error(`Failed to delete sub-block: ${error.message}`);
    }
  }

  async deleteByBlockId(blockId: string, userId: string): Promise<void> {
    const { error } = await this.getDb()
      .from('sub_blocks')
      .delete()
      .eq('block_id', blockId)
      .eq('user_id', userId);

    if (error) {
      console.error(`Failed to delete sub-blocks for block ${blockId}:`, error);
      throw new Error(`Failed to delete sub-blocks: ${error.message}`);
    }
  }

  async getSubBlocksMetadataByBlockIds(blockIds: string[]): Promise<{ id: string; blockId: string }[]> {
    if (blockIds.length === 0) return [];
    
    const { data, error } = await this.getDb()
      .from('sub_blocks')
      .select('id, block_id')
      .in('block_id', blockIds);

    if (error) {
      console.error(`Error fetching sub-block metadata for block IDs ${blockIds.join(', ')}:`, error);
      return [];
    }

    return (data || []).map(row => ({ id: row.id, blockId: row.block_id }));
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
      platformContents: row.platform_contents || {},
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }
}

export const subBlockStorage = new SubBlockStorage();