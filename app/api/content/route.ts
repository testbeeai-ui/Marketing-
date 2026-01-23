import { NextRequest, NextResponse } from 'next/server';
import { contentCreator } from '@/lib/services/contentCreator';
import { userMemoryService, MEMORY_TYPES } from '@/lib/services/userMemoryService';
import { styleExtractor } from '@/lib/services/styleExtractor';
import { getNumericUserIdFromRequest } from '@/lib/auth-server';

// POST /api/content - Generate content or handle like/dislike
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { action, storyId, storyContent, platforms, imageContext, caption, platform } = body;
        const userId = await getNumericUserIdFromRequest(request);

        // Like caption
        if (action === 'like') {
            if (!caption || !platform) {
                return NextResponse.json({ error: 'caption and platform are required' }, { status: 400 });
            }
            if (!userId) {
                return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
            }

            const styleElements = await styleExtractor.extractCaptionStyle(caption, platform);
            const memoryTypeMap: Record<string, string> = {
                linkedin: MEMORY_TYPES.LIKED_CAPTION_STYLE_LINKEDIN,
                twitter: MEMORY_TYPES.LIKED_CAPTION_STYLE_TWITTER,
                instagram: MEMORY_TYPES.LIKED_CAPTION_STYLE_INSTAGRAM,
                facebook: MEMORY_TYPES.LIKED_CAPTION_STYLE_FACEBOOK,
            };

            const memoryType = memoryTypeMap[platform.toLowerCase()];
            if (!memoryType) {
                return NextResponse.json({ error: 'Invalid platform' }, { status: 400 });
            }

            await userMemoryService.addMemory(userId, memoryType, caption, {
                style_elements: styleElements,
                style_summary: styleElements.style_summary,
            });

            return NextResponse.json({ success: true, message: 'Caption style saved' });
        }

        // Dislike caption
        if (action === 'dislike') {
            if (!caption || !platform) {
                return NextResponse.json({ error: 'caption and platform are required' }, { status: 400 });
            }
            if (!userId) {
                return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
            }

            const dislikeAnalysis = await styleExtractor.analyzeDislikedStory(caption);
            const memoryTypeMap: Record<string, string> = {
                linkedin: MEMORY_TYPES.DISLIKED_CAPTION_STYLE_LINKEDIN,
                twitter: MEMORY_TYPES.DISLIKED_CAPTION_STYLE_TWITTER,
                instagram: MEMORY_TYPES.DISLIKED_CAPTION_STYLE_INSTAGRAM,
                facebook: MEMORY_TYPES.DISLIKED_CAPTION_STYLE_FACEBOOK,
            };

            const memoryType = memoryTypeMap[platform.toLowerCase()];
            if (!memoryType) {
                return NextResponse.json({ error: 'Invalid platform' }, { status: 400 });
            }

            await userMemoryService.addMemory(userId, memoryType, caption, {
                avoidance_analysis: dislikeAnalysis,
                why_disliked: dislikeAnalysis.why_disliked,
                preferred_alternative: dislikeAnalysis.preferred_alternative,
            });

            return NextResponse.json({ success: true, message: 'Disliked caption style saved' });
        }

        // Generate content (default action)
        if (!storyId && !storyContent) {
            return NextResponse.json({ error: 'Either storyId or storyContent is required' }, { status: 400 });
        }

        if (!platforms || !Array.isArray(platforms) || platforms.length === 0) {
            return NextResponse.json({ error: 'platforms array is required' }, { status: 400 });
        }

        const content = await contentCreator.generateContent({
            storyId,
            storyContent,
            platforms,
            userId: userId ?? undefined,
            imageContext,
        });

        return NextResponse.json(content);
    } catch (error: any) {
        console.error('Error in content API:', error);
        return NextResponse.json({ error: error.message || 'Failed to process request' }, { status: 500 });
    }
}
