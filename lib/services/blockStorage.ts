import { supabase } from '../db/client';
import { SupabaseClient } from '@supabase/supabase-js';

export interface Block {
  id: string;
  userId: string; // Changed from number to string to match UUID
  name: string;
  description: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * Persistent block storage using Supabase
 */
export class BlockStorage {

  private getDb(client?: SupabaseClient) {
    if (client) return client;
    if (!supabase) {
      throw new Error('Supabase client not initialized. Check environment variables.');
    }
    return supabase;
  }

  async ensureLoaded(): Promise<void> {
    // No-op for DB storage, kept for API compatibility
    return Promise.resolve();
  }

  async getAll(client?: SupabaseClient): Promise<Block[]> {
    const { data, error } = await this.getDb(client)
      .from('blocks')
      .select('*');

    if (error) {
      console.error('Error fetching all blocks:', error);
      return [];
    }

    return (data || []).map(this.mapFromDb);
  }

  async getAllByUserId(userId: string, client?: SupabaseClient): Promise<Block[]> {
    console.log(`[BlockStorage] Querying blocks for user_id: ${userId}`);
    const { data, error } = await this.getDb(client)
      .from('blocks')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error(`Error fetching blocks for user ${userId}:`, error);
      return [];
    }

    console.log(`[BlockStorage] Retrieved ${data?.length || 0} blocks for user ${userId}`);
    return (data || []).map(this.mapFromDb);
  }

  async get(id: string, client?: SupabaseClient): Promise<Block | undefined> {
    const { data, error } = await this.getDb(client)
      .from('blocks')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      // Supabase returns an error if .single() finds no rows, which is expected sometimes
      if (error.code !== 'PGRST116') {
        console.error(`Error fetching block ${id}:`, error);
      }
      return undefined;
    }

    return this.mapFromDb(data);
  }

  async getByUserId(id: string, userId: string, client?: SupabaseClient): Promise<Block | undefined> {
    const { data, error } = await this.getDb(client)
      .from('blocks')
      .select('*')
      .eq('id', id)
      .eq('user_id', userId)
      .single();

    if (error) {
      if (error.code !== 'PGRST116') {
        console.error(`Error fetching block ${id} for user ${userId}:`, error);
      }
      return undefined;
    }

    return this.mapFromDb(data);
  }

  async create(block: Block, client?: SupabaseClient): Promise<Block> {
    const { error } = await this.getDb(client)
      .from('blocks')
      .insert({
        id: block.id,
        user_id: block.userId,
        name: block.name,
        description: block.description,
        created_at: block.createdAt,
        updated_at: block.updatedAt
      });

    if (error) {
      throw new Error(`Failed to create block: ${error.message}`);
    }

    return block;
  }

  async update(block: Block, client?: SupabaseClient): Promise<Block> {
    const { error } = await this.getDb(client)
      .from('blocks')
      .update({
        name: block.name,
        description: block.description,
        updated_at: new Date().toISOString()
      })
      .eq('id', block.id)
      .eq('user_id', block.userId);

    if (error) {
      throw new Error(`Failed to update block: ${error.message}`);
    }

    return {
      ...block,
      updatedAt: new Date().toISOString()
    };
  }

  async delete(id: string, client?: SupabaseClient): Promise<void> {
    const { error } = await this.getDb(client)
      .from('blocks')
      .delete()
      .eq('id', id);

    if (error) {
      console.error(`Failed to delete block ${id}:`, error);
      throw new Error(`Failed to delete block: ${error.message}`);
    }
  }

  async exists(id: string, client?: SupabaseClient): Promise<boolean> {
    const { count, error } = await this.getDb(client)
      .from('blocks')
      .select('*', { count: 'exact', head: true })
      .eq('id', id);

    if (error) {
      console.error(`Error checking existence of block ${id}:`, error);
      return false;
    }

    return (count || 0) > 0;
  }

  private mapFromDb(row: any): Block {
    return {
      id: row.id,
      userId: row.user_id,
      name: row.name,
      description: row.description,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }
}

export const blockStorage = new BlockStorage();