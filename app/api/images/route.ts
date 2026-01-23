import { NextRequest, NextResponse } from 'next/server';
import { imageGenerator } from '@/lib/services/imageGenerator';
import { userMemoryService, MEMORY_TYPES } from '@/lib/services/userMemoryService';
import { styleExtractor } from '@/lib/services/styleExtractor';
import { getNumericUserIdFromRequest } from '@/lib/auth-server';

// POST /api/images - Handle generate, prompt, like, dislike actions
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { action, prompt, text, platform, width, height, imagePrompt } = body;

        const userId = await getNumericUserIdFromRequest(request);

        const userIdOrUndefined = userId ?? undefined;

        // Generate enhanced prompt only
        if (action === 'prompt') {
            if (!text) return NextResponse.json({ error: 'Text content is required' }, { status: 400 });
            const enhancedPrompt = await imageGenerator.enhanceTextForImageGeneration(text, userIdOrUndefined, platform);
            return NextResponse.json({ prompt: enhancedPrompt });
        }

        // Generate image
        if (action === 'generate') {
            if (!prompt || !prompt.trim()) {
                return NextResponse.json({ error: 'Prompt is required' }, { status: 400 });
            }
            const w = width ? parseInt(width) : undefined;
            const h = height ? parseInt(height) : undefined;
            const result = await imageGenerator.generateImage(prompt, userIdOrUndefined, w, h, platform);
            return NextResponse.json(result);
        }

        // Generate for all platforms
        if (action === 'generate-all-platforms') {
            if (!prompt || !prompt.trim()) {
                return NextResponse.json({ error: 'Prompt is required' }, { status: 400 });
            }

            const platforms = ['linkedin', 'twitter', 'instagram', 'facebook'];
            const results: Array<{ platform: string; enhancedPrompt: string; imageUrl?: string; error?: string }> = [];

            for (const plat of platforms) {
                try {
                    const result = await imageGenerator.generateImage(prompt, userIdOrUndefined, undefined, undefined, plat);
                    results.push({ platform: plat, enhancedPrompt: result.enhancedPrompt, imageUrl: result.imageUrl });
                } catch (error: any) {
                    results.push({ platform: plat, enhancedPrompt: '', error: error.message || 'Failed' });
                }
            }

            const imagesByPlatform: Record<string, { enhancedPrompt: string; imageUrl?: string; error?: string }> = {};
            results.forEach((result) => {
                imagesByPlatform[result.platform] = {
                    enhancedPrompt: result.enhancedPrompt,
                    imageUrl: result.imageUrl,
                    ...(result.error && { error: result.error }),
                };
            });

            const successCount = results.filter(r => r.imageUrl).length;
            if (successCount === 0) {
                return NextResponse.json({ error: 'Failed to generate any images', details: imagesByPlatform }, { status: 500 });
            }

            return NextResponse.json(imagesByPlatform);
        }

        // Like image
        if (action === 'like') {
            if (!imagePrompt) return NextResponse.json({ error: 'imagePrompt is required' }, { status: 400 });
            if (!userId) return NextResponse.json({ error: 'Authentication required' }, { status: 401 });

            const styleElements = await styleExtractor.extractImageStyle(imagePrompt);
            await userMemoryService.addMemory(userId, MEMORY_TYPES.LIKED_IMAGE_STYLE, imagePrompt, {
                style_elements: styleElements,
                style_summary: styleElements.style_summary,
            });
            return NextResponse.json({ success: true, message: 'Image style saved' });
        }

        // Dislike image
        if (action === 'dislike') {
            if (!imagePrompt) return NextResponse.json({ error: 'imagePrompt is required' }, { status: 400 });
            if (!userId) return NextResponse.json({ error: 'Authentication required' }, { status: 401 });

            const dislikeAnalysis = await styleExtractor.analyzeDislikedImage(imagePrompt);
            await userMemoryService.addMemory(userId, MEMORY_TYPES.DISLIKED_IMAGE_STYLE, imagePrompt, {
                avoidance_analysis: dislikeAnalysis,
                why_disliked: dislikeAnalysis.why_disliked,
                preferred_alternative: dislikeAnalysis.preferred_alternative,
            });
            return NextResponse.json({ success: true, message: 'Disliked image style saved' });
        }

        return NextResponse.json({ error: 'Invalid action. Use: prompt, generate, generate-all-platforms, like, dislike' }, { status: 400 });
    } catch (error: any) {
        console.error('Error in images API:', error);
        return NextResponse.json({ error: error.message || 'Failed to process request' }, { status: 500 });
    }
}
