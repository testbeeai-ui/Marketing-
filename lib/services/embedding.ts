/**
 * Embedding service - Uses Google Cloud Vertex AI by default
 * Can be switched back to Ollama by setting USE_OLLAMA=true in .env
 */
import { GoogleCloudEmbeddingService } from './embeddingGoogleCloud';

export class EmbeddingService {
  private googleCloudService?: GoogleCloudEmbeddingService;
  private useOllama: boolean;
  private ollamaUrl: string;

  constructor() {
    // Check if user wants to use Ollama instead of Google Cloud
    this.useOllama = process.env.USE_OLLAMA === 'true';
    this.ollamaUrl = process.env.OLLAMA_URL || 'http://localhost:11434';

    if (!this.useOllama) {
      try {
        this.googleCloudService = new GoogleCloudEmbeddingService();
        console.log('[Embedding] Using Google Cloud Vertex AI for embeddings');
      } catch (error) {
        console.warn('[Embedding] Failed to initialize Google Cloud, falling back to Ollama:', error);
        this.useOllama = true;
      }
    } else {
      console.log('[Embedding] Using Ollama for embeddings');
    }
  }

  async generateEmbedding(text: string): Promise<number[]> {
    // Force Ollama if configured
    if (this.useOllama) {
      return this.generateEmbeddingWithOllama(text);
    }

    // Try Google Cloud
    if (this.googleCloudService) {
      try {
        return await this.googleCloudService.generateEmbedding(text);
      } catch (error: unknown) {
        // Re-throw the error to ensure we don't silently fallback if production requirements demand Google Cloud
        console.error('[Embedding] Google Cloud generation failed:', error);
        throw error;
      }
    }

    throw new Error('Google Cloud Embedding Service not initialized');
  }

  private async generateEmbeddingWithOllama(text: string): Promise<number[]> {
    try {
      const model = process.env.OLLAMA_EMBEDDING_MODEL || 'nomic-embed-text';

      const response = await fetch(`${this.ollamaUrl}/api/embeddings`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: model,
          prompt: text,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(
          `Ollama API error (${response.status}): ${errorText}. ` +
          `Make sure Ollama is running at ${this.ollamaUrl} and the embedding model "${model}" is installed. ` +
          `Try: ollama pull ${model}`
        );
      }

      const data = await response.json() as any;
      if (!data.embedding || !Array.isArray(data.embedding)) {
        throw new Error('Invalid embedding response from Ollama');
      }

      return data.embedding;
    } catch (error: unknown) {
      console.error('[Embedding] Error generating embedding with Ollama:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Failed to generate embedding: ${errorMessage}`);
    }
  }

  async generateEmbeddings(texts: string[]): Promise<number[][]> {
    if (this.useOllama || !this.googleCloudService) {
      const embeddings = await Promise.all(
        texts.map(text => this.generateEmbeddingWithOllama(text))
      );
      return embeddings;
    }

    try {
      return await this.googleCloudService.generateEmbeddings(texts);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);

      // Auto-fallback to Ollama if quota is exceeded
      if (errorMessage.includes('RESOURCE_EXHAUSTED') || errorMessage.includes('Quota exceeded') || errorMessage.includes('quota')) {
        console.warn('[Embedding] Google Cloud quota exceeded. Automatically falling back to Ollama...');
        console.warn('[Embedding] To use Ollama permanently, set USE_OLLAMA=true in .env');
        const embeddings = await Promise.all(
          texts.map(text => this.generateEmbeddingWithOllama(text))
        );
        return embeddings;
      }

      // Re-throw other errors
      throw error;
    }
  }

  getEmbeddingDimension(): number {
    if (this.useOllama || !this.googleCloudService) {
      // Ollama nomic-embed-text is 768 dimensions
      return 768;
    }
    return this.googleCloudService.getEmbeddingDimension();
  }
}
