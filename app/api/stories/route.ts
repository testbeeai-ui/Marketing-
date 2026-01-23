import { NextRequest, NextResponse } from 'next/server';
import { storyGenerator } from '@/lib/services/storyGenerator';
import { storyCache } from '@/lib/services/storyCache';
import { blockStorage } from '@/lib/services/blockStorage';
import { subBlockStorage } from '@/lib/services/subBlockStorage';
import { userMemoryService, MEMORY_TYPES } from '@/lib/services/userMemoryService';
import { styleExtractor } from '@/lib/services/styleExtractor';
import { getNumericUserIdFromRequest } from '@/lib/auth-server';
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

        await blockStorage.ensureLoaded();
        if (!await blockStorage.exists(blockId)) {
            return NextResponse.json({ error: 'Block not found. Please create a block first.' }, { status: 404 });
        }

        const userId = await getNumericUserIdFromRequest(request);
        const result: any = await storyGenerator.generateStories(blockId, prompt, userId ?? undefined);

        if (subBlockId) {
            await subBlockStorage.ensureLoaded();
            const subBlock = await subBlockStorage.get(subBlockId);
            if (subBlock && subBlock.blockId === blockId) {
                const storyVariations = [
                    { id: 'professional', title: 'The Professional', content: result.stories.professional, selected: false },
                    { id: 'viral', title: 'The Viral', content: result.stories.viral, selected: false },
                    { id: 'storyteller', title: 'The Storyteller', content: result.stories.storyteller, selected: false },
                ];
                await subBlockStorage.update(subBlockId, { prompt, storyVariations });
            }
        }

        return NextResponse.json(result);
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

    const userId = await getNumericUserIdFromRequest(request);
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

        return NextResponse.json({ success: true, message: 'Disliked story style saved' });
    }
}

// GET /api/stories?id=xxx or /api/stories?blockId=xxx
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const id = searchParams.get('id');
        const blockId = searchParams.get('blockId');

        if (id) {
            const story = storyCache.get(id);
            if (!story) {
                return NextResponse.json({ error: 'Story not found' }, { status: 404 });
            }
            return NextResponse.json(story);
        }

        if (blockId) {
            const stories = storyCache.getByBlockId(blockId);
            return NextResponse.json(stories);
        }

        return NextResponse.json({ error: 'id or blockId parameter required' }, { status: 400 });
    } catch (error: any) {
        console.error('Error fetching stories:', error);
        return NextResponse.json({ error: error.message || 'Failed to fetch stories' }, { status: 500 });
    }
}
