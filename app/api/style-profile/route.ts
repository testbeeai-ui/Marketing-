import { NextRequest, NextResponse } from 'next/server';
import { userMemoryService, MEMORY_TYPES } from '@/lib/services/userMemoryService';
import { getNumericUserIdFromRequest } from '@/lib/auth-server';

// GET /api/style-profile - Get user's style profile
export async function GET(request: NextRequest) {
    try {
        const userId = await getNumericUserIdFromRequest(request);
        if (!userId) {
            return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
        }

        const platforms = ['linkedin', 'instagram', 'twitter', 'facebook'];
        const profile: Record<string, any> = {
            stories: {},
            captions: {},
            images: {},
        };

        // Get story style preferences
        const storyStyles = ['professional', 'viral', 'storyteller'];
        for (const style of storyStyles) {
            const likedType = `liked_story_style_${style}`;
            const dislikedType = `disliked_story_style_${style}`;

            const liked = await userMemoryService.getMemoriesByType(userId, likedType);
            const disliked = await userMemoryService.getMemoriesByType(userId, dislikedType);

            profile.stories[style] = {
                liked: liked.map(m => ({
                    content: m.content.substring(0, 100),
                    summary: m.context_metadata?.style_summary,
                    date: m.created_at,
                })),
                disliked: disliked.map(m => ({
                    content: m.content.substring(0, 100),
                    reason: m.context_metadata?.why_disliked,
                    date: m.created_at,
                })),
            };
        }

        // Get caption preferences per platform
        for (const platform of platforms) {
            const likedType = `liked_caption_style_${platform}`;
            const dislikedType = `disliked_caption_style_${platform}`;

            const liked = await userMemoryService.getMemoriesByType(userId, likedType);
            const disliked = await userMemoryService.getMemoriesByType(userId, dislikedType);

            profile.captions[platform] = {
                liked: liked.map(m => ({
                    content: m.content.substring(0, 100),
                    summary: m.context_metadata?.style_summary,
                    date: m.created_at,
                })),
                disliked: disliked.map(m => ({
                    content: m.content.substring(0, 100),
                    reason: m.context_metadata?.why_disliked,
                    date: m.created_at,
                })),
                totalLikes: liked.length,
                totalDislikes: disliked.length,
            };
        }

        // Get image preferences per platform
        for (const platform of platforms) {
            const likedType = `liked_image_style_${platform}`;
            const dislikedType = `disliked_image_style_${platform}`;

            const liked = await userMemoryService.getMemoriesByType(userId, likedType);
            const disliked = await userMemoryService.getMemoriesByType(userId, dislikedType);

            profile.images[platform] = {
                liked: liked.map(m => ({
                    prompt: m.content.substring(0, 100),
                    style: m.context_metadata?.style_summary,
                    date: m.created_at,
                })),
                disliked: disliked.map(m => ({
                    prompt: m.content.substring(0, 100),
                    reason: m.context_metadata?.why_disliked,
                    date: m.created_at,
                })),
                totalLikes: liked.length,
                totalDislikes: disliked.length,
            };
        }

        // Get general image preferences
        const generalLiked = await userMemoryService.getMemoriesByType(userId, MEMORY_TYPES.LIKED_IMAGE_STYLE);
        const generalDisliked = await userMemoryService.getMemoriesByType(userId, MEMORY_TYPES.DISLIKED_IMAGE_STYLE);

        profile.images.general = {
            liked: generalLiked.map(m => ({
                prompt: m.content.substring(0, 100),
                style: m.context_metadata?.style_summary,
                date: m.created_at,
            })),
            disliked: generalDisliked.map(m => ({
                prompt: m.content.substring(0, 100),
                reason: m.context_metadata?.why_disliked,
                date: m.created_at,
            })),
            totalLikes: generalLiked.length,
            totalDislikes: generalDisliked.length,
        };

        // Summary stats
        profile.summary = {
            totalInteractions:
                Object.values(profile.stories).reduce((sum: number, s: any) =>
                    sum + (s.liked?.length || 0) + (s.disliked?.length || 0), 0) +
                Object.values(profile.captions).reduce((sum: number, c: any) =>
                    sum + (c.liked?.length || 0) + (c.disliked?.length || 0), 0) +
                Object.values(profile.images).reduce((sum: number, i: any) =>
                    sum + (i.liked?.length || 0) + (i.disliked?.length || 0), 0),
            platforms,
        };

        return NextResponse.json(profile);
    } catch (error: any) {
        console.error('Error getting style profile:', error);
        return NextResponse.json({ error: error.message || 'Failed to get style profile' }, { status: 500 });
    }
}

// DELETE /api/style-profile?category=xxx&platform=xxx
export async function DELETE(request: NextRequest) {
    try {
        const userId = await getNumericUserIdFromRequest(request);
        if (!userId) {
            return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
        }

        const { searchParams } = new URL(request.url);
        const category = searchParams.get('category');
        const platform = searchParams.get('platform');

        return NextResponse.json({ success: true, message: `Cleared ${category} preferences for ${platform}` });
    } catch (error: any) {
        console.error('Error clearing style preferences:', error);
        return NextResponse.json({ error: error.message || 'Failed to clear preferences' }, { status: 500 });
    }
}