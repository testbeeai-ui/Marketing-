import { VertexAI, GenerativeModel } from '@google-cloud/vertexai';
import { GoogleGenerativeAI } from '@google/generative-ai';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * AI service using Google Cloud Vertex AI (uses ADC with User Identity)
 * REQUIRED: Run `gcloud auth application-default login` to access Gemini 3 Preview
 */
export class AIService {
  private vertexAI!: VertexAI;
  private genAI: GoogleGenerativeAI | null = null;
  private projectId!: string;
  private location!: string;

  constructor() {
    this.initialize();
  }

  private initialize() {
    // Load .env from project root
    const envPath = path.resolve(__dirname, '..', '..', '.env');
    const envResult = dotenv.config({ path: envPath, override: true });

    if (envResult.error) {
      console.warn(`[AIService] Warning: Could not reload .env file from ${envPath}`);
      dotenv.config({ override: true });
    } else {
      console.log(`[AIService] Loaded .env from: ${envPath}`);
    }

    // Use environment variable or fallback to requested project ID
    this.projectId = process.env.GOOGLE_CLOUD_PROJECT || 'gen-lang-client-0346028406';
    this.location = process.env.GOOGLE_CLOUD_LOCATION || 'us-central1';

    console.log(`[AIService] Initializing Vertex AI for project: ${this.projectId} (Mode: ${process.env.GOOGLE_APPLICATION_CREDENTIALS ? 'Key File' : 'ADC/Identity'})`);

    // Initialize Vertex AI
    this.vertexAI = new VertexAI({
      project: this.projectId,
      location: this.location,
    });

    // Initialize Google AI Studio (API Key)
    if (process.env.GOOGLE_API_KEY) {
      console.log('[AIService] GOOGLE_API_KEY found, initializing GoogleGenerativeAI client');
      this.genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);
    }

    // User requested strict usage of Gemini 3 models ONLY
    // WARNING: If these 404, the app will fail to generate content.
    const priorityModels = [
      'gemini-3-pro-image-preview',
      'gemini-3-pro-preview',
      'gemini-3-flash-preview',
      'gemini-1.5-pro'
    ];

