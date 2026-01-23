import { aiService } from './aiService';

export interface ExtractedPreferences {
  formality: 'formal' | 'casual' | 'mixed';
  tone: string;
  emoji_tendency: 'minimal' | 'moderate' | 'heavy';
  content_focus: string;
  writing_style: string;
  inferred_brand_voice: string;
}

export class PreferenceExtractor {
  /**
   * Extract user preferences from their first text input
   */
  async extractPreferences(userInput: string): Promise<ExtractedPreferences> {
    const prompt = `Analyze this user's writing style and extract their preferences for social media content creation.

User's text: "${userInput}"

Based on this text, extract:
1. **Formality Level**: 'formal', 'casual', or 'mixed'
2. **Tone**: Professional, Witty, Friendly, Serious, Humorous, etc. (1-2 words)
3. **Emoji Tendency**: 'minimal' (0-1), 'moderate' (2-4), or 'heavy' (5+)
4. **Content Focus**: Business, Personal, Educational, Entertainment, etc.
5. **Writing Style**: Concise, Detailed, Story-driven, Direct, etc.

Return your analysis as a JSON object:
{
    "formality": "casual",
    "tone": "Friendly",
    "emoji_tendency": "moderate",
    "content_focus": "Business",
    "writing_style": "Concise",
    "inferred_brand_voice": "Friendly, Concise, Business-focused with moderate emoji usage"
}

Return ONLY valid JSON, no other text.`;

    try {
      const response = await aiService.generateContent(prompt);
      
      // Try to extract JSON from response
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in response');
      }

      const parsed = JSON.parse(jsonMatch[0]) as ExtractedPreferences;
      
      // Validate required fields
      if (!parsed.formality || !parsed.tone || !parsed.emoji_tendency) {
        throw new Error('Missing required preference fields');
      }

      return parsed;
    } catch (error: any) {
      console.error('Error extracting preferences:', error);
      // Return default preferences on error
      return {
        formality: 'mixed',
        tone: 'Professional',
        emoji_tendency: 'moderate',
        content_focus: 'Business',
        writing_style: 'Concise',
        inferred_brand_voice: 'Professional, Engaging',
      };
    }
  }
}

export const preferenceExtractor = new PreferenceExtractor();
