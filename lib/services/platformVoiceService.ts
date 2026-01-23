import { ExtractedPreferences } from './preferenceExtractor';

export interface PlatformVoices {
  linkedin_voice: string;
  twitter_voice: string;
  instagram_voice: string;
  facebook_voice: string;
}

export class PlatformVoiceService {
  /**
   * Create platform-specific brand voices from extracted preferences
   */
  createPlatformVoices(preferences: ExtractedPreferences): PlatformVoices {
    const baseVoice = preferences.inferred_brand_voice || 'Professional, Engaging';
    const formality = preferences.formality || 'mixed';
    const emojiUsage = preferences.emoji_tendency || 'moderate';

    // LinkedIn: Professional, Story-driven
    const linkedinVoice = formality !== 'casual'
      ? `${baseVoice}, Professional, Story-driven`
      : `${baseVoice}, Story-driven`;

    // Twitter: Concise, Engaging
    const twitterVoice = `${baseVoice}, Concise, Engaging`;

    // Instagram: Visual-focused, Emoji-rich if heavy usage
    const instagramVoice = emojiUsage === 'heavy'
      ? `${baseVoice}, Visual-focused, Emoji-rich`
      : `${baseVoice}, Visual-focused, Moderate emojis`;

    // Facebook: Conversational, Community-focused
    const facebookVoice = `${baseVoice}, Conversational, Community-focused`;

    return {
      linkedin_voice: linkedinVoice,
      twitter_voice: twitterVoice,
      instagram_voice: instagramVoice,
      facebook_voice: facebookVoice,
    };
  }
}

export const platformVoiceService = new PlatformVoiceService();
