import { NextRequest, NextResponse } from 'next/server';
import { blockStorage } from '@/lib/services/blockStorage';
import { knowledgeBase } from '@/lib/services/knowledgeBase';
import { vectorStore } from '@/lib/services/vectorStore';
import { storyCache } from '@/lib/services/storyCache';
import { subBlockStorage } from '@/lib/services/subBlockStorage';
import { getAuthenticatedUser, getUserIdFromRequest, createAuthenticatedClient } from '@/lib/auth-server';
import { isDemoOrganizationId, isPublicDemoOrganizationId } from '@/lib/constants';

function getRelativeTime(dateString: string): string {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} minute${diffMins > 1 ? 's' : ''} ago`;
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
}

// GET /api/blocks - Get all blocks or single block with ?id=xxx&organizationId=xxx
export async function GET(request: NextRequest) {
    try {
        const auth = await getAuthenticatedUser(request);
        if (!auth) {
            console.warn('[API] GET /api/blocks - Authentication failed: no user');
            return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
        }
        const { user, supabase: supabaseAuth } = auth;
        const userId = user.id;

        const { searchParams } = new URL(request.url);
        const id = searchParams.get('id');
        const organizationId = searchParams.get('organizationId');

        if (!organizationId) {
            return NextResponse.json({ error: 'Organization ID is required' }, { status: 400 });
        }

        const isPublicDemo = isPublicDemoOrganizationId(organizationId);
        if (!isPublicDemo && !isDemoOrganizationId(organizationId)) {
            const { data: membership } = await supabaseAuth
                .from('organization_members')
                .select('role')
                .eq('organization_id', organizationId)
                .eq('user_id', userId)
                .single();
            if (!membership) {
                return NextResponse.json({ error: 'Not a member of this organization' }, { status: 403 });
            }
        }

        await blockStorage.ensureLoaded();

        if (id) {
            console.log(`[API] Fetching specific block ${id} for organization ${organizationId}`);
            const block = await blockStorage.getByOrganizationId(id, organizationId, supabaseAuth);
            if (!block) {
                console.warn(`[API] Block ${id} not found for organization ${organizationId}`);
                return NextResponse.json({ error: 'Block not found' }, { status: 404 });
            }
            const files = await knowledgeBase.getDocumentsByBlock(block.id);
            return NextResponse.json({
                ...block,
                fileCount: files.filter(f => f.status === 'ready').length,
                lastUpdated: getRelativeTime(block.updatedAt),
                status: 'ready' as const,
            });
        }

        console.log(`[API] Fetching all blocks for organization ${organizationId}`);
        const blocksArray = await blockStorage.getAllByOrganizationId(organizationId, supabaseAuth);
        console.log(`[API] Found ${blocksArray.length} blocks for organization ${organizationId}`);
        
        // Optimization: Fetch all related data in parallel (3 DB calls total instead of N+1)
        const blockIds = blocksArray.map(b => b.id);
        
        const [allFiles, allSubBlocks] = await Promise.all([
            knowledgeBase.getDocumentsMetadataByBlockIds(blockIds),
            subBlockStorage.getSubBlocksMetadataByBlockIds(blockIds)
        ]);

        // Group by blockId in memory
        const filesByBlock = new Map<string, typeof allFiles>();
        allFiles.forEach(f => {
            const current = filesByBlock.get(f.blockId) || [];
            current.push(f);
            filesByBlock.set(f.blockId, current);
        });

        const subBlocksByBlock = new Map<string, number>();
        allSubBlocks.forEach(s => {
            const count = subBlocksByBlock.get(s.blockId) || 0;
            subBlocksByBlock.set(s.blockId, count + 1);
        });

        const blocksWithCounts = blocksArray.map(block => {
            const blockFiles = filesByBlock.get(block.id) || [];
            const subBlockCount = subBlocksByBlock.get(block.id) || 0;
            
            return {
                ...block,
                fileCount: blockFiles.filter(f => f.status === 'ready').length,
                subBlockCount,
                lastUpdated: getRelativeTime(block.updatedAt),
                status: 'ready' as const,
            };
        });

        return NextResponse.json(blocksWithCounts);
    } catch (error: any) {
        console.error('Error fetching blocks:', error);
        return NextResponse.json({ error: error.message || 'Failed to fetch blocks' }, { status: 500 });
    }
}

// POST /api/blocks - Create new block
export async function POST(request: NextRequest) {
    try {
        const userId = await getUserIdFromRequest(request);
        const supabase = await createAuthenticatedClient();
        if (!userId) {
            return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
        }

        await blockStorage.ensureLoaded();
        const { name, description, organizationId } = await request.json();

        if (!name || typeof name !== 'string' || !name.trim()) {
            return NextResponse.json({ error: 'Name is required and must be a non-empty string' }, { status: 400 });
        }

        if (!organizationId) {
            return NextResponse.json({ error: 'Organization ID is required' }, { status: 400 });
        }

        const { data: membership } = await supabase
            .from('organization_members')
            .select('role')
            .eq('organization_id', organizationId)
            .eq('user_id', userId)
            .single();
        if (!membership) {
            return NextResponse.json({ error: 'Not a member of this organization' }, { status: 403 });
        }
        if ((isDemoOrganizationId(organizationId) || isPublicDemoOrganizationId(organizationId)) && membership.role !== 'owner' && membership.role !== 'admin') {
            return NextResponse.json({ error: 'Cannot create blocks in demo organization. Request access to a real organization.' }, { status: 403 });
        }

        const id = Date.now().toString();
        const now = new Date().toISOString();

        const block = {
            id,
            userId,
            organizationId,
            name: name.trim(),
            description: (description || '').trim(),
            createdAt: now,
            updatedAt: now,
        };

        const createdBlock = await blockStorage.create(block, supabase);
        console.log('Block created successfully:', createdBlock.id, createdBlock.name);

        return NextResponse.json({
            ...createdBlock,
            fileCount: 0,
            lastUpdated: 'Just now',
            status: 'ready' as const,
        });
    } catch (error: any) {
        console.error('Error creating block:', error);
        
        // Provide helpful error message for migration issues
        let errorMessage = error.message || 'Failed to create block';
        if (errorMessage.includes('organization_id') || errorMessage.includes('schema cache')) {
            errorMessage = errorMessage + 
                '\n\nPlease ensure database migrations have been run. ' +
                'See MIGRATION_GUIDE.md for instructions.';
        }
        
        return NextResponse.json({ error: errorMessage }, { status: 500 });
    }
}

// PUT /api/blocks - Update block (requires id and organizationId in body)
export async function PUT(request: NextRequest) {
    try {
        const userId = await getUserIdFromRequest(request);
        const supabase = await createAuthenticatedClient();
        if (!userId) {
            return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
        }

        const { id, name, description, organizationId } = await request.json();
        if (!id) {
            return NextResponse.json({ error: 'Block id is required' }, { status: 400 });
        }

        if (!organizationId) {
            return NextResponse.json({ error: 'Organization ID is required' }, { status: 400 });
        }

        const { data: membership } = await supabase
            .from('organization_members')
            .select('role')
            .eq('organization_id', organizationId)
            .eq('user_id', userId)
            .single();
        if (!membership) {
            return NextResponse.json({ error: 'Not a member of this organization' }, { status: 403 });
        }
        if ((isDemoOrganizationId(organizationId) || isPublicDemoOrganizationId(organizationId)) && membership.role !== 'owner' && membership.role !== 'admin') {
            return NextResponse.json({ error: 'Cannot update blocks in demo organization.' }, { status: 403 });
        }

        const block = await blockStorage.getByOrganizationId(id, organizationId, supabase);
        if (!block) {
            return NextResponse.json({ error: 'Block not found' }, { status: 404 });
        }

        if (name) block.name = name.trim();
        if (description !== undefined) block.description = description.trim();
        block.updatedAt = new Date().toISOString();

        await blockStorage.update(block, supabase);

        const files = await knowledgeBase.getDocumentsByBlock(block.id);
        return NextResponse.json({
            ...block,
            fileCount: files.filter(f => f.status === 'ready').length,
            lastUpdated: getRelativeTime(block.updatedAt),
            status: 'ready' as const,
        });
    } catch (error: any) {
        console.error('Error updating block:', error);
        return NextResponse.json({ error: error.message || 'Failed to update block' }, { status: 500 });
    }
}

// DELETE /api/blocks?id=xxx&organizationId=xxx
export async function DELETE(request: NextRequest) {
    try {
        const userId = await getUserIdFromRequest(request);
        const supabase = await createAuthenticatedClient();
        if (!userId) {
            return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
        }

        const { searchParams } = new URL(request.url);
        const id = searchParams.get('id');
        const organizationId = searchParams.get('organizationId');
        
        if (!id) {
            return NextResponse.json({ error: 'Block id is required' }, { status: 400 });
        }

        if (!organizationId) {
            return NextResponse.json({ error: 'Organization ID is required' }, { status: 400 });
        }

        const { data: membership } = await supabase
            .from('organization_members')
            .select('role')
            .eq('organization_id', organizationId)
            .eq('user_id', userId)
            .single();
        if (!membership) {
            return NextResponse.json({ error: 'Not a member of this organization' }, { status: 403 });
        }
        if ((isDemoOrganizationId(organizationId) || isPublicDemoOrganizationId(organizationId)) && membership.role !== 'owner' && membership.role !== 'admin') {
            return NextResponse.json({ error: 'Cannot delete blocks in demo organization.' }, { status: 403 });
        }

        console.log(`[API] Deleting block ${id} for organization ${organizationId}`);
        const block = await blockStorage.getByOrganizationId(id, organizationId, supabase);
        
        if (!block) {
            console.warn(`[API] Block ${id} not found for organization ${organizationId} - cannot delete`);
            return NextResponse.json({ error: 'Block not found' }, { status: 404 });
        }

        console.log(`[API] Block found, proceeding with deletion of related resources`);
        
        // 1. Get files to delete their embeddings and records
        const files = await knowledgeBase.getDocumentsByBlock(block.id);
        console.log(`[API] Deleting ${files.length} files associated with block`);
        
        await Promise.all(
            files.map(async (file) => {
                await vectorStore.deleteByFileId(file.id);
                await knowledgeBase.deleteDocument(file.id);
            })
        );

        // 2. Delete block-level embeddings
        await vectorStore.deleteByBlockId(block.id);
        
        // 3. Clear story cache
        storyCache.deleteByBlockId(block.id);
        
        // 4. Delete sub-blocks
        await subBlockStorage.deleteByBlockId(block.id, userId);
        
        // 5. Finally delete the block itself
        await blockStorage.delete(block.id, supabase);

        console.log(`[API] Block ${id} deleted successfully`);
        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error('Error deleting block:', error);
        return NextResponse.json({ error: error.message || 'Failed to delete block' }, { status: 500 });
    }
}