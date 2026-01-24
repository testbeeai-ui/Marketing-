import { NextRequest, NextResponse } from 'next/server';
import { storyGenerator } from '@/lib/services/storyGenerator';
import { storyCache } from '@/lib/services/storyCache';
import { blockStorage } from '@/lib/services/blockStorage';
import { subBlockStorage } from '@/lib/services/subBlockStorage';
import { userMemoryService, MEMORY_TYPES } from '@/lib/services/userMemoryService';
import { styleExtractor } from '@/lib/services/styleExtractor';
import { getUserIdFromRequest } from '@/lib/auth-server';
import { generateStorySchema, storyActionSchema } from '@/lib/validations/api';

type StoryStyleType = 'professional' | 'viral' | 'storyteller';

// POST /api/stories/generate
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        
        // Check if it's an action (like/dislike) or generation
        if (body.action) {
            return handleStoryAction(request, body);
        }

        // Validate generation request
        const validation = generateStorySchema.safeParse(body);
        if (!validation.success) {
            return NextResponse.json({ error: 'Invalid request', details: validation.error.format() }, { status: 400 });
        }

        const { prompt, blockId, subBlockId } = validation.data;

        const userId = await getUserIdFromRequest(request);

        // Check if block exists and belongs to user
        if (userId) {
            const block = await blockStorage.getByUserId(blockId, userId);
            if (!block) {
                return NextResponse.json({ error: 'Block not found or access denied' }, { status: 404 });
            }
        }

        // Generate cache key from prompt and subBlockId
        const cacheKey = `story:${subBlockId || 'new'}:${prompt.substring(0, 50)}`;
        
        const titleMap: Record<string, string> = {
            professional: 'The Professional',
            viral: 'The Viral',
            storyteller: 'The Storyteller',
        };

        // Check cache first
        const cached = storyCache.get(cacheKey);
        if (cached) {
            if (subBlockId && userId) {
                const existing = await subBlockStorage.getByUserId(subBlockId, userId);
                if (existing) {
                    const cachedVariations = (cached.structuredVariations || []).map((story: any) => ({
                        id: story.id,
                        title: titleMap[story.id] || story.title || story.id,
                        content: story.content,
                        selected: false,
                    }));
                    const fallbackVariations = Object.entries(cached.variations || {}).map(([id, content]) => ({
                        id,
                        title: titleMap[id] || id,
                        content,
                        selected: false,
                    }));
                    const storyVariations = cachedVariations.length > 0 ? cachedVariations : fallbackVariations;
                    await subBlockStorage.update({
                        ...existing,
                        prompt: prompt.trim(),
                        storyVariations,
                        selectedVariationId: existing.selectedVariationId || storyVariations[0]?.id,
                        updatedAt: new Date().toISOString(),
                    });
                }
            }
            return NextResponse.json({ stories: cached.variations });
        }

        // Generate stories
        const stories = await storyGenerator.generateStories(blockId, prompt, userId || undefined);

        // Convert stories to proper StoryVariation format for cache compatibility
        const structuredVariations = stories.map(story => ({
            id: story.id,
            title: story.title,
            content: story.content,
            tone: story.id === 'professional' ? 'Professional' : story.id === 'viral' ? 'Casual' : 'Creative',
            style: story.id === 'professional' ? 'Narrative' : story.id === 'viral' ? 'Conversational' : 'Storyteller',
            selected: story.selected
        }));

        // Convert stories to variations format for cache compatibility
        const variations: Record<string, string> = {};
        stories.forEach(story => {
            variations[story.id] = story.content;
        });

        // Cache the result
        const cacheData = {
            id: cacheKey,
            blockId,
            prompt,
            variations,
            structuredVariations,
            contextUsed: [],
            createdAt: Date.now()
        };
        storyCache.set(cacheKey, cacheData);

        if (subBlockId && userId) {
            const existing = await subBlockStorage.getByUserId(subBlockId, userId);
            if (existing) {
                const storyVariations = stories.map(story => ({
                    id: story.id,
                    title: titleMap[story.id] || story.title || story.id,
                    content: story.content,
                    selected: story.selected ?? false,
                }));
                await subBlockStorage.update({
                    ...existing,
                    prompt: prompt.trim(),
                    storyVariations,
                    selectedVariationId: existing.selectedVariationId || storyVariations[0]?.id,
                    updatedAt: new Date().toISOString(),
                });
            }
        }

        return NextResponse.json({ stories: variations });
    } catch (error: any) {
        console.error('Error generating stories:', error);
        return NextResponse.json({ error: error.message || 'Failed to generate stories' }, { status: 500 });
    }
}

async function handleStoryAction(request: NextRequest, body: any) {
    const validation = storyActionSchema.safeParse(body);
    if (!validation.success) {
        return NextResponse.json({ error: 'Invalid action request', details: validation.error.format() }, { status: 400 });
    }

    const { action, storyId, storyContent, styleType } = validation.data;

    const userId = await getUserIdFromRequest(request);
    if (!userId) {
        return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const validStyleType: StoryStyleType = (styleType as StoryStyleType) || 'professional';

    if (action === 'like') {
        const styleElements = await styleExtractor.extractStoryStyle(storyContent, validStyleType);
        const memoryTypeMap: Record<string, string> = {
            professional: MEMORY_TYPES.LIKED_STORY_STYLE_PROFESSIONAL,
            viral: MEMORY_TYPES.LIKED_STORY_STYLE_VIRAL,
            storyteller: MEMORY_TYPES.LIKED_STORY_STYLE_STORYTELLER,
        };
        const memoryType = memoryTypeMap[validStyleType] || MEMORY_TYPES.LIKED_STORY_STYLE_PROFESSIONAL;

        await userMemoryService.addMemory(userId, memoryType, storyContent, {
            story_id: storyId,
            style_elements: styleElements,
            style_summary: styleElements.style_summary,
        });

        return NextResponse.json({ success: true, message: 'Story style saved' });
    } else {
        const dislikeAnalysis = await styleExtractor.analyzeDislikedStory(storyContent);
        const memoryTypeMap: Record<string, string> = {
            professional: MEMORY_TYPES.DISLIKED_STORY_STYLE_PROFESSIONAL,
            viral: MEMORY_TYPES.DISLIKED_STORY_STYLE_VIRAL,
            storyteller: MEMORY_TYPES.DISLIKED_STORY_STYLE_STORYTELLER,
        };
        const memoryType = memoryTypeMap[validStyleType] || MEMORY_TYPES.DISLIKED_STORY_STYLE_PROFESSIONAL;

        await userMemoryService.addMemory(userId, memoryType, storyContent, {
            story_id: storyId,
            avoidance_analysis: dislikeAnalysis,
            why_disliked: dislikeAnalysis.why_disliked,
            preferred_alternative: dislikeAnalysis.preferred_alternative,
        });

        return NextResponse.json({ success: true, message: 'Story dislike saved' });
    }
}
