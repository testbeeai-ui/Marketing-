import { aiService } from './aiService';

export interface StoryStyleElements {
  tone: string;
  length_style: string;
  emoji_usage: string;
  structure: string;
  formality: string;
  engagement_technique: string;
  voice_characteristics: string;
  style_summary: string;
}

export interface ImageStyleElements {
  visual_style: string;
  color_palette: string;
  mood: string;
  composition: string;
  lighting: string;
  aesthetic: string;
  key_elements: string[];
  style_summary: string;
}

export interface DislikeAnalysis {
  avoid_style?: string;
  avoid_elements?: string[];
  avoid_mood?: string;
  avoid_composition?: string;
  preferred_alternative: string;
  why_disliked: string;
}

export class StyleExtractor {
  /**
   * Extract style elements from a liked story
   */
  async extractStoryStyle(storyContent: string, styleType: 'professional' | 'viral' | 'storyteller'): Promise<StoryStyleElements> {
    const prompt = `Analyze this ${styleType} story that a user liked and extract the key style elements.

Story: "${storyContent}"

Extract and return as JSON:
{
    "tone": "e.g., professional, casual, witty, inspiring",
    "length_style": "e.g., concise, detailed, story-driven",
    "emoji_usage": "e.g., minimal, moderate, heavy",
    "structure": "e.g., hook-first, story-arc, list-based, question-led",
    "formality": "e.g., formal, casual, mixed",
    "engagement_technique": "e.g., question, CTA, story, statistic",
    "voice_characteristics": "e.g., authoritative, friendly, conversational, educational",
    "style_summary": "Brief summary of the story style"
}

Return ONLY valid JSON, no other text.`;

    try {
      const response = await aiService.generateContent(prompt);
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in response');
      }
      return JSON.parse(jsonMatch[0]) as StoryStyleElements;
    } catch (error: any) {
      console.error('Error extracting story style:', error);
      return {
        tone: styleType,
        length_style: 'concise',
        emoji_usage: 'moderate',
        structure: 'story-arc',
        formality: 'mixed',
        engagement_technique: 'story',
        voice_characteristics: 'engaging',
        style_summary: `${styleType} style story`,
      };
    }
  }

  /**
   * Analyze a disliked story to understand what to avoid
   */
  async analyzeDislikedStory(storyContent: string): Promise<DislikeAnalysis> {
    const prompt = `Analyze this story that a user disliked and identify what should be avoided in future generations.

Story: "${storyContent}"

Analyze what might be wrong or unappealing. Return as JSON:
{
    "avoid_style": "e.g., too formal, too casual, wrong tone",
    "avoid_elements": ["element1", "element2"],
    "avoid_mood": "e.g., too gloomy, too casual, too formal",
    "preferred_alternative": "What should be done instead",
    "why_disliked": "Brief explanation of what might be wrong"
}

Return ONLY valid JSON, no other text.`;

    try {
      const response = await aiService.generateContent(prompt);
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in response');
      }
      return JSON.parse(jsonMatch[0]) as DislikeAnalysis;
    } catch (error: any) {
      console.error('Error analyzing disliked story:', error);
      return {
        preferred_alternative: 'Use a different approach',
        why_disliked: 'User did not like this style',
      };
    }
  }

  /**
   * Extract style elements from an image prompt
   */
  async extractImageStyle(imagePrompt: string): Promise<ImageStyleElements> {
    const prompt = `Analyze this image generation prompt and extract the key style elements that make it appealing.

Image Prompt: "${imagePrompt}"

Extract and return as JSON:
{
    "visual_style": "e.g., cinematic, photorealistic, minimalist, abstract",
    "color_palette": "e.g., warm tones, cool blues, vibrant, muted",
    "mood": "e.g., professional, energetic, serene, dramatic",
    "composition": "e.g., centered, rule of thirds, close-up, wide shot",
    "lighting": "e.g., soft, dramatic, natural, studio",
    "aesthetic": "e.g., modern, vintage, futuristic, organic",
    "key_elements": ["element1", "element2", "element3"],
    "style_summary": "Brief summary of the overall visual style"
}

Return ONLY valid JSON, no other text.`;

    try {
      const response = await aiService.generateContent(prompt);
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in response');
      }
      return JSON.parse(jsonMatch[0]) as ImageStyleElements;
    } catch (error: any) {
      console.error('Error extracting image style:', error);
      return {
        visual_style: 'photorealistic',
        color_palette: 'vibrant',
        mood: 'professional',
        composition: 'centered',
        lighting: 'natural',
        aesthetic: 'modern',
        key_elements: [],
        style_summary: 'Professional visual style',
      };
    }
  }

  /**
   * Analyze a disliked image prompt
   */
  async analyzeDislikedImage(imagePrompt: string): Promise<DislikeAnalysis> {
    const prompt = `Analyze this image generation prompt that a user disliked and identify what should be avoided in future generations.

Image Prompt: "${imagePrompt}"

Analyze what might be wrong or unappealing. Return as JSON:
{
    "avoid_style": "e.g., too dark, too cluttered, wrong color scheme",
    "avoid_elements": ["element1", "element2"],
    "avoid_mood": "e.g., too gloomy, too casual, too formal",
    "avoid_composition": "e.g., too busy, poorly framed, wrong angle",
    "preferred_alternative": "What should be done instead",
    "why_disliked": "Brief explanation of what might be wrong"
}

Return ONLY valid JSON, no other text.`;

    try {
      const response = await aiService.generateContent(prompt);
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in response');
      }
      return JSON.parse(jsonMatch[0]) as DislikeAnalysis;
    } catch (error: any) {
      console.error('Error analyzing disliked image:', error);
      return {
        preferred_alternative: 'Use a different visual approach',
        why_disliked: 'User did not like this image style',
      };
    }
  }

  /**
   * Extract style from a platform caption
   */
  async extractCaptionStyle(caption: string, platform: string): Promise<StoryStyleElements> {
    const prompt = `Analyze this ${platform} caption that a user liked and extract the key style elements.

Caption: "${caption}"

Extract and return as JSON:
{
    "tone": "e.g., professional, casual, witty, inspiring",
    "length_style": "e.g., concise, detailed, story-driven",
    "emoji_usage": "e.g., minimal, moderate, heavy",
    "structure": "e.g., hook-first, story-arc, list-based, question-led",
    "formality": "e.g., formal, casual, mixed",
    "engagement_technique": "e.g., question, CTA, story, statistic",
    "voice_characteristics": "e.g., authoritative, friendly, conversational, educational",
    "platform_optimization": "What makes this caption work well for ${platform}",
    "style_summary": "Brief summary of the caption style"
}

Return ONLY valid JSON, no other text.`;

    try {
      const response = await aiService.generateContent(prompt);
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in response');
      }
      return JSON.parse(jsonMatch[0]) as StoryStyleElements;
    } catch (error: any) {
      console.error('Error extracting caption style:', error);
      return {
        tone: 'engaging',
        length_style: 'concise',
        emoji_usage: 'moderate',
        structure: 'hook-first',
        formality: 'mixed',
        engagement_technique: 'CTA',
        voice_characteristics: 'conversational',
        style_summary: `${platform} optimized caption`,
      };
    }
  }
}

export const styleExtractor = new StyleExtractor();
