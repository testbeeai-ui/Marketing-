import { aiService } from './aiService';
import { userProfileService } from './userProfileService';
import { userMemoryService, MEMORY_TYPES } from './userMemoryService';
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
    userId?: string, // Changed from number to string
    platform?: string
  ): Promise<string> {
    const userContext: {
      profile?: any;
      likedStyles?: unknown[];
      dislikedStyles?: unknown[];
    } = {};

    if (userId) {
      try {
        const profile = await userProfileService.getUserProfile(userId);
        if (profile) {
          userContext.profile = profile;
        }

        // Get user memory for image styles
        const likedStyles = await userMemoryService.getMemoriesByType(userId, MEMORY_TYPES.LIKED_IMAGE_STYLE);
        const dislikedStyles = await userMemoryService.getMemoriesByType(userId, MEMORY_TYPES.DISLIKED_IMAGE_STYLE);
        userContext.likedStyles = likedStyles;
        userContext.dislikedStyles = dislikedStyles;
      } catch (error) {
        console.error('Error loading user context:', error);
      }
    }

    const enhancedPrompt = await this.buildEnhancedPrompt(rawText, userContext, platform);
    return enhancedPrompt;
  }

  private async buildEnhancedPrompt(
    rawText: string,
    userContext: { profile?: any; likedStyles?: unknown[]; dislikedStyles?: unknown[] },
    platform?: string
  ): Promise<string> {
    const platformContext = platform ? this.getPlatformImageContext(platform) : '';
    const userProfileContext = userContext.profile ? this.getUserProfileImageContext(userContext.profile) : '';
    const likedStylesContext = userContext.likedStyles && userContext.likedStyles.length > 0
      ? `User likes these visual styles: ${userContext.likedStyles.map((s: any) => s.context_metadata?.style_summary || s.content).join(', ')}`
      : '';
    const dislikedStylesContext = userContext.dislikedStyles && userContext.dislikedStyles.length > 0
      ? `User dislikes these visual styles: ${userContext.dislikedStyles.map((s: any) => s.context_metadata?.why_disliked || s.content).join(', ')}`
      : '';

    const enhancedPrompt = `SYSTEM ROLE: You are a world-class visual prompt engineer specializing in marketing imagery.

USER REQUEST: "${rawText}"

${platformContext}
${userProfileContext}
${likedStylesContext}
${dislikedStylesContext}

ENHANCEMENT TASK:
Transform the user's request into a detailed, high-quality image generation prompt that will create compelling marketing visuals.

ENHANCEMENT RULES:
1. Add specific visual details (lighting, composition, style)
2. Include color palette recommendations
3. Specify image dimensions and aspect ratio
4. Add technical photography/art terms
5. Ensure the prompt is optimized for AI image generation
6. Keep the prompt concise but comprehensive

OUTPUT FORMAT:
Return ONLY the enhanced prompt text, no additional commentary.

Enhanced prompt:`;

    try {
      const result = await aiService.generateContent(enhancedPrompt);
      return result.trim();
    } catch (error) {
      console.error('Error enhancing prompt:', error);
      return rawText; // Fallback to original text
    }
  }

  private getPlatformImageContext(platform: string): string {
    const contexts: Record<string, string> = {
      linkedin: 'LINKEDIN CONTEXT: Professional, clean, business-oriented imagery. Corporate color schemes. Minimal text overlay.',
      twitter: 'TWITTER CONTEXT: Eye-catching, scroll-stopping visuals. Bold colors. Can include text overlay. Square or landscape format.',
      instagram: 'INSTAGRAM CONTEXT: Aesthetic, visually appealing. Lifestyle-focused. Can use filters and effects. Square format preferred.',
      facebook: 'FACEBOOK CONTEXT: Community-focused, relatable imagery. Warm tones. Can include text overlay. Various formats supported.'
    };
    return contexts[platform] || '';
  }

  private getUserProfileImageContext(profile: any): string {
    const context: string[] = [];
    if (profile.industry) context.push(`Industry: ${profile.industry}`);
    if (profile.target_audience) context.push(`Target Audience: ${profile.target_audience}`);
    if (profile.brand_voice) context.push(`Brand Voice: ${profile.brand_voice}`);
    return context.length > 0 ? `USER PROFILE: ${context.join(', ')}` : '';
  }

  private getPlatformDimensions(platform?: string): { width: number; height: number } {
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
    userId?: string, // Changed from number to string
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
      // Generate image using AI service (returns Buffer)
      const imageBuffer = await aiService.generateImage(enhancedPrompt, finalWidth, finalHeight);

      // Store in Supabase if userId provided and database available
      if (userId && isDatabaseAvailable()) {
        try {
          const fileName = `image_${Date.now()}_${Math.random().toString(36).substr(2, 9)}.png`;
          const filePath = `${userId}/${fileName}`;
          
          // Upload the Buffer directly to Supabase Storage
          const { data: uploadData, error: uploadError } = await supabase!
            .storage
            .from('images')
            .upload(filePath, imageBuffer, {
              contentType: 'image/png',
              upsert: false
            });

          if (uploadError) {
            console.warn(`[ImageGenerator] Failed to upload image to Supabase: ${uploadError.message}`);
            // Continue without storing
          } else {
            // Get public URL
            const { data: { publicUrl } } = supabase!
              .storage
              .from('images')
              .getPublicUrl(filePath);

            console.log(`[ImageGenerator] Image uploaded to Supabase: ${publicUrl}`);
            return { enhancedPrompt, imageUrl: publicUrl, platform };
          }
        } catch (storageError) {
          console.warn('[ImageGenerator] Supabase storage error:', storageError);
          // Continue without storing
        }
      }

      // If no Supabase storage or upload failed, return data URL
      const base64Image = imageBuffer.toString('base64');
      const dataUrl = `data:image/png;base64,${base64Image}`;
      
      console.log(`[ImageGenerator] Image generated as data URL (${base64Image.length} bytes)`);
      return { enhancedPrompt, imageUrl: dataUrl, platform };

    } catch (error: any) {
      console.error('[ImageGenerator] Image generation failed:', error);
      throw new Error(`Failed to generate image: ${error.message}`);
    }
  }
}

export const imageGenerator = new ImageGenerator();