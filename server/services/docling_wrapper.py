import sys
import json
import os
import traceback

# Force UTF-8 encoding for stdout (fixes Windows charmap errors)
sys.stdout.reconfigure(encoding='utf-8')
from docling.document_converter import DocumentConverter

def process_file(file_path):
    try:
        # Initialize the converter
        converter = DocumentConverter()
        
        # Convert the file
        result = converter.convert(file_path)
        
        # Export to markdown
        markdown = result.document.export_to_markdown()
        
        # Output the result to stdout
        print(markdown)
        
    except Exception as e:
        # Print error to stderr so the calling process can capture it
        print(f"Error processing file: {str(e)}", file=sys.stderr)
        traceback.print_exc(file=sys.stderr)
        sys.exit(1)

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python docling_wrapper.py <file_path>", file=sys.stderr)
        sys.exit(1)
        
    file_path = sys.argv[1]
    
    if not os.path.exists(file_path):
        print(f"File not found: {file_path}", file=sys.stderr)
        sys.exit(1)
        
    process_file(file_path)
