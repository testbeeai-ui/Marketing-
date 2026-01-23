import { z } from 'zod';

export const generateStorySchema = z.object({
  prompt: z.string().min(1, "Prompt is required"),
  blockId: z.string().min(1, "Block ID is required"),
  subBlockId: z.string().optional(),
  userId: z.number().optional(),
});

export const storyActionSchema = z.object({
  action: z.enum(['like', 'dislike']),
  storyId: z.string().min(1, "Story ID is required"),
  storyContent: z.string().min(1, "Story content is required"),
  styleType: z.enum(['professional', 'viral', 'storyteller']).optional(),
});

export const createSubBlockSchema = z.object({
  blockId: z.string().min(1, "Block ID is required"),
  name: z.string().min(1, "Name is required"),
  prompt: z.string().optional(),
});

export const updateSubBlockSchema = z.object({
  id: z.string().min(1, "ID is required"),
  name: z.string().optional(),
  prompt: z.string().optional(),
  selectedVariationId: z.string().optional(),
  storyVariations: z.array(z.any()).optional(), // Can be made more specific if needed
  platformContents: z.record(z.string()).optional(),
});
