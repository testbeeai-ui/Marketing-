import { NextRequest, NextResponse } from 'next/server';
import { fileProcessor } from '@/lib/services/fileProcessor';
import { vectorStore } from '@/lib/services/vectorStore';
import { knowledgeBase } from '@/lib/services/knowledgeBase';
import { blockStorage } from '@/lib/services/blockStorage';
import { getUserIdFromRequest } from '@/lib/auth-server';

export async function POST(request: NextRequest) {
  try {
    // Get user ID from request
    const userId = await getUserIdFromRequest(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Parse form data
    const formData = await request.formData();
    const file = formData.get('file') as File;
    
    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    // Validate file size (10MB limit)
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
      return NextResponse.json({ error: 'File size exceeds 10MB limit' }, { status: 400 });
    }

    // Validate file type
    const allowedTypes = [
      'text/plain',
      'text/markdown',
      'application/json',
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/msword'
    ];
    
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json({ error: 'Unsupported file type' }, { status: 400 });
    }

    // Process the file
    const buffer = await file.arrayBuffer();
    const content = new TextDecoder().decode(buffer);
    
    // Create file record
    const fileRecord = await fileProcessor.processFile({
      name: file.name,
      type: file.type,
      size: file.size,
      content,
      userId
    });

    // Store in knowledge base
    const knowledgeItem = await knowledgeBase.addFile({
      fileId: fileRecord.id,
      userId,
      content,
      metadata: {
        name: file.name,
        type: file.type,
        size: file.size
      }
    });

    // Generate vectors for the content
    const vectors = await vectorStore.generateVectors(content);
    await vectorStore.storeVectors({
      contentId: knowledgeItem.id,
      vectors,
      userId
    });

    // Create blocks from the content
    const blocks = await blockStorage.createBlocksFromContent({
      content,
      fileId: fileRecord.id,
      userId
    });

    return NextResponse.json({
      success: true,
      file: fileRecord,
      knowledgeItem,
      blocksCreated: blocks.length
    });

  } catch (error) {
    console.error('File upload error:', error);
    return NextResponse.json(
      { error: 'Failed to process file', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const userId = await getUserIdFromRequest(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user's files
    const files = await fileProcessor.getUserFiles(userId);
    
    return NextResponse.json({ files });

  } catch (error) {
    console.error('Get files error:', error);
    return NextResponse.json(
      { error: 'Failed to retrieve files', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const userId = await getUserIdFromRequest(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const fileId = searchParams.get('fileId');
    
    if (!fileId) {
      return NextResponse.json({ error: 'File ID required' }, { status: 400 });
    }

    // Delete file and related data
    await fileProcessor.deleteFile(fileId, userId);
    await knowledgeBase.removeFile(fileId, userId);
    await vectorStore.deleteVectors(fileId, userId);
    await blockStorage.deleteFileBlocks(fileId, userId);

    return NextResponse.json({ success: true });

  } catch (error) {
    console.error('Delete file error:', error);
    return NextResponse.json(
      { error: 'Failed to delete file', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}