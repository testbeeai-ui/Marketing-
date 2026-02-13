import { EmbeddingService } from './embedding';
import { supabase } from '../db/client';

interface VectorChunk {
  id: string;
  userId: string; // Changed from number to string to match UUID
  blockId: string;
  fileId: string;
  text: string;
  embedding: number[];
  metadata: {
    fileName: string;
    chunkIndex: number;
  };
}

/**
 * Vector store using Supabase with pgvector for similarity search
 * Stores embeddings in Supabase database with optimized vector search
 */
export class VectorStore {
  private embeddingService: EmbeddingService;
  private readonly EMBEDDING_DIMENSION = 1536;

  constructor() {
    this.embeddingService = new EmbeddingService();
    if (!supabase) {
      console.warn('[VectorStore] Supabase client not initialized. Vector operations will fail.');
    } else {
      console.log('[VectorStore] Using Supabase with pgvector for vector storage');
    }
  }

  /**
   * Store a document chunk with its embedding
   */
  async storeChunk(
    id: string,
    userId: string, // Changed from number to string
    blockId: string,
    fileId: string,
    text: string,
    metadata: { fileName: string; chunkIndex: number }
  ): Promise<void> {
    if (!supabase) {
      throw new Error('Supabase client not initialized');
    }

    try {
      // Get organization_id from parent block
      const { data: parentBlock, error: blockError } = await supabase
        .from('blocks')
        .select('organization_id')
        .eq('id', blockId)
        .single();

      if (blockError || !parentBlock) {
        throw new Error(`Failed to find parent block ${blockId}: ${blockError?.message || 'Block not found'}`);
      }

      // Generate embedding for the text
      const embedding = await this.embeddingService.generateEmbedding(text);
      
      // Store in Supabase with pgvector
      const { error } = await supabase
        .from('vector_chunks')
        .insert({
          id,
          user_id: userId,
          block_id: blockId,
          file_id: fileId,
          organization_id: parentBlock.organization_id,
          text,
          embedding,
          metadata,
          created_at: new Date().toISOString(),
        });

      if (error) {
        if (
          error.message?.includes('organization_id') ||
          error.message?.includes('schema cache') ||
          error.code === '42703'
        ) {
          throw new Error(
            `Database migration not applied: The 'organization_id' column is missing from the 'vector_chunks' table. ` +
            `Please run migration: 20250212000006_add_organization_id_to_tables.sql (see MIGRATION_GUIDE.md)`
          );
        }
        throw new Error(`Failed to store vector chunk: ${error.message}`);
      }

      console.log(`[VectorStore] Stored chunk ${id} for file ${fileId}`);
    } catch (error) {
      console.error('[VectorStore] Error storing chunk:', error);
      throw error;
    }
  }

  /**
   * Search for similar chunks using vector similarity
   */
  async searchSimilarChunks(
    query: string,
    userId?: string, // Changed from number to string
    blockId?: string,
    limit: number = 10,
    similarityThreshold: number = 0.7
  ): Promise<VectorChunk[]> {
    if (!supabase) {
      throw new Error('Supabase client not initialized');
    }

    try {
      // Generate embedding for the query
      const queryEmbedding = await this.embeddingService.generateEmbedding(query);
      
      const { data, error } = await supabase.rpc('match_vector_chunks', {
        query_embedding: queryEmbedding,
        match_threshold: similarityThreshold,
        match_count: limit,
        match_block_id: blockId || '',
        match_user_id: userId || null
      });

      if (error) {
        throw new Error(`Failed to search similar chunks: ${error.message}`);
      }

      return (data || []).map((row: any) => ({
        id: row.id,
        userId: row.user_id,
        blockId: row.block_id,
        fileId: row.file_id,
        text: row.text,
        embedding: row.embedding,
        metadata: row.metadata,
      }));
    } catch (error) {
      console.error('[VectorStore] Error searching similar chunks:', error);
      throw error;
    }
  }

  /**
   * Delete all chunks for a specific file
   */
  async deleteByFileId(fileId: string): Promise<void> {
    if (!supabase) {
      throw new Error('Supabase client not initialized');
    }

    try {
      const { error } = await supabase
        .from('vector_chunks')
        .delete()
        .eq('file_id', fileId);

      if (error) {
        throw new Error(`Failed to delete chunks by file ID: ${error.message}`);
      }

      console.log(`[VectorStore] Deleted chunks for file ${fileId}`);
    } catch (error) {
      console.error('[VectorStore] Error deleting chunks by file ID:', error);
      throw error;
    }
  }

  /**
   * Delete all chunks for a specific block
   */
  async deleteByBlockId(blockId: string): Promise<void> {
    if (!supabase) {
      throw new Error('Supabase client not initialized');
    }

    try {
      const { error } = await supabase
        .from('vector_chunks')
        .delete()
        .eq('block_id', blockId);

      if (error) {
        throw new Error(`Failed to delete chunks by block ID: ${error.message}`);
      }

      console.log(`[VectorStore] Deleted chunks for block ${blockId}`);
    } catch (error) {
      console.error('[VectorStore] Error deleting chunks by block ID:', error);
      throw error;
    }
  }

  /**
   * Delete all chunks for a specific user
   */
  async deleteByUserId(userId: string): Promise<void> { // Changed from number to string
    if (!supabase) {
      throw new Error('Supabase client not initialized');
    }

    try {
      const { error } = await supabase
        .from('vector_chunks')
        .delete()
        .eq('user_id', userId);

      if (error) {
        throw new Error(`Failed to delete chunks by user ID: ${error.message}`);
      }

      console.log(`[VectorStore] Deleted chunks for user ${userId}`);
    } catch (error) {
      console.error('[VectorStore] Error deleting chunks by user ID:', error);
      throw error;
    }
  }

  /**
   * Get statistics for a specific user
   */
  async getStats(userId?: string): Promise<{ totalChunks: number; totalFiles: number; totalBlocks: number }> { // Changed from number to string
    if (!supabase) {
      return { totalChunks: 0, totalFiles: 0, totalBlocks: 0 };
    }

    try {
      let query = supabase
        .from('vector_chunks')
        .select('file_id, block_id', { count: 'exact' });

      if (userId) {
        query = query.eq('user_id', userId);
      }

      const { count, data, error } = await query;

      if (error) {
        throw new Error(`Failed to get vector stats: ${error.message}`);
      }

      const uniqueFiles = new Set(data?.map(row => row.file_id) || []);
      const uniqueBlocks = new Set(data?.map(row => row.block_id) || []);

      return {
        totalChunks: count || 0,
        totalFiles: uniqueFiles.size,
        totalBlocks: uniqueBlocks.size,
      };
    } catch (error) {
      console.error('[VectorStore] Error getting stats:', error);
      return { totalChunks: 0, totalFiles: 0, totalBlocks: 0 };
    }
  }
}

export const vectorStore = new VectorStore();
