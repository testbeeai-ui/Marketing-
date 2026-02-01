import { NextRequest, NextResponse } from 'next/server';
import { imageGenerator } from '@/lib/services/imageGenerator';
import { userMemoryService, MEMORY_TYPES } from '@/lib/services/userMemoryService';
import { styleExtractor } from '@/lib/services/styleExtractor';
import { getUserIdFromRequest } from '@/lib/auth-server';

// POST /api/images - Handle generate, prompt, like, dislike actions
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { action, prompt, text, platform, width, height, imagePrompt } = body;

        const userId = await getUserIdFromRequest(request);

        const userIdOrUndefined = userId ?? undefined;

        // Generate enhanced prompt only
        if (action === 'prompt') {
            if (!text) return NextResponse.json({ error: 'Text content is required' }, { status: 400 });
            const enhancedPrompt = await imageGenerator.enhanceTextForImageGeneration(text, userIdOrUndefined, platform);
            return NextResponse.json({ prompt: enhancedPrompt, enhancedPrompt });
        }

        // Generate image
        if (action === 'generate') {
            if (!prompt || !prompt.trim()) {
                return NextResponse.json({ error: 'Prompt is required' }, { status: 400 });
            }
            const w = width ? parseInt(width) : undefined;
            const h = height ? parseInt(height) : undefined;

            try {
                const result = await imageGenerator.generateImage(prompt, userIdOrUndefined, w, h, platform);
                return NextResponse.json({ imageUrl: result.imageUrl });
            } catch (error: any) {
                console.error('Error generating image:', error);
                return NextResponse.json({ error: error.message || 'Failed to generate image' }, { status: 500 });
            }
        }

        // Modify image
        if (action === 'modify') {
            const { imageUrl, originalPrompt, instructions, logoBase64, logoMimeType, logoPosition, logos } = body;

            if (!imageUrl || !originalPrompt || !instructions) {
                return NextResponse.json({
                    error: 'imageUrl, originalPrompt, and instructions are required'
                }, { status: 400 });
            }

            try {
                const result = await imageGenerator.modifyImage(
                    imageUrl,
                    originalPrompt,
                    instructions,
                    platform,
                    logoBase64,
                    logoMimeType,
                    userIdOrUndefined,
                    logoPosition,
                    logos
                );
                return NextResponse.json({
                    imageUrl: result.imageUrl,
                    enhancedPrompt: result.enhancedPrompt
                });
            } catch (error: any) {
                console.error('Error modifying image:', error);
                return NextResponse.json({ error: error.message || 'Failed to modify image' }, { status: 500 });
            }
        }

        // Like image
        if (action === 'like') {
            if (!imagePrompt || !prompt) {
                return NextResponse.json({ error: 'imagePrompt and prompt are required' }, { status: 400 });
            }
            if (!userId) {
                return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
            }

            const styleAnalysis = await styleExtractor.extractImageStyle(imagePrompt);

            await userMemoryService.addMemory(userId, MEMORY_TYPES.LIKED_IMAGE_STYLE, imagePrompt, {
                style_analysis: styleAnalysis,
                prompt: prompt,
                platform: platform,
            });

            return NextResponse.json({ success: true, message: 'Image style saved' });
        }

        // Dislike image
        if (action === 'dislike') {
            if (!imagePrompt || !prompt) {
                return NextResponse.json({ error: 'imagePrompt and prompt are required' }, { status: 400 });
            }
            if (!userId) {
                return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
            }

            const dislikeAnalysis = await styleExtractor.analyzeDislikedImage(imagePrompt);

            await userMemoryService.addMemory(userId, MEMORY_TYPES.DISLIKED_IMAGE_STYLE, imagePrompt, {
                avoidance_analysis: dislikeAnalysis,
                why_disliked: dislikeAnalysis.why_disliked,
                preferred_alternative: dislikeAnalysis.preferred_alternative,
                prompt: prompt,
                platform: platform,
            });

            return NextResponse.json({ success: true, message: 'Image dislike saved' });
        }

        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    } catch (error: any) {
        console.error('Error in images API:', error);
        return NextResponse.json({ error: error.message || 'Failed to process image request' }, { status: 500 });
    }
}
