import { NextRequest, NextResponse } from 'next/server';
import { fileProcessor } from '@/lib/services/fileProcessor';
import { vectorStore } from '@/lib/services/vectorStore';
import { knowledgeBase } from '@/lib/services/knowledgeBase';
import { blockStorage } from '@/lib/services/blockStorage';
import { getNumericUserIdFromRequest } from '@/lib/auth-server';

// Note: File uploads in Next.js API routes need special handling
// This is a simplified version - for production, consider using formidable or similar

// GET /api/files?blockId=xxx
export async function GET(request: NextRequest) {
    try {
        const userId = await getNumericUserIdFromRequest(request);
        if (!userId) {
            return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
        }

        const { searchParams } = new URL(request.url);
        const blockId = searchParams.get('blockId');

        if (!blockId) {
            return NextResponse.json({ error: 'blockId is required' }, { status: 400 });
        }

        await blockStorage.ensureLoaded();
        const block = await blockStorage.getByUserId(blockId, userId);
        if (!block) {
            return NextResponse.json({ error: 'Block not found' }, { status: 404 });
        }

        const files = await knowledgeBase.getDocumentsByBlock(blockId);
        const response = files.map(f => ({
            id: f.id,
            name: f.fileName,
            status: f.status,
            fileSize: f.fileSize,
            uploadedAt: f.uploadedAt
        }));

        return NextResponse.json(response);
    } catch (error: any) {
        console.error('Error listing files:', error);
        return NextResponse.json({ error: error.message || 'Failed to list files' }, { status: 500 });
    }
}

// POST /api/files - Upload file
export async function POST(request: NextRequest) {
    try {
        const userId = await getNumericUserIdFromRequest(request);
        if (!userId) {
            return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
        }

        const formData = await request.formData();
        const file = formData.get('file') as File | null;
        const blockId = formData.get('blockId') as string | null;

        if (!file) {
            return NextResponse.json({ error: 'No file provided' }, { status: 400 });
        }

        if (!blockId) {
            return NextResponse.json({ error: 'blockId is required' }, { status: 400 });
        }

        await blockStorage.ensureLoaded();
        const block = await blockStorage.getByUserId(blockId, userId);
        if (!block) {
            return NextResponse.json({ error: 'Block not found. Please create a block first.' }, { status: 404 });
        }

        const fileId = `${Date.now()}-${file.name}`;
        const buffer = Buffer.from(await file.arrayBuffer());

        // Add to Knowledge Base
        await knowledgeBase.addDocument({
            id: fileId,
            blockId,
            fileName: file.name,
            content: '',
            fileSize: file.size,
            uploadedAt: new Date().toISOString(),
            status: 'indexing',
        });

        // Process file
        const text = await fileProcessor.processFile(buffer, file.type, file.name);

        // Update Knowledge Base with content
        const doc = await knowledgeBase.getDocument(fileId);
        if (doc) {
            doc.content = text;
            doc.status = 'ready';
            await knowledgeBase.addDocument(doc);
        }

        // Chunk text
        const chunks = fileProcessor.chunkText(text);

        // Generate embeddings and store
        await vectorStore.addChunks(blockId, fileId, chunks, file.name, userId);

        return NextResponse.json({
            id: fileId,
            name: file.name,
            status: 'ready' as const,
            chunkCount: chunks.length,
        });
    } catch (error: any) {
        console.error('Error uploading file:', error);
        return NextResponse.json({ error: error.message || 'Failed to process file' }, { status: 500 });
    }
}

// DELETE /api/files?fileId=xxx
export async function DELETE(request: NextRequest) {
    try {
        const userId = await getNumericUserIdFromRequest(request);
        if (!userId) {
            return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
        }

        const { searchParams } = new URL(request.url);
        const fileId = searchParams.get('fileId');

        if (!fileId) {
            return NextResponse.json({ error: 'fileId is required' }, { status: 400 });
        }

        await vectorStore.deleteByFileId(fileId);
        await knowledgeBase.deleteDocument(fileId);

        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error('Error deleting file:', error);
        return NextResponse.json({ error: error.message || 'Failed to delete file' }, { status: 500 });
    }
}