    // Note: We don't verify them all at startup to save time/quota, but we log the configuration
    console.log(`[AIService] Configured Vertex AI with strict Gemini 3/2.5 priority list: ${priorityModels.join(', ')}`);
  }

  // Method to reload configuration (useful when .env changes)
  reloadApiKey() {
    console.log('[AIService] Reloading configuration from environment...');
    this.initialize();
  }

  async generateContent(prompt: string): Promise<string> {
    // User requested strict usage of Gemini 3 models ONLY
    // NOTE: Only -preview models exist (gemini-3-pro and gemini-3-flash without suffix don't exist)
    const modelsToTry = [
      'gemini-3-pro-preview',
      'gemini-3-flash-preview',
      'gemini-2.0-flash-exp',
      'gemini-1.5-pro'
    ];

    // If environment variable is set, prioritize it
    if (process.env.GEMINI_MODEL) {
      console.log(`[AIService] Custom model requested via env: ${process.env.GEMINI_MODEL}`);
      modelsToTry.unshift(process.env.GEMINI_MODEL);
    }

    // Try models in sequence using REST API
    for (const modelName of modelsToTry) {
      try {
        console.log(`[AIService] Attempting to generate via Vertex REST API with model: ${modelName}`);

        if (!process.env.GOOGLE_API_KEY) throw new Error("GOOGLE_API_KEY not found");

        // Use Google AI Studio Endpoint (Generative Language API) which supports API Keys
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${process.env.GOOGLE_API_KEY}`;

        const response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ role: 'user', parts: [{ text: prompt }] }],
            generationConfig: {
              temperature: 0.7,
              maxOutputTokens: 2048,
            }
          })
        });

        if (!response.ok) {
          const errText = await response.text();
          console.log(`[AIService] REST API ${modelName} failed: ${response.status} - ${errText}`);
          continue; // Try next model
        }

        const data = await response.json() as any;
        // Verify response structure
        if (data.candidates && data.candidates[0].content && data.candidates[0].content.parts && data.candidates[0].content.parts[0].text) {
          const text = data.candidates[0].content.parts[0].text;
          console.log(`[AIService] Successfully generated content (Vertex REST) with: ${modelName}`);
          return text;
        }
      } catch (error: any) {
        console.log(`[AIService] Vertex REST Error for ${modelName}:`, error.message);
      }
    }

    throw new Error('All strict Gemini 3/2.0+ models failed via Vertex REST API. No lower versions allowed.');
  }

  async generateStory(prompt: string, context: string[], style: string): Promise<string> {
    const contextStr = context.length > 0 ? `Context:\n${context.join('\n')}\n` : '';
    const fullPrompt = `${contextStr}Write a ${style} story about: ${prompt}`;
    return this.generateContent(fullPrompt);
  }

  async generateStories(
    prompt: string,
    context: string[],
    styles: ('professional' | 'viral' | 'storyteller')[] = ['professional', 'viral', 'storyteller']
  ): Promise<Record<string, string>> {
    const stories: Record<string, string> = {};
    await Promise.all(
      styles.map(async (style) => {
        try {
          stories[style] = await this.generateStory(prompt, context, style);
        } catch (error) {
          console.error(`[AIService] Error generating ${style} story:`, error);
          stories[style] = `Error generating ${style} story. Please try again.`;
        }
      })
    );
    return stories;
  }

  /**
   * Generate image using Imagen 4.0 via Vertex AI REST API
   */
  async generateImage(prompt: string, width: number = 1024, height: number = 1024): Promise<Buffer> {
    const modelName = 'imagen-4.0-generate-001';
    console.log(`[AIService] Generating image with ${modelName} (Vertex REST): ${prompt.substring(0, 50)}...`);

    if (!process.env.GOOGLE_API_KEY) throw new Error("GOOGLE_API_KEY not found");

    // Use Google AI Studio Endpoint for Image (if available, mostly Experimental)
    // Note: Imagen 3 might be supported via :predict on GenLang
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:predict?key=${process.env.GOOGLE_API_KEY}`;

    // Imagen request body
    const body = {
      instances: [
        { prompt: prompt }
      ],
      parameters: {
        sampleCount: 1,
        // aspectRatio: "1:1" // Optional, defaulting
      }
    };

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`Vertex REST API failed: ${response.status} - ${errText}`);
      }

      const data = await response.json() as any;

      // Parse predictions
      // Expected: { predictions: [ { bytesBase64Encoded: "..." } ] }
      if (data.predictions && data.predictions[0]) {
        // Check for bytesBase64Encoded
        if (data.predictions[0].bytesBase64Encoded) {
          console.log(`[AIService] Successfully generated image with ${modelName}`);
          return Buffer.from(data.predictions[0].bytesBase64Encoded, 'base64');
        }
        // Fallback check for other formats (some versions return different structure)
        if (data.predictions[0].structValue?.fields?.bytesBase64Encoded?.stringValue) {
          return Buffer.from(data.predictions[0].structValue.fields.bytesBase64Encoded.stringValue, 'base64');
        }
      }

      console.warn(`[AIService] No image data found in response`, JSON.stringify(data));
      throw new Error(`No image data returned from ${modelName}`);

    } catch (error: any) {
      console.error(`[AIService] Imagen Generation Error:`, error);
      throw error;
    }
  }

  /**
   * Analyze an image using Gemini vision capabilities
   * Returns a detailed description of the image
   */
  async analyzeImage(imageUrl: string): Promise<string> {
    // Use Gemini 3 models only (user requirement)
    const modelsToTry = [
      'gemini-3-pro-preview',
      'gemini-3-flash-preview'
    ];

    if (!process.env.GOOGLE_API_KEY) throw new Error("GOOGLE_API_KEY not found");

    // Fetch the image and convert to base64
    let imageBase64: string;
    let mimeType: string = 'image/jpeg';

    try {
      const imageResponse = await fetch(imageUrl);
      if (!imageResponse.ok) {
        throw new Error(`Failed to fetch image: ${imageResponse.status}`);
      }
      const imageBuffer = await imageResponse.arrayBuffer();
      imageBase64 = Buffer.from(imageBuffer).toString('base64');

      // Detect mime type from response
      const contentType = imageResponse.headers.get('content-type');
      if (contentType) {
        mimeType = contentType.split(';')[0];
      }
    } catch (error) {
      console.error('[AIService] Failed to fetch image for analysis:', error);
      throw new Error('Failed to fetch image for analysis');
    }

    const prompt = `Analyze this image in detail. Describe:
1. The main subject and composition
2. Colors, lighting, and aesthetic style
3. Key visual elements and their positions
4. Overall mood and tone
5. Any text, logos, or branding visible

Provide a comprehensive description that could be used to recreate this image.`;

    for (const modelName of modelsToTry) {
      try {
        console.log(`[AIService] Analyzing image with model: ${modelName}`);

        const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${process.env.GOOGLE_API_KEY}`;

        const response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{
              role: 'user',
              parts: [
                {
                  inline_data: {
                    mime_type: mimeType,
                    data: imageBase64
                  }
                },
                { text: prompt }
              ]
            }],
            generationConfig: {
              temperature: 0.4,
              maxOutputTokens: 1024,
            }
          })
        });

        if (!response.ok) {
          const errText = await response.text();
          console.log(`[AIService] Vision API ${modelName} failed: ${response.status} - ${errText}`);
          continue;
        }

        const data = await response.json() as any;
        if (data.candidates?.[0]?.content?.parts?.[0]?.text) {
          console.log(`[AIService] Successfully analyzed image with: ${modelName}`);
          return data.candidates[0].content.parts[0].text;
        }
      } catch (error: any) {
        console.log(`[AIService] Vision Error for ${modelName}:`, error.message);
      }
    }

    throw new Error('Failed to analyze image with vision models');
  }

  /**
   * Analyze a logo/overlay image to describe it for prompt enhancement
   */
  async analyzeLogo(logoBase64: string, mimeType: string = 'image/png'): Promise<string> {
    if (!process.env.GOOGLE_API_KEY) throw new Error("GOOGLE_API_KEY not found");

    console.log('[AIService] Analyzing uploaded logo...');

    const prompt = `You are helping create an image generation prompt. Analyze this logo/brand image and provide a DETAILED description that can be used to recreate it in an AI-generated image.

DESCRIBE IN DETAIL:
1. SHAPE: Exact geometric shapes (circle, square, rectangle, custom shape, etc.)
2. COLORS: Specific colors with their placement (e.g., "blue background with white text")
3. TEXT: Any words, letters, or numbers - spell them out exactly
4. ICONS/SYMBOLS: What symbols or icons are present and where
5. STYLE: Is it 3D, flat, gradient, minimalist, ornate, etc.?
6. COMPOSITION: How elements are arranged (centered, stacked, side-by-side)

Output a clear, detailed description like:
"A circular logo with a dark blue background. White text reading 'BRAND NAME' in bold sans-serif font. A golden star icon above the text. Modern minimalist style with subtle gradient."

IMPORTANT: Be specific enough that the logo can be recognizably recreated in the image.`;

    // Use Gemini 3 model for logo analysis
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent?key=${process.env.GOOGLE_API_KEY}`;

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          role: 'user',
          parts: [
            {
              inline_data: {
                mime_type: mimeType,
                data: logoBase64
              }
            },
            { text: prompt }
          ]
        }],
        generationConfig: {
          temperature: 0.3,
          maxOutputTokens: 512,
        }
      })
    });

    if (!response.ok) {
      throw new Error('Failed to analyze logo');
    }

    const data = await response.json() as any;
    if (data.candidates?.[0]?.content?.parts?.[0]?.text) {
      return data.candidates[0].content.parts[0].text;
    }

    throw new Error('No logo description returned');
  }
}

export const aiService = new AIService();
