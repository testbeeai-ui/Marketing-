import { aiService } from './aiService';
import { vectorStore } from './vectorStore';
import { storyCache } from './storyCache';
import { STORY_VARIATIONS } from '../constants/storyMatrix';
import { userProfileService, type UserProfile } from './userProfileService';
import { userMemoryService, type UserMemory } from './userMemoryService';
import { preferenceExtractor } from './preferenceExtractor';
import { platformVoiceService } from './platformVoiceService';

export class StoryGenerator {
  async generateStories(blockId: string, prompt: string, userId?: string) { // Changed from number to string
    // 1. Retrieve relevant context from RAG (filtered by userId)
    let relevantChunks: any[] = [];
    try {
      console.log(`[StoryGenerator] Searching RAG for query: "${prompt.substring(0, 50)}..."`);
      relevantChunks = await vectorStore.searchSimilarChunks(prompt, userId, blockId, 5, 0.7);
      console.log(`[StoryGenerator] RAG Context Retrieved: ${relevantChunks.length} chunks`);
      if (relevantChunks.length > 0) {
        console.log(`[StoryGenerator] Top Context: "${relevantChunks[0].text.substring(0, 100)}..."`);
      } else {
        console.log(`[StoryGenerator] No RAG context found for query`);
      }
    } catch (error) {
      console.warn('[StoryGenerator] RAG search failed:', error);
      // Continue without RAG context
    }

    // 2. Get user profile and preferences
    let userProfile: UserProfile | null = null;
    let userMemories: UserMemory[] = [];
    let userPreferences: Record<string, any> = {};

    if (userId) {
      try {
        console.log(`[StoryGenerator] Loading user profile for user ${userId}`);
        userProfile = await userProfileService.getUserProfile(userId);
        console.log(`[StoryGenerator] User profile loaded: ${userProfile ? 'yes' : 'no'}`);

        console.log(`[StoryGenerator] Loading user memories for user ${userId}`);
        userMemories = await userMemoryService.getAllMemories(userId);
        console.log(`[StoryGenerator] User memories loaded: ${userMemories.length} memories`);

        // Extract preferences from user memories by concatenating them into a single text
        if (userMemories.length > 0) {
          const userTextSample = userMemories
            .filter(memory => memory.content && memory.content.length > 10)
            .slice(0, 10) // Use first 10 memories
            .map(memory => memory.content)
            .join('\n');
          
          if (userTextSample) {
            console.log(`[StoryGenerator] Extracting user preferences from ${userMemories.length} memories`);
            userPreferences = await preferenceExtractor.extractPreferences(userTextSample);
            console.log(`[StoryGenerator] User preferences extracted: ${Object.keys(userPreferences).length} categories`);
          }
        }
      } catch (error) {
        console.warn('[StoryGenerator] User profile/memory loading failed:', error);
        // Continue without user context
      }
    }

    // 3. Generate stories for each variation
    const stories = await Promise.all(
      STORY_VARIATIONS.map(async (variation) => {
        try {
          console.log(`[StoryGenerator] Generating ${variation.id} story...`);
          
          // Build context-aware prompt
          const contextPrompt = this.buildContextAwarePrompt(
            prompt,
            variation,
            relevantChunks,
            userProfile,
            userPreferences,
            userId
          );

          // Generate story using AI service
          const storyContent = await aiService.generateContent(contextPrompt);
          
          console.log(`[StoryGenerator] Generated ${variation.id} story: ${storyContent.substring(0, 50)}...`);

          return {
            id: variation.id,
            title: variation.description, // Use description as title since there's no title property
            content: storyContent,
            selected: false,
          };
        } catch (error) {
          console.error(`[StoryGenerator] Failed to generate ${variation.id} story:`, error);
          return {
            id: variation.id,
            title: variation.description, // Use description as title
            content: `Error generating ${variation.id} story. Please try again.`,
            selected: false,
          };
        }
      })
    );

    console.log(`[StoryGenerator] Successfully generated ${stories.length} story variations`);
    return stories;
  }

  private buildContextAwarePrompt(
    userPrompt: string,
    variation: any,
    relevantChunks: any[],
    userProfile: UserProfile | null,
    userPreferences: Record<string, any>,
    userId?: string // Changed from number to string
  ): string {
    let contextPrompt = `${variation.prompt}

User Request: "${userPrompt}"

`;

    // Add RAG context if available
    if (relevantChunks.length > 0) {
      contextPrompt += `Relevant Context from your knowledge base:
${relevantChunks.map(chunk => `- ${chunk.text}`).join('\n')}

`;
    }

    // Add user profile context if available
    if (userProfile) {
      contextPrompt += `User Profile:
- Username: ${userProfile.username || 'Not specified'}
- Style Preferences: ${userProfile.style_preferences || 'Not specified'}
- Brand Voice: ${userProfile.brand_voice || 'Not specified'}
- Preferred Formality: ${userProfile.preferred_formality || 'Not specified'}
- Emoji Usage: ${userProfile.preferred_emoji_usage || 'Not specified'}

`;
    }

    // Add user preferences if available
    if (Object.keys(userPreferences).length > 0) {
      contextPrompt += `User Preferences (based on past interactions):
${Object.entries(userPreferences)
  .map(([key, value]) => `- ${key}: ${JSON.stringify(value)}`)
  .join('\n')}

`;
    }

    // Add variation-specific instructions
    contextPrompt += `Story Style: ${variation.tone} (${variation.style})
Instructions: ${variation.instructions}

`;

    contextPrompt += `Generate the story now:`;

    return contextPrompt;
  }
}

export const storyGenerator = new StoryGenerator();