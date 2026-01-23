import { EmbeddingService } from './embedding';
import { supabase } from '../db/client';

interface VectorChunk {
  id: string;
  userId: number; // User ID that owns this chunk
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
  private readonly EMBEDDING_DIMENSION = 768; // Google Cloud text-embedding-004 dimension

  constructor() {
    this.embeddingService = new EmbeddingService();
    if (!supabase) {
      console.warn('[VectorStore] Supabase client not initialized. Vector operations will fail.');
    } else {
      console.log('[VectorStore] Using Supabase with pgvector for vector storage');
    }
  }

  async addChunk(
    blockId: string,
    fileId: string,
    text: string,
    metadata: { fileName: string; chunkIndex: number },
    userId?: number
  ): Promise<string> {
    if (!supabase) {
      throw new Error('Supabase client not initialized. Cannot store embeddings.');
    }

    const embedding = await this.embeddingService.generateEmbedding(text);
    const id = `${blockId}-${fileId}-${metadata.chunkIndex}`;
    
    // Convert embedding array to PostgreSQL array format string for pgvector
    const embeddingString = `[${embedding.join(',')}]`;

    const { error } = await supabase
      .from('vector_chunks')
      .upsert({
        id,
        user_id: userId || 0, // Store user ID if provided
        block_id: blockId,
        file_id: fileId,
        text,
        embedding: embeddingString,
        metadata: {
          fileName: metadata.fileName,
          chunkIndex: metadata.chunkIndex,
        },
      }, {
        onConflict: 'id',
      });

    if (error) {
      console.error('[VectorStore] Error storing chunk:', error);
      throw new Error(`Failed to store embedding: ${error.message}`);
    }

    return id;
  }

  async addChunks(
    blockId: string,
    fileId: string,
    texts: string[],
    fileName: string,
    userId?: number
  ): Promise<string[]> {
    const chunks = texts.map((text, index) => ({
      text,
      metadata: { fileName, chunkIndex: index },
    }));

    // Process in batches to avoid hitting rate limits (concurrency limit ~5 for free tier)
    const BATCH_SIZE = 5;
    const ids: string[] = [];

    for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
      const batch = chunks.slice(i, i + BATCH_SIZE);
      const batchIds = await Promise.all(
        batch.map(chunk =>
          this.addChunk(blockId, fileId, chunk.text, chunk.metadata, userId)
        )
      );
      ids.push(...batchIds);
      
      // Small delay between batches to be nice to the API
      if (i + BATCH_SIZE < chunks.length) {
        await new Promise(resolve => setTimeout(resolve, 200));
      }
    }
    
    return ids;
  }

  async search(
    queryEmbedding: number[],
    blockId: string,
    topK: number = 5,
    userId?: number
  ): Promise<VectorChunk[]> {
    if (!supabase) {
      throw new Error('Supabase client not initialized. Cannot search embeddings.');
    }

    // Convert query embedding to PostgreSQL array format
    const queryEmbeddingString = `[${queryEmbedding.join(',')}]`;

    // Use Supabase RPC function for vector similarity search
    // Note: The function should filter by user_id if userId is provided
    const { data, error } = await supabase.rpc('match_vector_chunks', {
      query_embedding: queryEmbeddingString,
      match_block_id: blockId,
      match_user_id: userId || null, // Filter by user ID if provided
      match_threshold: 0.5, // Similarity threshold (0-1), lower = more results
      match_count: topK,
    });

    if (error) {
      console.error('[VectorStore] Error searching embeddings:', error);
      throw new Error(`Failed to search embeddings: ${error.message}`);
    }

    // Convert Supabase response to VectorChunk format
    const chunks: VectorChunk[] = (data || []).map((row: any) => ({
      id: row.id,
      userId: row.user_id || 0,
      blockId: row.block_id,
      fileId: row.file_id,
      text: row.text,
      embedding: Array.isArray(row.embedding) ? row.embedding : JSON.parse(row.embedding || '[]'),
      metadata: row.metadata || {},
    }));

    return chunks;
  }

  async searchByQuery(
    query: string,
    blockId: string,
    topK: number = 5,
    userId?: number
  ): Promise<VectorChunk[]> {
    try {
      const queryEmbedding = await this.embeddingService.generateEmbedding(query);
      return this.search(queryEmbedding, blockId, topK, userId);
    } catch (error) {
      console.error('[VectorStore] Error generating query embedding:', error);
      // Return empty results instead of crashing if embedding generation fails
      return [];
    }
  }

  async deleteByFileId(fileId: string): Promise<void> {
    if (!supabase) {
      throw new Error('Supabase client not initialized. Cannot delete embeddings.');
    }

    const { error } = await supabase
      .from('vector_chunks')
      .delete()
      .eq('file_id', fileId);

    if (error) {
      console.error('[VectorStore] Error deleting chunks by file_id:', error);
      throw new Error(`Failed to delete embeddings: ${error.message}`);
    }
  }

  async deleteByBlockId(blockId: string): Promise<void> {
    if (!supabase) {
      throw new Error('Supabase client not initialized. Cannot delete embeddings.');
    }

    const { error } = await supabase
      .from('vector_chunks')
      .delete()
      .eq('block_id', blockId);

    if (error) {
      console.error('[VectorStore] Error deleting chunks by block_id:', error);
      throw new Error(`Failed to delete embeddings: ${error.message}`);
    }
  }

  async getChunkCount(blockId: string): Promise<number> {
    if (!supabase) {
      return 0;
    }

    const { count, error } = await supabase
      .from('vector_chunks')
      .select('*', { count: 'exact', head: true })
      .eq('block_id', blockId);

    if (error) {
      console.error('[VectorStore] Error counting chunks:', error);
      return 0;
    }

    return count || 0;
  }
}

export const vectorStore = new VectorStore();
