import { aiService } from './aiService';
import { userProfileService } from './userProfileService';
import { userMemoryService } from './userMemoryService';
import { supabase, isDatabaseAvailable } from '../db/client';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Platform-specific image dimensions
const PLATFORM_DIMENSIONS: Record<string, { width: number; height: number }> = {
  linkedin: { width: 1200, height: 627 },
  twitter: { width: 1200, height: 675 },
  instagram: { width: 1080, height: 1080 },
  facebook: { width: 1200, height: 630 },
  default: { width: 1024, height: 1024 },
};

export class ImageGenerator {
  /**
   * Enhance text for image generation with user preferences
   */
  async enhanceTextForImageGeneration(
    rawText: string,
    userId?: number,
    platform?: string
  ): Promise<string> {
    const userContext: {
      profile?: { style_preferences?: string } | null;
      likedStyles?: Array<{ context_metadata?: { style_summary?: string }; content: string }>;
      dislikedStyles?: Array<{ context_metadata?: { why_disliked?: string; preferred_alternative?: string }; content: string }>;
    } = {};

    if (userId) {
      try {
        const profile = await userProfileService.getUserProfile(userId);
        if (profile) {
          userContext.profile = profile;
        }

        // Get liked/disliked image styles
        userContext.likedStyles = await userMemoryService.getLikedStyles(userId, 'image', undefined, 15);
        userContext.dislikedStyles = await userMemoryService.getDislikedStyles(userId, 'image', undefined, 12);
      } catch (error) {
        console.error('Error loading user context for image:', error);
      }
    }

    const platformContext = platform ? `Target Platform: ${platform.toUpperCase()}` : 'Target Platform: GENERAL';

    // Platform specific style guidelines
    let platformStyle = '';
    if (platform?.toLowerCase().includes('linkedin')) {
      platformStyle = 'Style: Professional, Corporate, Sleek, Minimalist, High-end Commercial Photography. Avoid: Cartoony, messy, chaotic.';
    } else if (platform?.toLowerCase().includes('instagram')) {
      platformStyle = 'Style: Aesthetic, Vibrant, Inspiring, High Saturation, Lifestyle Photography, Influencer Quality.';
    } else if (platform?.toLowerCase().includes('twitter') || platform?.toLowerCase().includes('x')) {
      platformStyle = 'Style: Eye-catching, Bold, Viral, Meme-worthy or Sharp Graphic Design. High contrast.';
    } else if (platform?.toLowerCase().includes('facebook')) {
      platformStyle = 'Style: Community-focused, Warm, Engaging, Relatable but High Quality.';
    }

    const systemPrompt = `You are a Visionary Creative Director & Visual Storyteller.
Your goal is to translate abstract concepts into profound, multi-layered visual narratives, not just "pretty pictures."

${platformContext}
Platform Vibe: ${platform ? platform.toUpperCase() : 'General'}

DEEP ANALYSIS FRAMEWORK:
1. CORE NARRATIVE: What is the *underlying* story? (e.g., "The David vs Goliath struggle of a startup" vs "The quiet dignity of craftsmanship")
2. EMOTIONAL RESONANCE: How should the viewer *feel*? (Awed, unsettled, comforted, energized?)
3. VISUAL METAPHOR: Don't illustrate the text literally. Find the visual poetry.
   - "Growth" isn't just a chart; it's a sapling breaking through concrete.
   - "Connectivity" isn't just lines; it's a constellation of bioluminescent organisms.

VISUAL DIMENSIONS TO DEFINE:
- **Foreground/Background**: Establish depth. What is immediate? What is vast?
- **Lighting as Emotion**: Use light to tell the story (e.g., "chiaroscuro for drama," "subsurface scattering for organic warmth," "harsh neon for cyber-tension").
- **Texture & Materiality**: Define the tactile quality (e.g., "gritty concrete," "liquid chrome," "soft velvet," "translucent glass").
- **Composition**: Rule of thirds, center symmetry, leading lines?

CRITICAL INSTRUCTION:
- AVOID generic "stock photo" looks or "corporate memphis."
- IF the topic is digital/tech, AVOID generic "matrix code" or "floating holograms" unless subverted creatively.
- PUSH for cinematic, editorial, or fine-art aesthetics.

OUTPUT FORMAT:
Return ONLY the final prompt string.
The prompt should follow this structure:
"[Art Medium/Style] of [Core Subject/Metaphor], [Foreground Element] vs [Background Context], [Lighting Strategy], [Color Palette], [Texture/Material Details], [Technical Specs (e.g. 8k, depth of field)]"

EXAMPLE DEEP OUTPUTS:
- "Cinematic wide shot of a solitary astronaut standing on a dune of black sand, looking up at a colossal, crumbling stone statue of a smartphone, soft dusty atmosphere, golden hour lighting hitting the astronaut's visor, textural contrast between organic sand and digital ruins, 8k, anamorphic lens."
- "Macro photography of a mechanical watch gear mechanism where the gears are made of tiny, glowing city buildings, depth of field focusing on the intricate clockwork city, cool blue bioluminescence against deep brass shadows, steampunk meets cyberpunk, ultra-detailed."

Now, read the content and act as the Visionary Director.`;

    let contextPrompt = '';

    if (userContext.profile) {
      contextPrompt += `\n\nUSER CONTEXT (Apply these preferences):\n`;

      if (userContext.profile.style_preferences) {
        contextPrompt += `User Style Preference: ${userContext.profile.style_preferences}\n`;
      }

      // Add liked styles
      if (userContext.likedStyles && userContext.likedStyles.length > 0) {
        contextPrompt += `\nUser LIKES these image styles (apply these):\n`;
        userContext.likedStyles.slice(0, 5).forEach((memory) => {
          const summary = memory.context_metadata?.style_summary || memory.content.substring(0, 100);
          contextPrompt += `- ${summary}\n`;
        });
      }

      // Add disliked styles
      if (userContext.dislikedStyles && userContext.dislikedStyles.length > 0) {
        contextPrompt += `\nUser DISLIKES these image styles (avoid these):\n`;
        userContext.dislikedStyles.slice(0, 3).forEach((memory) => {
          const whyDisliked = memory.context_metadata?.why_disliked || 'User disliked this style';
          const alternative = memory.context_metadata?.preferred_alternative || '';
          contextPrompt += `- Avoid: ${whyDisliked}\n`;
          if (alternative) {
            contextPrompt += `  Instead: ${alternative}\n`;
          }
        });
      }
    }

    const fullPrompt = `${systemPrompt}${contextPrompt}

User's Content Idea: "${rawText}"

Generate the Detailed Studio-Quality Image Prompt now:`;

    return await aiService.generateContent(fullPrompt);
  }

