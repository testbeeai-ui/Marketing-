import { NextRequest, NextResponse } from 'next/server';
import { subBlockStorage } from '@/lib/services/subBlockStorage';
import { blockStorage } from '@/lib/services/blockStorage';
import { getNumericUserIdFromRequest } from '@/lib/auth-server';
import { createSubBlockSchema, updateSubBlockSchema } from '@/lib/validations/api';

// GET /api/sub-blocks?blockId=xxx or /api/sub-blocks?id=xxx
export async function GET(request: NextRequest) {
    try {
        const userId = await getNumericUserIdFromRequest(request);
        if (!userId) {
            return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
        }

        const { searchParams } = new URL(request.url);
        const id = searchParams.get('id');
        const blockId = searchParams.get('blockId');

        await subBlockStorage.ensureLoaded();
        if (id) {
            const subBlock = await subBlockStorage.getByUserId(id, userId);
            if (!subBlock) {
                return NextResponse.json({ error: 'Sub-block not found' }, { status: 404 });
            }
            return NextResponse.json(subBlock);
        }

        if (!blockId) {
            return NextResponse.json({ error: 'blockId is required' }, { status: 400 });
        }
        const subBlocks = await subBlockStorage.getAllByBlockId(blockId, userId);
        return NextResponse.json(subBlocks);
    } catch (error: any) {
        console.error('Error fetching sub-blocks:', error);
        return NextResponse.json({ error: error.message || 'Failed to fetch sub-blocks' }, { status: 500 });
    }
}

// POST /api/sub-blocks (create)
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

        const now = new Date().toISOString();
        const subBlock = await subBlockStorage.create({
            id: crypto.randomUUID(),
            userId,
            blockId,
            name: name.trim(),
            prompt: prompt || '',
            storyVariations: [],
            createdAt: now,
            updatedAt: now
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

        // Create updated sub-block object
        const updatedSubBlock = {
            ...existing,
            name: name !== undefined ? name.trim() : existing.name,
            prompt: prompt !== undefined ? prompt.trim() : existing.prompt,
            storyVariations: storyVariations !== undefined ? storyVariations : existing.storyVariations,
            selectedVariationId: selectedVariationId !== undefined ? selectedVariationId : existing.selectedVariationId,
            platformContents: platformContents !== undefined ? platformContents : existing.platformContents,
            updatedAt: new Date().toISOString()
        };

        const updated = await subBlockStorage.update(updatedSubBlock);
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
