import { NextRequest, NextResponse } from 'next/server';
import { subBlockStorage } from '@/lib/services/subBlockStorage';
import { blockStorage } from '@/lib/services/blockStorage';
import { getNumericUserIdFromRequest } from '@/lib/auth-server';
import { createSubBlockSchema, updateSubBlockSchema } from '@/lib/validations/api';

// GET /api/sub-blocks?blockId=xxx or ?id=xxx
export async function GET(request: NextRequest) {
    try {
        const userId = await getNumericUserIdFromRequest(request);
        if (!userId) {
            return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
        }

        const { searchParams } = new URL(request.url);
        const blockId = searchParams.get('blockId');
        const id = searchParams.get('id');

        await subBlockStorage.ensureLoaded();

        if (id) {
            const subBlock = await subBlockStorage.getByUserId(id, userId);
            if (!subBlock) {
                return NextResponse.json({ error: 'Sub-block not found' }, { status: 404 });
            }
            return NextResponse.json(subBlock);
        }

        if (blockId) {
            const block = await blockStorage.getByUserId(blockId, userId);
            if (!block) {
                return NextResponse.json({ error: 'Block not found' }, { status: 404 });
            }
            const subBlocks = await subBlockStorage.getByBlockId(blockId, userId);
            return NextResponse.json(subBlocks);
        }

        return NextResponse.json({ error: 'blockId or id parameter required' }, { status: 400 });
    } catch (error: any) {
        console.error('Error fetching sub-blocks:', error);
        return NextResponse.json({ error: error.message || 'Failed to fetch sub-blocks' }, { status: 500 });
    }
}

// POST /api/sub-blocks
export async function POST(request: NextRequest) {
    try {
        const userId = await getNumericUserIdFromRequest(request);
        if (!userId) {
            return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
        }

        const body = await request.json();
        const validation = createSubBlockSchema.safeParse(body);

        if (!validation.success) {
            return NextResponse.json({ error: 'Invalid request', details: validation.error.format() }, { status: 400 });
        }

        const { blockId, name, prompt } = validation.data;

        await subBlockStorage.ensureLoaded();
        await blockStorage.ensureLoaded();

        const block = await blockStorage.getByUserId(blockId, userId);
        if (!block) {
            return NextResponse.json({ error: 'Block not found' }, { status: 404 });
        }

        const subBlock = await subBlockStorage.create({
            userId,
            blockId,
            name: name.trim(),
            prompt: prompt || '',
            storyVariations: [],
        });

        return NextResponse.json(subBlock);
    } catch (error: any) {
        console.error('Error creating sub-block:', error);
        return NextResponse.json({ error: error.message || 'Failed to create sub-block' }, { status: 500 });
    }
}

// PUT /api/sub-blocks (id in body)
export async function PUT(request: NextRequest) {
    try {
        const userId = await getNumericUserIdFromRequest(request);
        if (!userId) {
            return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
        }

        const body = await request.json();
        const validation = updateSubBlockSchema.safeParse(body);

        if (!validation.success) {
            return NextResponse.json({ error: 'Invalid request', details: validation.error.format() }, { status: 400 });
        }

        const { id, storyVariations, selectedVariationId, platformContents, name, prompt } = validation.data;

        await subBlockStorage.ensureLoaded();
        const existing = await subBlockStorage.getByUserId(id, userId);
        if (!existing) {
            return NextResponse.json({ error: 'Sub-block not found' }, { status: 404 });
        }

        const updates: any = {};
        if (storyVariations) updates.storyVariations = storyVariations;
        if (selectedVariationId !== undefined) updates.selectedVariationId = selectedVariationId;
        if (platformContents) updates.platformContents = platformContents;
        if (name !== undefined) updates.name = name.trim();
        if (prompt !== undefined) updates.prompt = prompt.trim();

        const updated = await subBlockStorage.update(id, updates);
        return NextResponse.json(updated);
    } catch (error: any) {
        console.error('Error updating sub-block:', error);
        return NextResponse.json({ error: error.message || 'Failed to update sub-block' }, { status: 500 });
    }
}

// DELETE /api/sub-blocks?id=xxx
export async function DELETE(request: NextRequest) {
    try {
        const userId = await getNumericUserIdFromRequest(request);
        if (!userId) {
            return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
        }

        const { searchParams } = new URL(request.url);
        const id = searchParams.get('id');
        if (!id) {
            return NextResponse.json({ error: 'id is required' }, { status: 400 });
        }

        await subBlockStorage.ensureLoaded();
        const existing = await subBlockStorage.getByUserId(id, userId);
        if (!existing) {
            return NextResponse.json({ error: 'Sub-block not found' }, { status: 404 });
        }

        await subBlockStorage.delete(id);
        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error('Error deleting sub-block:', error);
        return NextResponse.json({ error: error.message || 'Failed to delete sub-block' }, { status: 500 });
    }
}
