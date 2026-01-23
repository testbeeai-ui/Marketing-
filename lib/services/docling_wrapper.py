import sys
import os
from docling.document_converter import DocumentConverter

# Set UTF-8 encoding for stdout to handle special characters correctly
sys.stdout.reconfigure(encoding='utf-8')

    print(f"Starting processing for file: {file_path}", file=sys.stderr)
    try:
        # Check if file exists
        if not os.path.exists(file_path):
            print(f"Error: File does not exist at {file_path}", file=sys.stderr)
            return None

        print("Initializing DocumentConverter...", file=sys.stderr)
        converter = DocumentConverter()
        
        print("Converting document...", file=sys.stderr)
        result = converter.convert(file_path)
        
        print("Exporting to markdown...", file=sys.stderr)
        # Export to markdown
        output = result.document.export_to_markdown()
        print("Processing complete.", file=sys.stderr)
        return output
    except Exception as e:
        import traceback
        traceback.print_exc(file=sys.stderr)
        print(f"Error processing file: {e}", file=sys.stderr)
        sys.exit(1)

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python docling_wrapper.py <file_path>", file=sys.stderr)
        sys.exit(1)
    
    file_path = sys.argv[1]
    
    # Process the file
    result = process_file(file_path)
    if result:
        print(result)
    else:
        sys.exit(1)
