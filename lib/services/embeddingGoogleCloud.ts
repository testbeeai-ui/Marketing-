/**
 * Embedding service using Google Cloud Vertex AI
 * 
 * NOTE: This service uses gemini-embedding-001 for generating embeddings (vector representations of text).
 * This is DIFFERENT from the Gemini model (gemini-3-flash) which is used for text generation.
 * 
 * - gemini-embedding-001: Converts text → vectors (for similarity search) [LATEST MODEL]
 * - gemini-3-flash: Converts text → text (for story generation)
 *Uses text-embedding-005 model (NOT Gemini - Gemini is for text generation)
 **/
import { PredictionServiceClient } from '@google-cloud/aiplatform';
import { helpers } from '@google-cloud/aiplatform';
import path from 'path';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load .env
const envPath = path.resolve(__dirname, '..', '..', '.env');
dotenv.config({ path: envPath });

export class GoogleCloudEmbeddingService {
  private client: PredictionServiceClient;
  private projectId: string;
  private location: string;
  private endpoint: string;
  private readonly EMBEDDING_DIMENSION = 1536;

  constructor() {
    this.projectId = process.env.GOOGLE_CLOUD_PROJECT_ID || '';
    this.location = process.env.GOOGLE_CLOUD_LOCATION || 'us-central1';
    this.endpoint = `${this.location}-aiplatform.googleapis.com`;

    if (!this.projectId) {
      throw new Error(
        'GOOGLE_CLOUD_PROJECT_ID environment variable is required. ' +
        'Set it in your .env file: GOOGLE_CLOUD_PROJECT_ID=your-project-id'
      );
    }

    const credentialsBase64 = process.env.GOOGLE_CLOUD_CREDENTIALS_BASE64;
    if (!credentialsBase64) {
      throw new Error(
        'GOOGLE_CLOUD_CREDENTIALS_BASE64 environment variable is required for Google Cloud. ' +
        'Set it in your .env file with base64-encoded service account JSON.'
      );
    }

    let credentials: { client_email?: string; private_key?: string } = {};
    try {
      const credentialsJson = Buffer.from(credentialsBase64, 'base64').toString('utf-8');
      const parsed = JSON.parse(credentialsJson);
      credentials = {
        client_email: parsed.client_email,
        private_key: parsed.private_key
      };
      if (!credentials.client_email || !credentials.private_key) {
        throw new Error('Missing client_email or private_key in credentials');
      }
      console.log(`[Embedding] Using credentials from .env (base64)`);
    } catch (error) {
      throw new Error(
        `Failed to decode Google Cloud credentials from base64: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }

    try {
      this.client = new PredictionServiceClient({
        apiEndpoint: this.endpoint,
        credentials
      });
      console.log(`[Embedding] Google Cloud Vertex AI client initialized for project: ${this.projectId}`);
    } catch (error) {
      console.error('[Embedding] Failed to initialize Google Cloud client:', error);
      throw new Error('Failed to initialize Google Cloud Vertex AI client. Check your credentials.');
    }
  }

  async generateEmbedding(text: string): Promise<number[]> {
    try {
      // Using gemini-embedding-001 (latest embedding model - DIFFERENT from Gemini generation models)
      const modelName = `projects/${this.projectId}/locations/${this.location}/publishers/google/models/gemini-embedding-001`;

      // Prepare the instance for Vertex AI
      const instance = helpers.toValue({
        content: text,
        task_type: "RETRIEVAL_DOCUMENT"
      });

      const request = {
        endpoint: modelName,
        instances: [instance],
      } as any;

      console.log(`[Embedding] Generating embedding for text: ${text.substring(0, 50)}...`);

      // Implement simple exponential backoff retry for quota errors
      let retries = 0;
      const maxRetries = 3;
      
      while (true) {
        try {
          const [response] = await this.client.predict(request);

          if (!response.predictions || !response.predictions[0]) {
            throw new Error('No embedding returned from Google Cloud Vertex AI');
          }

          const predictionValue = response.predictions[0];
          const prediction = helpers.fromValue(predictionValue as any) as any;

          // Extract embeddings - Vertex AI returns { embeddings: { values: number[], statistics: ... } }
          const embedding = prediction.embeddings?.values || prediction.values;

          if (!embedding || !Array.isArray(embedding)) {
            throw new Error(`Invalid embedding format from Google Cloud. Got: ${JSON.stringify(prediction)}`);
          }

          if (embedding.length !== this.EMBEDDING_DIMENSION) {
            console.warn(
              `[Embedding] Expected dimension ${this.EMBEDDING_DIMENSION}, got ${embedding.length}`
            );
          }

          if (embedding.length > this.EMBEDDING_DIMENSION) {
            return embedding.slice(0, this.EMBEDDING_DIMENSION);
          }

          return embedding;
        } catch (error: any) {
          const errorMessage = error.message || '';
          if (errorMessage.includes('RESOURCE_EXHAUSTED') || errorMessage.includes('Quota exceeded') || errorMessage.includes('429')) {
            if (retries >= maxRetries) {
              throw new Error(`Google Cloud quota exceeded after ${maxRetries} retries: ${errorMessage}`);
            }
            
            const delay = Math.pow(2, retries) * 1000 + Math.random() * 1000; // Exponential backoff + jitter
            console.warn(`[Embedding] Quota exceeded. Retrying in ${Math.round(delay)}ms... (Attempt ${retries + 1}/${maxRetries})`);
            await new Promise(resolve => setTimeout(resolve, delay));
            retries++;
            continue;
          }
          
          throw error;
        }
      }
    } catch (error: unknown) {
      console.error('[Embedding] Error generating embedding:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      if (errorMessage.includes('credentials') || errorMessage.includes('authentication')) {
        throw new Error(
          `Google Cloud authentication failed: ${errorMessage}. ` +
          `Make sure GOOGLE_CLOUD_CREDENTIALS_BASE64 is set to a valid service account JSON.`
        );
      }

      throw new Error(`Failed to generate embedding: ${errorMessage}`);
    }
  }

  async generateEmbeddings(texts: string[]): Promise<number[][]> {
    // Generate embeddings in parallel for better performance
    const embeddings = await Promise.all(
      texts.map(text => this.generateEmbedding(text))
    );
    return embeddings;
  }

  getEmbeddingDimension(): number {
    return this.EMBEDDING_DIMENSION;
  }
}
