import { aiService } from './aiService';
import { userProfileService } from './userProfileService';
import { userMemoryService, MEMORY_TYPES } from './userMemoryService';
import { supabase, isDatabaseAvailable } from '../db/client';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import sharp from 'sharp';

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
    const compositionRules = platform ? this.getPlatformCompositionRules(platform) : '';
    const userProfileContext = userContext.profile ? this.getUserProfileImageContext(userContext.profile) : '';
    const likedStylesContext = userContext.likedStyles && userContext.likedStyles.length > 0
      ? `USER PREFERRED STYLES: ${userContext.likedStyles.slice(0, 5).map((s: any) => s.context_metadata?.style_summary || s.content).join('; ')}`
      : '';
    const dislikedStylesContext = userContext.dislikedStyles && userContext.dislikedStyles.length > 0
      ? `STYLES TO AVOID: ${userContext.dislikedStyles.slice(0, 3).map((s: any) => s.context_metadata?.why_disliked || s.content).join('; ')}`
      : '';

    const enhancedPrompt = `SYSTEM ROLE: You are an elite visual prompt engineer specializing in professional marketing imagery for social media.

═══════════════════════════════════════════════════════════════
USER'S CONTENT/REQUEST:
"${rawText}"
═══════════════════════════════════════════════════════════════

${platformContext}
${compositionRules}
${userProfileContext}
${likedStylesContext}
${dislikedStylesContext}

═══════════════════════════════════════════════════════════════
PROMPT ENGINEERING FRAMEWORK
═══════════════════════════════════════════════════════════════

STEP 1 - SUBJECT EXTRACTION:
Identify the core subject from the user's request:
- Main subject: What is the primary focus? (person, product, concept, scene)
- Secondary elements: Supporting objects or background elements
- Action/State: Is there movement or a static scene?

STEP 2 - VISUAL STYLE ANCHORS:
Apply ONE primary style from these professional categories:
• CORPORATE: Clean, minimal, professional lighting, neutral tones with brand color accents
• LIFESTYLE: Authentic, candid, warm natural lighting, relatable scenarios
• PREMIUM: Luxurious, high-end, dramatic lighting, rich textures, elegant composition
• DYNAMIC: Bold, energetic, high contrast, action-oriented, vibrant colors
• EDITORIAL: Magazine-quality, artistic, creative angles, strong visual narrative

STEP 3 - TECHNICAL PHOTOGRAPHY SPECIFICATIONS:
Include these professional elements:
- Camera perspective: (eye-level, aerial view, close-up macro, wide establishing shot)
- Lighting setup: (soft diffused light, golden hour warmth, studio three-point lighting, dramatic side lighting)
- Depth of field: (shallow bokeh for subject focus, deep focus for scenes)
- Color grading: (specific palette, e.g., "warm amber and teal", "monochromatic blue")

STEP 4 - QUALITY BOOSTERS (Always Include):
Add these terms for higher quality output:
"8K resolution, ultra-detailed, professional photography, sharp focus, high dynamic range, masterfully composed"

STEP 5 - NEGATIVE GUIDANCE (What to Avoid):
The image should NOT have:
- Distorted or extra fingers/hands
- Blurry or low-resolution areas
- Artificial-looking skin or textures
- Text, watermarks, or logos embedded in the image
- Cluttered or confusing compositions
- Oversaturated or unnatural colors

═══════════════════════════════════════════════════════════════
OUTPUT REQUIREMENTS
═══════════════════════════════════════════════════════════════

OUTPUT FORMAT:
Combine all elements into ONE cohesive, flowing prompt (2-4 sentences max).
Structure: [Subject + Action] + [Style Anchor] + [Technical Specs] + [Quality Boosters]

EXAMPLE OUTPUT:
"A confident business professional in a modern glass office, reviewing analytics on a tablet, captured in premium corporate style with soft diffused natural lighting from floor-to-ceiling windows. Cool blue and warm amber color grading, shallow depth of field focusing on subject's engaged expression. 8K resolution, ultra-detailed, professional photography, masterfully composed."

═══════════════════════════════════════════════════════════════
YOUR ENHANCED PROMPT (Only output the prompt, nothing else):`;

    try {
      const result = await aiService.generateContent(enhancedPrompt);
      // Clean up the result - remove any markdown, quotes, or extra formatting
      let cleanedResult = result.trim();
      // Remove leading/trailing quotes if present
      if ((cleanedResult.startsWith('"') && cleanedResult.endsWith('"')) ||
        (cleanedResult.startsWith("'") && cleanedResult.endsWith("'"))) {
        cleanedResult = cleanedResult.slice(1, -1);
      }
      return cleanedResult;
    } catch (error) {
      console.error('Error enhancing prompt:', error);
      return rawText; // Fallback to original text
    }
  }

  /**
   * Get platform-specific composition rules for optimal image layout
   */
  private getPlatformCompositionRules(platform: string): string {
    const rules: Record<string, string> = {
      linkedin: `LINKEDIN COMPOSITION RULES:
• Rule of thirds with subject on left or center
• Leave clean space on right side for potential text overlays
• Professional headroom above subjects
• Avoid cluttered backgrounds - use soft blurred office/professional environments
• Optimal for landscape format (1200x627)`,

      twitter: `TWITTER/X COMPOSITION RULES:
• High-impact visual with immediate attention grab
• Center-weighted or dynamic diagonal composition
• Bold, contrasting elements that stand out in feed
• Works in both light and dark mode
• Square or landscape format (1200x675)`,

      instagram: `INSTAGRAM COMPOSITION RULES:
• Visually striking, scroll-stopping imagery
• Strong central focal point
• Aesthetically pleasing with lifestyle appeal
• Consider Stories format compatibility
• Square format preferred (1080x1080)`,

      facebook: `FACEBOOK COMPOSITION RULES:
• Community-friendly, relatable imagery
• Warm, inviting tones
• Clear focal point visible even at small preview size
• Consider mobile-first viewing
• Landscape format (1200x630)`
    };
    return rules[platform] || '';
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

  /**
   * Modify an existing image based on user instructions
   * For logo additions: Uses exact existing image + logo overlay (NO regeneration)
   * For other modifications: Regenerates image with modified prompt
   */
  async modifyImage(
    currentImageUrl: string,
    originalPrompt: string,
    instructions: string,
    platform?: string,
    logoBase64?: string,
    logoMimeType?: string,
    userId?: string,
    logoPosition?: { x: number; y: number; scale: number; removeBackground?: boolean },
    logos?: Array<{ id: string; base64: string; mimeType: string; x: number; y: number; scale: number; removeBackground?: boolean }>
  ): Promise<{ enhancedPrompt: string; imageUrl?: string; platform?: string }> {
    console.log('[ImageGenerator] Starting image modification...');
    console.log('[ImageGenerator] Current image URL:', currentImageUrl?.substring(0, 100));
    console.log('[ImageGenerator] Has logo:', !!logoBase64);
    console.log('[ImageGenerator] Has logos array:', logos?.length || 0);
    console.log('[ImageGenerator] Instructions:', instructions);
    console.log('[ImageGenerator] Logo position:', logoPosition);

    // Check for multiple logos first (new multi-logo feature)
    if (logos && logos.length > 0) {
      console.log('[ImageGenerator] Detected MULTI-LOGO modification - compositing', logos.length, 'logos');
      return await this.addMultipleLogosToExistingImage(currentImageUrl, logos, originalPrompt, platform, userId);
    }

    // Detect if this is a logo-only modification (user just wants to add logo to existing image)
    // Also trigger if logoPosition is provided (user used the editor)
    const isLogoOnlyModification = logoBase64 && (logoPosition || this.isLogoOnlyRequest(instructions));

    if (isLogoOnlyModification) {
      console.log('[ImageGenerator] Detected LOGO-ONLY modification - using exact existing image');
      return await this.addLogoToExistingImage(currentImageUrl, logoBase64, originalPrompt, platform, userId, logoPosition);
    }

    // For non-logo modifications, analyze and regenerate
    console.log('[ImageGenerator] Full modification requested - will regenerate image');

    // Step 1: Analyze the current image
    let imageAnalysis = '';
    try {
      imageAnalysis = await aiService.analyzeImage(currentImageUrl);
      console.log('[ImageGenerator] Image analysis complete');
    } catch (error) {
      console.warn('[ImageGenerator] Could not analyze image, using original prompt only');
    }

    // Step 2: Analyze logo if provided
    let logoDescription = '';
    if (logoBase64) {
      try {
        logoDescription = await aiService.analyzeLogo(logoBase64, logoMimeType || 'image/png');
        console.log('[ImageGenerator] Logo analysis complete. Description:', logoDescription.substring(0, 200) + '...');
      } catch (error) {
        console.warn('[ImageGenerator] Could not analyze logo:', error);
      }
    } else {
      console.log('[ImageGenerator] No logo provided for this modification');
    }

    // Step 3: Build enhanced modification prompt
    const compositionRules = platform ? this.getPlatformCompositionRules(platform) : '';

    const modificationPrompt = `SYSTEM ROLE: You are an elite visual prompt engineer specializing in image modifications for professional marketing.

═══════════════════════════════════════════════════════════════
MODIFICATION TASK
═══════════════════════════════════════════════════════════════

ORIGINAL IMAGE PROMPT:
${originalPrompt}

CURRENT IMAGE ANALYSIS:
${imageAnalysis || 'Not available - use original prompt as reference'}

USER'S MODIFICATION REQUEST:
"${instructions}"

${compositionRules}

${logoDescription ? `═══════════════════════════════════════════════════════════════
⚠️ LOGO COMPOSITION CONTEXT (CRITICAL)
═══════════════════════════════════════════════════════════════
The system will programmatically overlay a logo in the BOTTOM-RIGHT corner after generation.
Logo Description: ${logoDescription}

LOGO INTEGRATION RULES:
1. DO NOT generate the logo yourself - the system handles the actual overlay
2. Reserve the BOTTOM-RIGHT corner (approximately 15% of image width)
3. Ensure that area has good contrast for logo visibility
4. Place all critical elements away from bottom-right corner` : ''}

═══════════════════════════════════════════════════════════════
MODIFICATION RULES
═══════════════════════════════════════════════════════════════

PRESERVE:
• Core subject and composition structure
• Overall style anchor (corporate, lifestyle, premium, etc.)
• Color palette (unless user explicitly requests changes)
• Image quality and professional appearance

APPLY:
• User's requested modifications
• ${logoDescription ? 'Logo-safe composition with clear bottom-right corner' : 'Same overall mood and visual tone'}

QUALITY BOOSTERS (Always Include):
"8K resolution, ultra-detailed, professional photography, sharp focus, high dynamic range, masterfully composed"

═══════════════════════════════════════════════════════════════
OUTPUT REQUIREMENTS
═══════════════════════════════════════════════════════════════

OUTPUT FORMAT:
Return ONE cohesive prompt (2-4 sentences) that recreates the image with modifications applied.
Structure: [Modified Subject + Action] + [Style] + [Technical Specs] + [Quality Boosters]

YOUR MODIFIED PROMPT (Only output the prompt, nothing else):`;

    // Step 4: Generate the modified prompt
    let newPrompt: string;
    try {
      newPrompt = await aiService.generateContent(modificationPrompt);
      // Clean up the result
      newPrompt = newPrompt.trim();
      if ((newPrompt.startsWith('"') && newPrompt.endsWith('"')) ||
        (newPrompt.startsWith("'") && newPrompt.endsWith("'"))) {
        newPrompt = newPrompt.slice(1, -1);
      }
    } catch (error) {
      console.error('[ImageGenerator] Failed to generate modification prompt');
      throw new Error('Failed to create modified image prompt');
    }

    // Step 5: Generate the new image
    const dimensions = this.getPlatformDimensions(platform);

    try {
      let imageBuffer = await aiService.generateImage(newPrompt, dimensions.width, dimensions.height);

      // Step 6: Composite actual logo if provided (Exact Placement)
      if (logoBase64) {
        try {
          console.log('[ImageGenerator] Compositing logo onto generated image...');
          imageBuffer = await this.compositeLogo(imageBuffer, logoBase64);
        } catch (compositeError) {
          console.error('[ImageGenerator] Failed to composite logo:', compositeError);
          // Continue with original image if composition fails
        }
      }

      // Store in Supabase if userId provided
      if (userId && isDatabaseAvailable()) {
        try {
          const fileName = `modified_${Date.now()}_${Math.random().toString(36).substr(2, 9)}.png`;
          const filePath = `${userId}/${fileName}`;

          const { error: uploadError } = await supabase!
            .storage
            .from('images')
            .upload(filePath, imageBuffer, {
              contentType: 'image/png',
              upsert: false
            });

          if (!uploadError) {
            const { data: { publicUrl } } = supabase!
              .storage
              .from('images')
              .getPublicUrl(filePath);

            console.log(`[ImageGenerator] Modified image uploaded: ${publicUrl}`);
            return { enhancedPrompt: newPrompt, imageUrl: publicUrl, platform };
          }
        } catch (storageError) {
          console.warn('[ImageGenerator] Storage error:', storageError);
        }
      }

      // Return as data URL if no storage
      const base64Image = imageBuffer.toString('base64');
      const dataUrl = `data:image/png;base64,${base64Image}`;

      return { enhancedPrompt: newPrompt, imageUrl: dataUrl, platform };

    } catch (error: any) {
      console.error('[ImageGenerator] Modified image generation failed:', error);
      throw new Error(`Failed to generate modified image: ${error.message}`);
    }
  }

  /**
   * Check if the modification request is logo-only (add logo to existing image)
   */
  private isLogoOnlyRequest(instructions: string): boolean {
    const lowerInstructions = instructions.toLowerCase();
    const logoKeywords = [
      'add logo', 'add my logo', 'add the logo', 'put logo', 'place logo',
      'add this logo', 'logo on', 'logo in', 'overlay logo', 'include logo',
      'logo bottom', 'logo corner', 'logo right', 'with logo', 'with my logo',
      'add branding', 'add brand', 'add watermark'
    ];

    // Check if instructions primarily mention adding a logo
    const hasLogoKeyword = logoKeywords.some(kw => lowerInstructions.includes(kw));

    // Check if instructions are short (likely just "add logo")
    const isShortInstruction = instructions.length < 100;

    // If it's a short instruction with logo keywords, treat as logo-only
    if (hasLogoKeyword && isShortInstruction) {
      return true;
    }

    // If instructions just mention logo placement, it's logo-only
    if (hasLogoKeyword && !lowerInstructions.includes('change') && !lowerInstructions.includes('modify')
      && !lowerInstructions.includes('different') && !lowerInstructions.includes('new')) {
      return true;
    }

    return false;
  }

  /**
   * Add MULTIPLE logos to existing image WITHOUT regenerating
   * Composites each logo in the array onto the base image
   */
  private async addMultipleLogosToExistingImage(
    imageUrl: string,
    logos: Array<{ id: string; base64: string; mimeType: string; x: number; y: number; scale: number; removeBackground?: boolean }>,
    originalPrompt: string,
    platform?: string,
    userId?: string
  ): Promise<{ enhancedPrompt: string; imageUrl?: string; platform?: string }> {
    console.log('[ImageGenerator] Fetching existing image for multi-logo compositing...');
    console.log('[ImageGenerator] Processing', logos.length, 'logos');

    try {
      // Step 1: Fetch the existing image
      let imageBuffer: Buffer;

      if (imageUrl.startsWith('data:')) {
        // Handle data URL (testing/preview)
        const base64Data = imageUrl.split(',')[1];
        imageBuffer = Buffer.from(base64Data, 'base64');
      } else {
        // Fetch from URL
        const response = await fetch(imageUrl);
        if (!response.ok) {
          throw new Error(`Failed to fetch image: ${response.status} ${response.statusText}`);
        }
        const arrayBuffer = await response.arrayBuffer();
        imageBuffer = Buffer.from(arrayBuffer);
      }

      // Step 2: Composite ALL logos onto the image
      let currentBuffer = imageBuffer;

      // We process logos sequentially to maintain layering order (first in array = bottom)
      for (const logo of logos) {
        console.log(`[ImageGenerator] Compositing logo ${logo.id} at ${logo.x}%, ${logo.y}% scale ${logo.scale}`);
        currentBuffer = await this.compositeLogo(currentBuffer, logo.base64, {
          x: logo.x,
          y: logo.y,
          scale: logo.scale,
          removeBackground: logo.removeBackground
        });
      }

      const modifiedBuffer = currentBuffer;
      console.log('[ImageGenerator] All logos composited successfully');

      // Step 3: Upload to Supabase
      if (userId && isDatabaseAvailable()) {
        try {
          const fileName = `logos_added_${Date.now()}_${Math.random().toString(36).substr(2, 9)}.png`;
          const filePath = `${userId}/${fileName}`;

          const { error: uploadError } = await supabase!
            .storage
            .from('images')
            .upload(filePath, modifiedBuffer, {
              contentType: 'image/png',
              upsert: false
            });

          if (!uploadError) {
            const { data: { publicUrl } } = supabase!
              .storage
              .from('images')
              .getPublicUrl(filePath);

            return {
              enhancedPrompt: originalPrompt,
              imageUrl: publicUrl,
              platform
            };
          } else {
            console.error('[ImageGenerator] Supabase upload failed:', uploadError);
          }
        } catch (dbError) {
          console.error('[ImageGenerator] Database operation failed:', dbError);
        }
      }

      // Fallback: Return base64 if upload fails or no user
      const base64Image = `data:image/png;base64,${modifiedBuffer.toString('base64')}`;
      return {
        enhancedPrompt: originalPrompt,
        imageUrl: base64Image,
        platform
      };

    } catch (error) {
      console.error('[ImageGenerator] Error adding multiple logos:', error);
      throw new Error(`Failed to add logos to image: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Add logo to existing image WITHOUT regenerating
   * Fetches the exact image from URL and composites logo on top
   */
  private async addLogoToExistingImage(
    imageUrl: string,
    logoBase64: string,
    originalPrompt: string,
    platform?: string,
    userId?: string,
    logoPosition?: { x: number; y: number; scale: number }
  ): Promise<{ enhancedPrompt: string; imageUrl?: string; platform?: string }> {
    console.log('[ImageGenerator] Fetching existing image from URL...');
    console.log('[ImageGenerator] Using custom logo position:', logoPosition);

    try {
      // Step 1: Fetch the existing image
      let imageBuffer: Buffer;

      if (imageUrl.startsWith('data:')) {
        // Handle data URL
        const base64Data = imageUrl.split(',')[1];
        imageBuffer = Buffer.from(base64Data, 'base64');
        console.log('[ImageGenerator] Decoded data URL image');
      } else {
        // Fetch from URL (Supabase or other)
        const response = await fetch(imageUrl);
        if (!response.ok) {
          throw new Error(`Failed to fetch image: ${response.status} ${response.statusText}`);
        }
        const arrayBuffer = await response.arrayBuffer();
        imageBuffer = Buffer.from(arrayBuffer);
        console.log('[ImageGenerator] Fetched image from URL, size:', imageBuffer.length);
      }

      // Step 2: Composite the logo onto the exact existing image
      console.log('[ImageGenerator] Compositing logo onto existing image (pixel-perfect)...');
      const modifiedBuffer = await this.compositeLogo(imageBuffer, logoBase64, logoPosition);
      console.log('[ImageGenerator] Logo composited successfully');

      // Step 3: Upload to Supabase
      if (userId && isDatabaseAvailable()) {
        try {
          const fileName = `logo_added_${Date.now()}_${Math.random().toString(36).substr(2, 9)}.png`;
          const filePath = `${userId}/${fileName}`;

          const { error: uploadError } = await supabase!
            .storage
            .from('images')
            .upload(filePath, modifiedBuffer, {
              contentType: 'image/png',
              upsert: false
            });

          if (!uploadError) {
            const { data: { publicUrl } } = supabase!
              .storage
              .from('images')
              .getPublicUrl(filePath);

            console.log(`[ImageGenerator] Logo-added image uploaded: ${publicUrl}`);
            return {
              enhancedPrompt: originalPrompt + ' [Logo added]',
              imageUrl: publicUrl,
              platform
            };
          } else {
            console.warn('[ImageGenerator] Upload error:', uploadError);
          }
        } catch (storageError) {
          console.warn('[ImageGenerator] Storage error:', storageError);
        }
      }

      // Fallback to data URL if no storage
      const base64Image = modifiedBuffer.toString('base64');
      const dataUrl = `data:image/png;base64,${base64Image}`;

      return {
        enhancedPrompt: originalPrompt + ' [Logo added]',
        imageUrl: dataUrl,
        platform
      };

    } catch (error: any) {
      console.error('[ImageGenerator] Failed to add logo to existing image:', error);
      throw new Error(`Failed to add logo to image: ${error.message}`);
    }
  }

  /**
   * Composite a logo onto a background image
   * Includes automatic background removal for the logo
   */
  private async compositeLogo(
    backgroundBuffer: Buffer,
    logoBase64: string,
    logoPosition?: { x: number; y: number; scale: number; removeBackground?: boolean }
  ): Promise<Buffer> {
    const logoBuffer = Buffer.from(logoBase64, 'base64');

    // Get background dimensions
    const bgMetadata = await sharp(backgroundBuffer).metadata();
    const bgWidth = bgMetadata.width || 1024;
    const bgHeight = bgMetadata.height || 1024;

    // Use custom scale or default to 15% of background width
    const scale = logoPosition?.scale ?? 0.15;
    const targetLogoWidth = Math.round(bgWidth * scale);

    // Step 1: Handle Background (Smart Removal vs Original)
    let logoToComposite = logoBuffer;

    // If user explicitly requests background removal
    if (logoPosition?.removeBackground) {
      console.log('[ImageGenerator] Performing smart background removal...');
      try {
        logoToComposite = await this.removeLogoBackground(logoBuffer);
        // Ensure PNG format for transparency
        logoToComposite = await sharp(logoToComposite).png().toBuffer();
      } catch (e) {
        console.error('[ImageGenerator] Smart background removal failed, falling back to original', e);
      }
    }

    // Step 2: Resize logo based on scale
    const resizedLogo = await sharp(logoToComposite)
      .resize({ width: targetLogoWidth })
      .png() // Ensure PNG for transparency
      .toBuffer();

    const logoMetadata = await sharp(resizedLogo).metadata();
    const logoWidth = logoMetadata.width || targetLogoWidth;
    const logoHeight = logoMetadata.height || 0;

    // Calculate position
    let left: number;
    let top: number;

    if (logoPosition) {
      // User-specified position (percentage-based, centered on the point)
      left = Math.round((logoPosition.x / 100) * bgWidth - logoWidth / 2);
      top = Math.round((logoPosition.y / 100) * bgHeight - logoHeight / 2);

      // Clamp to image bounds
      left = Math.max(0, Math.min(bgWidth - logoWidth, left));
      top = Math.max(0, Math.min(bgHeight - logoHeight, top));
    } else {
      // Default: Bottom-Right with padding
      const padding = Math.round(bgWidth * 0.03); // 3% padding
      left = bgWidth - logoWidth - padding;
      top = bgHeight - logoHeight - padding;
    }

    console.log('[ImageGenerator] Compositing logo at position:', { left, top, width: logoWidth, height: logoHeight });

    // Composite with standard overlay (transparency is now baked into the image)
    return await sharp(backgroundBuffer)
      .composite([{
        input: resizedLogo,
        top: top,
        left: left,
        blend: 'over'
      }])
      .toBuffer();
  }

  /**
   * Remove background from a logo image
   * Detects the background color and makes it transparent
   */
  private async removeLogoBackground(logoBuffer: Buffer): Promise<Buffer> {
    try {
      // Get logo metadata
      const metadata = await sharp(logoBuffer).metadata();
      const width = metadata.width || 100;
      const height = metadata.height || 100;

      // Extract raw pixel data
      const { data, info } = await sharp(logoBuffer)
        .ensureAlpha()
        .raw()
        .toBuffer({ resolveWithObject: true });

      // Sample corners to detect background color (most common approach)
      const sampleSize = Math.max(3, Math.round(Math.min(width, height) * 0.05));
      const cornerSamples: { r: number; g: number; b: number }[] = [];

      // Sample from all 4 corners
      const corners = [
        { x: 0, y: 0 },                    // Top-left
        { x: width - sampleSize, y: 0 },   // Top-right
        { x: 0, y: height - sampleSize },  // Bottom-left
        { x: width - sampleSize, y: height - sampleSize } // Bottom-right
      ];

      for (const corner of corners) {
        for (let dy = 0; dy < sampleSize; dy++) {
          for (let dx = 0; dx < sampleSize; dx++) {
            const x = Math.min(corner.x + dx, width - 1);
            const y = Math.min(corner.y + dy, height - 1);
            const idx = (y * width + x) * 4;
            cornerSamples.push({
              r: data[idx],
              g: data[idx + 1],
              b: data[idx + 2]
            });
          }
        }
      }

      // Find the most common color (likely background)
      const colorCounts = new Map<string, { count: number; r: number; g: number; b: number }>();
      for (const sample of cornerSamples) {
        // Quantize to reduce noise (group similar colors)
        const key = `${Math.round(sample.r / 10) * 10}-${Math.round(sample.g / 10) * 10}-${Math.round(sample.b / 10) * 10}`;
        const existing = colorCounts.get(key);
        if (existing) {
          existing.count++;
        } else {
          colorCounts.set(key, { count: 1, ...sample });
        }
      }

      // Get the most frequent color
      let bgColor = { r: 255, g: 255, b: 255 }; // Default to white
      let maxCount = 0;
      for (const [, value] of colorCounts) {
        if (value.count > maxCount) {
          maxCount = value.count;
          bgColor = { r: value.r, g: value.g, b: value.b };
        }
      }

      console.log(`[ImageGenerator] Detected logo background color: RGB(${bgColor.r}, ${bgColor.g}, ${bgColor.b})`);

      // Create new buffer with transparency where background color matches
      const newData = Buffer.alloc(data.length);

      // Determine if background is "White" (high luminance) to be more aggressive
      const isWhite = bgColor.r > 240 && bgColor.g > 240 && bgColor.b > 240;
      const tolerance = isWhite ? 60 : 50; // Higher tolerance for white due to compression artifacts

      for (let i = 0; i < data.length; i += 4) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        const a = data[i + 3];

        // Euclidean distance check
        const dist = Math.sqrt(
          Math.pow(r - bgColor.r, 2) +
          Math.pow(g - bgColor.g, 2) +
          Math.pow(b - bgColor.b, 2)
        );

        if (dist < tolerance) {
          // Transparent
          newData[i] = r;
          newData[i + 1] = g;
          newData[i + 2] = b;
          newData[i + 3] = 0;
        } else if (dist < tolerance + 20) {
          // Soft edge (feather)
          const alphaFactor = ((dist - tolerance) / 20);
          newData[i] = r;
          newData[i + 1] = g;
          newData[i + 2] = b;
          newData[i + 3] = Math.round(Math.min(a, alphaFactor * 255));
        } else {
          // Keep original
          newData[i] = r;
          newData[i + 1] = g;
          newData[i + 2] = b;
          newData[i + 3] = a;
        }
      }

      return await sharp(newData, {
        raw: {
          width: info.width,
          height: info.height,
          channels: 4
        }
      }).png().toBuffer();

    } catch (error) {
      console.error('[ImageGenerator] Error removing logo background:', error);
      return logoBuffer; // Return original on error
    }
  }
}

export const imageGenerator = new ImageGenerator();
