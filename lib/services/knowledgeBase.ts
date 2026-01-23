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
