import { aiService } from './aiService';
import { storyCache } from './storyCache';
import { userProfileService, type UserProfile } from './userProfileService';
import { userMemoryService } from './userMemoryService';

interface PlatformContentRequest {
  storyId?: string;
  storyContent?: string; // Raw story content if storyId is not provided
  platforms: ('linkedin' | 'twitter' | 'instagram' | 'facebook')[];
  userId?: number;
  imageContext?: Record<string, { enhancedPrompt: string; imageUrl?: string }>; // Platform -> image info
}

interface PlatformContent {
  platform: string;
  content: string;
}

export class ContentCreator {
  async generateContent({ storyId, storyContent, platforms, userId, imageContext }: PlatformContentRequest): Promise<Record<string, string>> {
    let baseContent: string;

    if (storyId) {
      // 1. Retrieve story from cache
      const story = storyCache.get(storyId);
      if (!story) {
        throw new Error('Story not found');
      }
      // Use the variation content based on the selected story content
      baseContent = Object.values(story.variations)[0];
    } else if (storyContent) {
      // Use the provided story content directly
      baseContent = storyContent;
    } else {
      throw new Error('Either storyId or storyContent must be provided');
    }

    const results: Record<string, string> = {};

    // Get user context if userId provided
    const userContext: {
      profile?: UserProfile;
      likedStyles?: unknown[];
      dislikedStyles?: unknown[];
    } = {};

    if (userId) {
      try {
        const profile = await userProfileService.getUserProfile(userId);
        if (profile) {
          userContext.profile = profile;
        }
      } catch (error) {
        console.error('Error loading user profile:', error);
      }
    }

    // 2. Generate content for each platform with user context and image context
    await Promise.all(
      platforms.map(async (platform) => {
        try {
          const imageInfo = imageContext?.[platform];
          const prompt = await this.buildPrompt(platform, baseContent, userContext, imageInfo);
          const content = await aiService.generateContent(prompt);
          results[platform] = this.formatContent(platform, content);
        } catch (error) {
          console.error(`Error generating content for ${platform}:`, error);
          results[platform] = 'Failed to generate content.';
        }
      })
    );

    return results;
  }

  private async buildPrompt(
    platform: string,
    content: string,
    userContext: { profile?: UserProfile; likedStyles?: unknown[]; dislikedStyles?: unknown[] },
    imageInfo?: { enhancedPrompt: string; imageUrl?: string }
  ): Promise<string> {
    const limits: Record<string, number> = {
      linkedin: 3000,
      twitter: 25000, // Twitter Pro allows 25,000 characters
      instagram: 2200,
      facebook: 63206, // Facebook allows up to 63,206 characters
    };

    const baseInstructions: Record<string, string> = {
      linkedin: `STYLE: Business Insider / Forbes Contributor style.
STRUCTURE:
- HEADLINE: A punchy, value-driven opening line (no hashtags in hook).
- BODY: 2-3 short paragraphs explaining the "Why" and "How". Use bullet points for data.
- CLOSE: A provocative question to drive comments.
- FORMAT: Clean spacing. No "Dear network".`,

      twitter: `STYLE: Twitter/X Pro Long-Form Article (25,000 chars available).
STRUCTURE:
- HOOK (First 280 chars): A scroll-stopping opener that hooks readers in the timeline preview.
- BODY: Expand on the topic with rich details, insights, and examples.
- FORMAT: Use **bold** for key points and *italics* for emphasis. Use line breaks for readability.
- CLOSE: End with a thought-provoking question or call-to-action.
- NOTE: First 280 characters are shown in timeline with "Show more" button.`,

      instagram: `STYLE: Visual Storytelling & aesthetic vibe.
STRUCTURE:
- HOOK: A short, attention-grabbing first line (e.g., "Stop scrolling 🛑").
- CAPTION: Tell a micro-story about the image/topic. emotional connection.
- FORMAT: Use line breaks.
- HASHTAGS: clear block of 20-30 relevant niche tags at the very bottom.`,

      facebook: `STYLE: Community Group Leader.
STRUCTURE:
- Friendly, warm, accessible.
- Ask questions to the "Fam" or "Group".
- Focus on shared values or local impact.`,
    };

    let contextPrompt = `
SYSTEM ROLE: You are a World-Class Social Media Strategist.
Your goal is to rewrite the provided content into a viral-worthy post for ${platform.toUpperCase()}.

CRITICAL FORMATTING RULES:
1. OUTPUT ONLY THE FINAL POST TEXT.
2. DO NOT write "Here is a post..." or "Sure!". Start directly with the Hook/Headline.
3. DO NOT use quotation marks around the post.
4. STRICTLY match the character limit (${limits[platform] || 3000}).

Original Content:
"${content}"

${imageInfo ? `IMAGE CONTEXT:
This post accompanies an image described as: "${imageInfo.enhancedPrompt}".
- Ensure the caption matches the mood of this image.
- If the image is unrelated, ignore it.` : ''}

Task: Write the ${platform.toUpperCase()} post.
${baseInstructions[platform] || baseInstructions.linkedin}
`;

    // Add user context if available
    if (userContext.profile) {
      contextPrompt += `\n\nUSER CONTEXT (Apply these preferences):\n`;

      // Platform-specific voice
      const platformVoiceMap: Record<string, string | undefined> = {
        linkedin: userContext.profile.linkedin_voice,
        twitter: userContext.profile.twitter_voice,
        instagram: userContext.profile.instagram_voice,
        facebook: userContext.profile.facebook_voice,
      };

      const platformVoice = platformVoiceMap[platform.toLowerCase()];
      if (platformVoice) {
        contextPrompt += `BRAND VOICE FOR ${platform.toUpperCase()} (Strictly follow this): ${platformVoice}\n`;
      }

      // Emoji usage
      if (userContext.profile.preferred_emoji_usage) {
        const emojiInstruction =
          userContext.profile.preferred_emoji_usage === 'minimal'
            ? 'Use minimal emojis (0-1)'
            : userContext.profile.preferred_emoji_usage === 'heavy'
              ? 'Use heavy emoji usage (5+)'
              : 'Use moderate emojis (2-4)';
        contextPrompt += `EMOJI USAGE: ${emojiInstruction}\n`;
      }

      // Get platform-specific liked/disliked styles if userId available
      if (userContext.profile.user_id) {
        try {
          const likedStyles = await userMemoryService.getLikedStyles(
            userContext.profile.user_id,
            'caption',
            platform,
            5
          );
          const dislikedStyles = await userMemoryService.getDislikedStyles(
            userContext.profile.user_id,
            'caption',
            platform,
            3
          );

          if (likedStyles.length > 0) {
            contextPrompt += `\nUser LIKES these ${platform} caption styles (use similar style):\n`;
            likedStyles.forEach((memory) => {
              const summary = memory.context_metadata?.style_summary || memory.content.substring(0, 100);
              contextPrompt += `- ${summary}\n`;
            });
          }

          if (dislikedStyles.length > 0) {
            contextPrompt += `\nUser DISLIKES these ${platform} caption styles (AVOID these elements/styles):\n`;
            dislikedStyles.forEach((memory) => {
              const whyDisliked = memory.context_metadata?.why_disliked || 'User disliked this style';
              contextPrompt += `- ${whyDisliked}\n`;
            });
          }
        } catch (error) {
          console.error('Error loading user styles:', error);
        }
      }
    }

    contextPrompt += `\n${platform} caption:`;

    return contextPrompt;
  }

  private formatContent(platform: string, content: string): string {
    // Additional cleanup if needed
    return content.trim();
  }
}

export const contentCreator = new ContentCreator();
