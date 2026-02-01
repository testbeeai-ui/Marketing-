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
    const documentBlockId = formData.get('blockId') as string;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    if (!documentBlockId) {
      return NextResponse.json({ error: 'No blockId provided' }, { status: 400 });
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

    // Ensure block exists for this user
    await blockStorage.ensureLoaded();
    const existingBlock = await blockStorage.getByUserId(documentBlockId, userId);
    if (!existingBlock) {
      return NextResponse.json({ error: 'Block not found' }, { status: 404 });
    }

    // Process the file
    const buffer = await file.arrayBuffer();

    // Handle different file types appropriately
    let content: string;
    const isTextFile = file.type.startsWith('text/') ||
      file.type === 'application/json' ||
      file.type === 'application/javascript' ||
      file.type === 'application/typescript';

    if (isTextFile) {
      content = new TextDecoder().decode(buffer);
    } else {
      // For binary files (PDF, DOCX), convert to base64 for processing
      content = Buffer.from(buffer).toString('base64');
    }

    // Create file record
    const fileRecord = await fileProcessor.processFile({
      name: file.name,
      type: file.type,
      size: file.size,
      content,
      userId
    });

    const extractedText = fileRecord.content;
    const storedFileName = file.name || fileRecord.name || 'Untitled document';

    // Store in knowledge base as a document
    const documentId = `doc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    await knowledgeBase.addDocument({
      id: documentId,
      blockId: documentBlockId, // Use the actual blockId from form data
      fileName: storedFileName,
      content: extractedText,
      fileSize: extractedText.length,
      uploadedAt: new Date().toISOString(),
      status: 'ready'
    });

    // Generate vectors for the content (chunked)
    const chunks = fileProcessor.chunkText(extractedText, 2000, 200);

    // Store each chunk as a vector
    for (let i = 0; i < chunks.length; i++) {
      const chunkId = `chunk_${documentId}_${i}`;

      // Add a small delay between chunks to avoid hitting rate limits (quota exceeded)
      if (i > 0) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }

      await vectorStore.storeChunk(
        chunkId,
        userId,
        documentBlockId,
        documentId,
        chunks[i],
        {
          fileName: storedFileName,
          chunkIndex: i
        }
      );
    }

    return NextResponse.json({
      success: true,
      file: fileRecord,
      document: {
        id: documentId,
        fileName: storedFileName,
        fileSize: extractedText.length,
        uploadedAt: new Date().toISOString(),
        status: 'ready'
      },
      blocksCreated: 0
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

    const { searchParams } = new URL(request.url);
    const blockId = searchParams.get('blockId');

    let files;
    if (blockId) {
      // Get files for specific block (for backward compatibility)
      files = await knowledgeBase.getDocumentsByBlock(blockId);
    } else {
      // Get all user's files (new functionality)
      files = await knowledgeBase.getDocumentsByUserId(userId);
    }

    const normalizedFiles = (files || []).map((file: any) => ({
      id: file.id,
      name: file.name ?? file.fileName ?? file.file_name ?? 'Untitled document',
      status: file.status ?? 'ready',
      fileSize: file.fileSize ?? file.file_size,
      uploadedAt: file.uploadedAt ?? file.uploaded_at,
    }));

    return NextResponse.json(normalizedFiles);

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
    await knowledgeBase.deleteDocumentByFileIdAndUserId(fileId, userId);
    await vectorStore.deleteByFileId(fileId);
    return NextResponse.json({ success: true });

  } catch (error) {
    console.error('Delete file error:', error);
    return NextResponse.json(
      { error: 'Failed to delete file', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
