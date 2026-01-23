import { supabase } from '../db/client';

interface Document {
  id: string;
  blockId: string;
  fileName: string;
  content: string;
  fileSize: number;
  uploadedAt: string;
  status: 'ready' | 'indexing' | 'error';
}

/**
 * Service to manage document metadata and content using Supabase
 */
export class KnowledgeBase {

  private get db() {
    if (!supabase) {
      throw new Error('Supabase client not initialized. Check environment variables.');
    }
    return supabase;
  }

  constructor() {
    // No load needed
  }

  async addDocument(doc: Document): Promise<void> {
    const { error } = await this.db
      .from('documents')
      .upsert({
        id: doc.id,
        block_id: doc.blockId,
        file_name: doc.fileName,
        content: doc.content,
        file_size: doc.fileSize,
        uploaded_at: doc.uploadedAt,
        status: doc.status
      });

    if (error) {
      console.error('[KnowledgeBase] Failed to save document:', error);
      throw new Error(`Failed to save document: ${error.message}`);
    }
  }

  async getDocument(id: string): Promise<Document | undefined> {
    const { data, error } = await this.db
      .from('documents')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      if (error.code !== 'PGRST116') {
        console.error(`[KnowledgeBase] Error fetching document ${id}:`, error);
      }
      return undefined;
    }

    return this.mapFromDb(data);
  }

  async getDocumentsByBlock(blockId: string): Promise<Document[]> {
    const { data, error } = await this.db
      .from('documents')
      .select('*')
      .eq('block_id', blockId)
      .order('uploaded_at', { ascending: false });

    if (error) {
      console.error(`[KnowledgeBase] Error fetching documents for block ${blockId}:`, error);
      return [];
    }

    return (data || []).map(this.mapFromDb);
  }

  async getDocumentsByUserId(userId: string): Promise<Document[]> {
    // Get user's blocks first
    const { data: blocksData, error: blocksError } = await this.db
      .from('blocks')
      .select('id')
      .eq('user_id', userId);

    if (blocksError) {
      console.error(`[KnowledgeBase] Error fetching blocks for user ${userId}:`, blocksError);
      return [];
    }

    if (!blocksData || blocksData.length === 0) {
      return [];
    }

    const blockIds = blocksData.map(block => block.id);

    // Then get documents for those blocks
    const { data, error } = await this.db
      .from('documents')
      .select('*')
      .in('block_id', blockIds)
      .order('uploaded_at', { ascending: false });

    if (error) {
      console.error(`[KnowledgeBase] Error fetching documents for user ${userId}:`, error);
      return [];
    }

    return (data || []).map(this.mapFromDb);
  }

  async getDocumentsMetadataByBlockIds(blockIds: string[]): Promise<{ blockId: string; status: string }[]> {
    if (blockIds.length === 0) return [];

    const { data, error } = await this.db
      .from('documents')
      .select('block_id, status')
      .in('block_id', blockIds);

    if (error) {
      console.error('[KnowledgeBase] Error fetching document metadata:', error);
      return [];
    }

    return (data || []).map((row: any) => ({
      blockId: row.block_id,
      status: row.status
    }));
  }

  async deleteDocument(id: string): Promise<void> {
    const { error } = await this.db
      .from('documents')
      .delete()
      .eq('id', id);

    if (error) {
      console.error(`[KnowledgeBase] Failed to delete document ${id}:`, error);
      throw new Error(`Failed to delete document: ${error.message}`);
    }
  }

  async deleteDocumentByFileIdAndUserId(fileId: string, userId: string): Promise<void> {
    // First verify the document belongs to the user by checking the block
    const { data: documentData, error: verifyError } = await this.db
      .from('documents')
      .select('block_id')
      .eq('id', fileId)
      .single();

    if (verifyError || !documentData) {
      console.error(`[KnowledgeBase] Document ${fileId} not found or error verifying ownership:`, verifyError);
      throw new Error(`Document not found or access denied`);
    }

    // Check if the block belongs to the user
    const { data: blockData, error: blockError } = await this.db
      .from('blocks')
      .select('id')
      .eq('id', documentData.block_id)
      .eq('user_id', userId)
      .single();

    if (blockError || !blockData) {
      console.error(`[KnowledgeBase] Block ${documentData.block_id} not found or does not belong to user ${userId}:`, blockError);
      throw new Error(`Document not found or access denied`);
    }

    // Now delete the document
    const { error } = await this.db
      .from('documents')
      .delete()
      .eq('id', fileId);

    if (error) {
      console.error(`[KnowledgeBase] Failed to delete document ${fileId} for user ${userId}:`, error);
      throw new Error(`Failed to delete document: ${error.message}`);
    }
  }

  private mapFromDb(row: any): Document {
    return {
      id: row.id,
      blockId: row.block_id,
      fileName: row.file_name,
      content: row.content,
      fileSize: row.file_size,
      uploadedAt: row.uploaded_at,
      status: row.status as any
    };
  }
}

export const knowledgeBase = new KnowledgeBase();
