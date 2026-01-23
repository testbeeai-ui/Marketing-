import { aiService } from './aiService';
import { vectorStore } from './vectorStore';
import { storyCache } from './storyCache';
import { STORY_VARIATIONS } from '../constants/storyMatrix';
import { userProfileService, type UserProfile } from './userProfileService';
import { userMemoryService, type UserMemory } from './userMemoryService';
import { preferenceExtractor } from './preferenceExtractor';
import { platformVoiceService } from './platformVoiceService';

export class StoryGenerator {
  async generateStories(blockId: string, prompt: string, userId?: number) {
    // 1. Retrieve relevant context from RAG (filtered by userId)
    let relevantChunks: any[] = [];
    try {
      console.log(`[StoryGenerator] Searching RAG for query: "${prompt.substring(0, 50)}..."`);
      relevantChunks = await vectorStore.searchByQuery(prompt, blockId, 5, userId);
      console.log(`[StoryGenerator] RAG Context Retrieved: ${relevantChunks.length} chunks`);
      if (relevantChunks.length > 0) {
        console.log(`[StoryGenerator] Top Context: "${relevantChunks[0].text.substring(0, 100)}..."`);
      } else {
        console.warn(`[StoryGenerator] NO Context found for this query in block ${blockId}`);
      }
    } catch (ragError) {
      console.error('[StoryGenerator] RAG Retrieval failed, proceeding without context:', ragError);
      relevantChunks = [];
    }
    const context = relevantChunks.map(chunk => chunk.text);

    // 2. Get user preferences if userId provided
    const userContext: {
      profile?: UserProfile | null;
      likedStyles?: UserMemory[];
      dislikedStyles?: UserMemory[];
    } = {};

    if (userId) {
      try {
        // Get or create user profile
        const profile = await userProfileService.getOrCreateUser(userId);

        // Check if onboarding needed
        if (!profile.onboarding_completed && prompt) {
          // Extract preferences from first input
          const extractedPrefs = await preferenceExtractor.extractPreferences(prompt);
          const platformVoices = platformVoiceService.createPlatformVoices(extractedPrefs);

          // Update profile with extracted preferences
          await userProfileService.updateUserProfile(userId, {
            style_preferences: extractedPrefs.inferred_brand_voice,
            brand_voice: extractedPrefs.inferred_brand_voice,
            linkedin_voice: platformVoices.linkedin_voice,
            twitter_voice: platformVoices.twitter_voice,
            instagram_voice: platformVoices.instagram_voice,
            facebook_voice: platformVoices.facebook_voice,
            preferred_emoji_usage: extractedPrefs.emoji_tendency,
            preferred_formality: extractedPrefs.formality,
            onboarding_completed: true,
          });

          // Refresh profile
          const updatedProfile = await userProfileService.getUserProfile(userId);
          userContext.profile = updatedProfile;
        } else {
          userContext.profile = profile;
        }

        // Get liked/disliked styles
        userContext.likedStyles = await userMemoryService.getLikedStyles(userId, 'story', undefined, 15);
        userContext.dislikedStyles = await userMemoryService.getDislikedStyles(userId, 'story', undefined, 12);
      } catch (error) {
        console.error('Error loading user context:', error);
        // Continue without user context if there's an error
      }
    }

    // 3. Generate variations based on matrix with user context
    const variations = await Promise.all(
      STORY_VARIATIONS.map(async (variation) => {
        // Build context-aware prompt
        let contextPrompt = `
Context:
${context.join('\n\n')}

User Input: ${prompt}
`;

        // Add user context if available
        if (userContext.profile) {
          contextPrompt += `\n\nUSER CONTEXT (Apply these preferences):\n`;
          if (userContext.profile.brand_voice) {
            contextPrompt += `Brand Voice: ${userContext.profile.brand_voice}\n`;
          }
          if (userContext.profile.preferred_emoji_usage) {
            const emojiInstruction = userContext.profile.preferred_emoji_usage === 'minimal'
              ? 'Use minimal emojis (0-1)'
              : userContext.profile.preferred_emoji_usage === 'heavy'
                ? 'Use heavy emoji usage (5+)'
                : 'Use moderate emojis (2-4)';
            contextPrompt += `Emoji Usage: ${emojiInstruction}\n`;
          }
        }

        // Add liked/disliked styles
        if (userContext.likedStyles && userContext.likedStyles.length > 0) {
          contextPrompt += `\nUser LIKES these story styles (use similar style):\n`;
          userContext.likedStyles.slice(0, 5).forEach((memory) => {
            const summary = memory.context_metadata?.style_summary || memory.content.substring(0, 100);
            contextPrompt += `- ${summary}\n`;
          });
        }
        if (userContext.dislikedStyles && userContext.dislikedStyles.length > 0) {
          contextPrompt += `\nUser DISLIKES these story styles (AVOID these):\n`;
          userContext.dislikedStyles.slice(0, 3).forEach((memory) => {
            const whyDisliked = memory.context_metadata?.why_disliked || 'User disliked this style';
            const alternative = memory.context_metadata?.preferred_alternative || '';
            contextPrompt += `- Avoid: ${whyDisliked}\n`;
            if (alternative) contextPrompt += `  Instead: ${alternative}\n`;
          });
        }

        const fullPrompt = `${contextPrompt}

You are a Master Narrative Strategist.
Your goal is to write a "${variation.tone}" variation of the story, but you must strictly follow the "Dynamic Vibe Check".

STEP 1: DYNAMIC VIBE CHECK (Internal Analysis)
Analyze the User Input & Context to determine:
1. GRAVITAS: Is this topic Serious/Tragic, Neutral, or Happy/Exciting?
2. COMPLEXITY: Is this a simple concept or dense technical data?
3. AUDIENCE: Is this for general public or niche experts?

STEP 2: ADAPTIVE STYLE EXECUTION
You have been asked to use the "${variation.tone}" style.
You must adapt the TONE to the topic (Vibe Check), but you must strictly maintain the STRUCTURE of the variation.

VARIATION RULES:
1. "The Viral" (Casual):
   - STRUCTURE: Ultra-short sentences. One idea per line. Max visual white space.
   - TONE ADAPTATION: 
     - If Sad/Serious: Use short, punchy, vulnerable statements. No emojis. (e.g., "I failed today." vs "OMG I failed 😭")
     - If Happy: High energy, emojis allowed.

2. "The Storyteller" (Creative):
   - STRUCTURE: Immersive paragraphs. Rich details. Narrative flow.
   - TONE ADAPTATION:
     - If Sad: Slow pacing, sensory details of pain.
     - If Happy: Fast pacing, excitement.

3. "The Professional" (Professional):
   - STRUCTURE: Clear headers, bullet points, strategic insights.
   - TONE ADAPTATION:
     - If Sad: Leadership lessons from failure.
     - If Happy: Growth milestones and vision.

CRITICAL RULE:
Even if the topic is TRAGIC, "Viral" must still look like a Twitter thread (Short lines), and "Storyteller" must look like a Novel (Paragraphs).
DO NOT BLEND THE STRUCTURES.

Format your response exactly as:
TITLE: [Your Title Here]
CONTENT: [Your Content Here]
`;
        try {
          // We use the generic generateContent from aiService (we'll assume aiService has a generic method or we use the existing one slightly modified)
          // Since aiService.generateStory takes specific styles, we might need to use a lower level method or adapt.
          // Let's assume we can add a generic generate method to aiService or use the existing one with custom prompt.
          // For now, let's use the existing generateStory but passing the instructions as the style description if possible,
          // or better yet, let's update aiService to expose a generic method.
          // For this implementation, I will assume we update AIService to have a generic generateContent method.

          const rawContent = await aiService.generateContent(fullPrompt);

          // Parse title and content
          const titleMatch = rawContent.match(/TITLE:\s*(.+)/);
          const contentMatch = rawContent.match(/CONTENT:\s*([\s\S]+)/);

          return {
            id: variation.id,
            tone: variation.tone,
            style: variation.style,
            title: titleMatch ? titleMatch[1].trim() : `${variation.tone} Story`,
            content: contentMatch ? contentMatch[1].trim() : rawContent.replace(/TITLE:.*\n/, '').trim()
          };
        } catch (error) {
          console.error(`Error generating variation ${variation.id}:`, error);
          return {
            id: variation.id,
            tone: variation.tone,
            style: variation.style,
            title: 'Error Generating Story',
            content: 'Failed to generate content. Please try again.'
          };
        }
      })
    );

    // 3. Cache the results
    const storyId = Date.now().toString();
    const storiesMap = variations.reduce((acc, v) => ({ ...acc, [v.id]: v.content }), {});

    storyCache.set(storyId, {
      id: storyId,
      blockId,
      prompt,
      variations: storiesMap,
      structuredVariations: variations,
      contextUsed: context,
      createdAt: Date.now()
    });

    return {
      storyId,
      stories: storiesMap,
      variations,
      contextUsed: context.length > 0,
      chunksRetrieved: relevantChunks.length
    };
  }
}

export const storyGenerator = new StoryGenerator();
