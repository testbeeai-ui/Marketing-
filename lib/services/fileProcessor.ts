import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import { exec } from 'child_process';
import util from 'util';
import mammoth from 'mammoth';

const execPromise = util.promisify(exec);

/**
 * Process files using Docling via Python wrapper
 */
export class FileProcessor {

  async processFile(buffer: Buffer, mimetype: string, originalName?: string): Promise<string> {
    // Handle text-based files directly (JSON, TXT, CSV, etc.)
    const textBasedMimeTypes = [
      'application/json',
      'text/plain',
      'text/csv',
      'text/markdown',
      'text/html',
      'application/xml',
      'text/xml',
    ];

    const textBasedExtensions = ['.json', '.txt', '.csv', '.md', '.html', '.xml', '.log'];
    const fileExtension = originalName ? path.extname(originalName).toLowerCase() : '';

    // If it's a text-based file, read it directly without Docling
    if (textBasedMimeTypes.includes(mimetype.toLowerCase()) || textBasedExtensions.includes(fileExtension)) {
      try {
        const text = buffer.toString('utf-8');
        console.log(`[FileProcessor] Processed ${originalName || 'file'} as text (${text.length} characters)`);
        return text;
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        console.error('[FileProcessor] Error reading text file:', errorMessage);
        throw new Error(`Failed to read text file: ${errorMessage}`);
      }
    }

    // Handle DOCX files with mammoth (native Node.js parser)
    const docxMimeTypes = [
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/msword',
    ];
    if (docxMimeTypes.includes(mimetype.toLowerCase()) || fileExtension === '.docx' || fileExtension === '.doc') {
      try {
        console.log(`[FileProcessor] Using mammoth to process ${originalName || 'document'} (${mimetype})`);
        const result = await mammoth.extractRawText({ buffer });
        console.log(`[FileProcessor] Mammoth extracted ${result.value.length} characters from ${originalName || 'document'}`);
        return result.value;
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        console.error('[FileProcessor] Mammoth processing error:', errorMessage);
        throw new Error(`Failed to process Word document: ${errorMessage}`);
      }
    }

    // For documents (PDF, Word, etc.), use Docling
    // Use a safe filename or generic one if originalName is missing
    const safeName = originalName ? originalName.replace(/[^a-zA-Z0-9.-]/g, '_') : 'document';
    const tempDir = os.tmpdir();
    const tempFilePath = path.join(tempDir, `docling-${Date.now()}-${safeName}`);

    try {
      await fs.writeFile(tempFilePath, buffer);
      console.log(`[FileProcessor] Using Docling to process ${originalName || 'document'} (${mimetype})`);

      // Path to the python script
      const scriptPath = path.resolve(process.cwd(), 'server', 'services', 'docling_wrapper.py');

      // Execute python script
      // Using 'python' command - ensure it's in PATH and has docling installed
      // Increased maxBuffer to 50MB and added timeout
      const { stdout, stderr } = await execPromise(`python "${scriptPath}" "${tempFilePath}"`, {
        maxBuffer: 50 * 1024 * 1024, // 50MB buffer
        timeout: 120000 // 2 minute timeout
      });

      if (stderr && stderr.trim().length > 0) {
        console.debug('[FileProcessor] Docling stderr:', stderr);
      }

      const extractedText = stdout.trim();
      if (!extractedText) {
        throw new Error('Docling returned empty output');
      }

      console.log(`[FileProcessor] Docling extracted ${extractedText.length} characters from ${originalName || 'document'}`);
      return extractedText;

    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('[FileProcessor] Docling processing error:', errorMessage);

      // Fallback for PDFs: Use pdf-parse if Docling fails
      if (mimetype === 'application/pdf' || fileExtension === '.pdf') {
        try {
          console.log('[FileProcessor] Falling back to pdf-parse for PDF...');
          // eslint-disable-next-line @typescript-eslint/no-var-requires
          const pdfParse = require('pdf-parse');
          const data = await pdfParse(buffer);
          console.log(`[FileProcessor] pdf-parse extracted ${data.text.length} characters`);
          return data.text;
        } catch (pdfError) {
          console.error('[FileProcessor] pdf-parse fallback failed:', pdfError);
        }
      }

      // Check if it's a file format error
      if (errorMessage.includes('not valid') || errorMessage.includes('not supported')) {
        throw new Error(`File format not supported. Please upload PDF, Word documents, or text files (TXT, JSON, CSV, etc.). Error: ${errorMessage}`);
      }

      throw new Error(`Failed to process document: ${errorMessage}`);
    } finally {
      // Cleanup temp file
      await fs.unlink(tempFilePath).catch(() => { });
    }
  }

  /**
   * Split text into chunks for embedding
   */
  chunkText(text: string, chunkSize: number = 1000, overlap: number = 200): string[] {
    const chunks: string[] = [];
    let start = 0;

    while (start < text.length) {
      let end = start + chunkSize;

      // Try to break at sentence boundary
      if (end < text.length) {
        const lastPeriod = text.lastIndexOf('.', end);
        const lastNewline = text.lastIndexOf('\n', end);
        const breakPoint = Math.max(lastPeriod, lastNewline);

        if (breakPoint > start + chunkSize * 0.5) {
          end = breakPoint + 1;
        }
      }

      chunks.push(text.slice(start, end).trim());
      start = end - overlap;
    }

    return chunks.filter(chunk => chunk.length > 0);
  }
}

export const fileProcessor = new FileProcessor();