  /**
   * Upload image buffer to Supabase Storage
   */


  /**
   * Get dimensions for a platform or use defaults
   */
  getPlatformDimensions(platform?: string): { width: number; height: number } {
    if (platform && PLATFORM_DIMENSIONS[platform]) {
      return PLATFORM_DIMENSIONS[platform];
    }
    return PLATFORM_DIMENSIONS.default;
  }

  /**
   * Generate image using Gemini-enhanced prompt and render via image generation API
   * Supports platform-specific dimensions and Supabase storage
   */
  async generateImage(
    prompt: string,
    userId?: number,
    width?: number,
    height?: number,
    platform?: string
  ): Promise<{ enhancedPrompt: string; imageUrl?: string; platform?: string }> {
    const enhancedPrompt = await this.enhanceTextForImageGeneration(prompt, userId, platform);

    // Determine dimensions: use provided, platform-specific, or default
    let finalWidth = width;
    let finalHeight = height;

    if (!finalWidth || !finalHeight) {
      const platformDims = this.getPlatformDimensions(platform);
      finalWidth = finalWidth || platformDims.width;
      finalHeight = finalHeight || platformDims.height;
    }

    try {
      console.log(`[ImageGenerator] Generating image for prompt: ${enhancedPrompt.substring(0, 50)}... (${finalWidth}x${finalHeight}, platform: ${platform || 'none'})`);

      // Use Imagen 4.0 via Vertex AI
      // Note: We use the aiService wrapper which generates the image buffer directly
      const buffer = await aiService.generateImage(enhancedPrompt, finalWidth, finalHeight);

      // Convert buffer to Base64 Data URL
      // This avoids file system issues and ensures immediate availability
      const base64Image = buffer.toString('base64');
      const mimeType = 'image/jpeg'; // Assuming JPEG from aiService, change if PNG
      const imageUrl = `data:${mimeType};base64,${base64Image}`;
      
      console.log(`[ImageGenerator] Generated image as Base64 Data URL`);

      return {
        enhancedPrompt,
        imageUrl,
        platform: platform || undefined,
      };
    } catch (error) {
      console.error('Error generating image:', error);
      // Return enhanced prompt even if image generation fails
      return {
        enhancedPrompt,
        platform: platform || undefined,
      };
    }
  }
}

export const imageGenerator = new ImageGenerator();
