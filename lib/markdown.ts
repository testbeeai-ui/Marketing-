/**
 * Simple markdown parser for rendering formatted text
 * Converts **text** to bold, preserves other formatting
 * Handles nested formatting and preserves line breaks
 */

export function renderMarkdown(text: string): string {
  if (!text) return '';

  let html = text;

  // First, escape HTML to prevent XSS (basic)
  html = html
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  // Headers (## Title)
  html = html.replace(/^### (.*$)/gm, '<h3 class="text-lg font-bold mt-4 mb-2">$1</h3>');
  html = html.replace(/^## (.*$)/gm, '<h2 class="text-xl font-bold mt-6 mb-3">$1</h2>');
  html = html.replace(/^# (.*$)/gm, '<h1 class="text-2xl font-bold mt-6 mb-4">$1</h1>');

  // Bold (**text**)
  html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');

  // Italic (*text*)
  html = html.replace(/(?<!\*)\*([^*]+?)\*(?!\*)/g, '<em>$1</em>');

  // Bullet Lists (- item)
  // We handle simple single-line list items. 
  // Wrapping in <ul> is complex with regex only, so we style lines individually or use simple replacement
  // For a clearer look, we can replace "- " with a bullet char + indent
  html = html.replace(/^\s*[-*]\s+(.*$)/gm, '<div class="flex gap-2 ml-4 mb-1"><span class="text-primary">•</span><span>$1</span></div>');

  // Blockquotes (> text)
  html = html.replace(/^>\s+(.*$)/gm, '<blockquote class="border-l-4 border-primary/50 pl-4 italic my-4 text-muted-foreground">$1</blockquote>');

  // Horizontal Rule (---)
  html = html.replace(/^---$/gm, '<hr class="my-6 border-border" />');

  // Line breaks - convert remaining newlines to <br> if not inside a block tag we just added
  // This is tricky with regex. 
  // Simplest approach for visual preview:
  // Split by specific block tags? 
  // Or just double-break = paragraph?

  // Let's preserve the original simple newline logic but avoid adding <br> after headers/divs
  html = html.replace(/\n/g, '<br />');

  // Cleanup: Remove <br> immediately after block elements to avoid extra spacing
  html = html.replace(/(<\/h[1-3]>|<\/div>|<\/blockquote>|<\/hr>)<br \/>/g, '$1');

  return html;
}

/**
 * Get plain text for copying (keeps markdown syntax)
 * The original text already has markdown, so we just return it
 */
export function getPlainText(text: string): string {
  return text || '';
}
