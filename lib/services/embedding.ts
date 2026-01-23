/**
 * Embedding service - Uses Google Cloud Vertex AI exclusively
 * No fallback to Ollama - Google Cloud is required
 * 
 * IMPORTANT: This service uses gemini-embedding-001 for creating vector embeddings.
 * This is DIFFERENT from GEMINI_MODEL (gemini-3-flash) in .env which is for text generation.
 * 
 * - gemini-embedding-001: Text → Vectors (for similarity search) [LATEST MODEL]
 * - gemini-3-flash: Text → Text (for story generation)
 */
import { GoogleCloudEmbeddingService } from './embeddingGoogleCloud';

export class EmbeddingService {
  private googleCloudService: GoogleCloudEmbeddingService;

  constructor() {
    // Initialize Google Cloud service - no fallback
    this.googleCloudService = new GoogleCloudEmbeddingService();
    console.log('[Embedding] Using Google Cloud Vertex AI for embeddings');
  }

  async generateEmbedding(text: string): Promise<number[]> {
    // Use Google Cloud exclusively - no fallback
    return await this.googleCloudService.generateEmbedding(text);
  }

  

  async generateEmbeddings(texts: string[]): Promise<number[][]> {
    // Use Google Cloud exclusively - no fallback
    return await this.googleCloudService.generateEmbeddings(texts);
  }

  getEmbeddingDimension(): number {
    return this.googleCloudService.getEmbeddingDimension();
  }
}
