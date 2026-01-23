/**
 * Embedding service using Google Cloud Vertex AI
 */
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
  private readonly EMBEDDING_DIMENSION = 768; // text-embedding-004 produces 768-dimensional vectors

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

    // Set credentials path if provided
    const credentialsPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
    if (credentialsPath) {
      // Ensure absolute path
      const fullPath = path.isAbsolute(credentialsPath)
        ? credentialsPath
        : path.resolve(process.cwd(), credentialsPath); // Use process.cwd() instead of __dirname
      
      process.env.GOOGLE_APPLICATION_CREDENTIALS = fullPath;
      console.log(`[Embedding] Using credentials from: ${fullPath}`);
    }

    try {
      this.client = new PredictionServiceClient({
        apiEndpoint: this.endpoint,
      });
      console.log(`[Embedding] Google Cloud Vertex AI client initialized for project: ${this.projectId}`);
    } catch (error) {
      console.error('[Embedding] Failed to initialize Google Cloud client:', error);
      throw new Error('Failed to initialize Google Cloud Vertex AI client. Check your credentials.');
    }
  }

  async generateEmbedding(text: string): Promise<number[]> {
    try {
      // Using text-embedding-004
      const modelName = `projects/${this.projectId}/locations/${this.location}/publishers/google/models/text-embedding-004`;

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
          `Make sure GOOGLE_APPLICATION_CREDENTIALS points to a valid service account key file.`
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
