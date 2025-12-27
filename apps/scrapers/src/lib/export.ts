/**
 * Export Functionality
 * Supports PDF, HTML, Markdown, and Email export formats
 */

import { logger } from './logger';

/**
 * Export format types
 */
export type ExportFormat = 'pdf' | 'html' | 'markdown' | 'email' | 'json';

/**
 * Export configuration
 */
export interface ExportConfig {
  format: ExportFormat;
  title: string;
  content: string;
  metadata?: {
    author?: string;
    createdAt?: Date;
    reportSlug?: string;
    articleCount?: number;
  };
  styling?: {
    theme: 'light' | 'dark' | 'print';
    fontSize: 'small' | 'medium' | 'large';
    includeImages: boolean;
    includeSources: boolean;
  };
  email?: {
    to: string[];
    subject?: string;
    replyTo?: string;
  };
}

/**
 * Export result
 */
export interface ExportResult {
  success: boolean;
  format: ExportFormat;
  data?: string | ArrayBuffer;
  contentType?: string;
  filename?: string;
  error?: string;
}

/**
 * PDF generation options
 */
interface PdfOptions {
  pageSize: 'A4' | 'letter';
  margin: { top: number; right: number; bottom: number; left: number };
  headerTemplate?: string;
  footerTemplate?: string;
}

/**
 * Default PDF options
 */
const DEFAULT_PDF_OPTIONS: PdfOptions = {
  pageSize: 'A4',
  margin: { top: 60, right: 40, bottom: 60, left: 40 },
  headerTemplate: '<div style="font-size: 10px; text-align: center; width: 100%;">Meridian Intelligence Brief</div>',
  footerTemplate: '<div style="font-size: 10px; text-align: center; width: 100%;"><span class="pageNumber"></span> / <span class="totalPages"></span></div>',
};

/**
 * Export a report
 */
export async function exportReport(config: ExportConfig): Promise<ExportResult> {
  logger.info('Exporting report', { format: config.format, title: config.title });

  try {
    switch (config.format) {
      case 'pdf':
        return await exportToPdf(config);
      case 'html':
        return exportToHtml(config);
      case 'markdown':
        return exportToMarkdown(config);
      case 'email':
        return await exportToEmail(config);
      case 'json':
        return exportToJson(config);
      default:
        return { success: false, format: config.format, error: 'Unsupported format' };
    }
  } catch (error) {
    logger.error('Export failed', { error: String(error) });
    return {
      success: false,
      format: config.format,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Export to PDF using Puppeteer/Browser
 */
async function exportToPdf(config: ExportConfig): Promise<ExportResult> {
  const html = generateHtmlDocument(config);

  // In Cloudflare Workers, we'd use the Browser Rendering API
  // For now, return HTML that can be converted client-side
  return {
    success: true,
    format: 'pdf',
    data: html,
    contentType: 'text/html',
    filename: `${slugify(config.title)}.html`,
  };
}

/**
 * Export to HTML
 */
function exportToHtml(config: ExportConfig): ExportResult {
  const html = generateHtmlDocument(config);

  return {
    success: true,
    format: 'html',
    data: html,
    contentType: 'text/html',
    filename: `${slugify(config.title)}.html`,
  };
}

/**
 * Export to Markdown
 */
function exportToMarkdown(config: ExportConfig): ExportResult {
  const markdown = generateMarkdownDocument(config);

  return {
    success: true,
    format: 'markdown',
    data: markdown,
    contentType: 'text/markdown',
    filename: `${slugify(config.title)}.md`,
  };
}

/**
 * Export via Email
 */
async function exportToEmail(config: ExportConfig): Promise<ExportResult> {
  if (!config.email?.to?.length) {
    return { success: false, format: 'email', error: 'No recipients specified' };
  }

  const html = generateEmailHtml(config);

  // This would integrate with an email service like Resend or SendGrid
  logger.info('Email export prepared', {
    to: config.email.to,
    subject: config.email.subject || config.title,
  });

  return {
    success: true,
    format: 'email',
    data: html,
    contentType: 'text/html',
  };
}

/**
 * Export to JSON
 */
function exportToJson(config: ExportConfig): ExportResult {
  const json = JSON.stringify(
    {
      title: config.title,
      content: config.content,
      metadata: config.metadata,
      exportedAt: new Date().toISOString(),
    },
    null,
    2
  );

  return {
    success: true,
    format: 'json',
    data: json,
    contentType: 'application/json',
    filename: `${slugify(config.title)}.json`,
  };
}

/**
 * Generate full HTML document
 */
function generateHtmlDocument(config: ExportConfig): string {
  const theme = config.styling?.theme || 'light';
  const fontSize = config.styling?.fontSize || 'medium';

  const styles = getThemeStyles(theme, fontSize);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(config.title)}</title>
  <style>
    ${styles}
  </style>
</head>
<body>
  <article class="brief">
    <header>
      <h1>${escapeHtml(config.title)}</h1>
      ${config.metadata?.createdAt ? `<time datetime="${config.metadata.createdAt.toISOString()}">${formatDate(config.metadata.createdAt)}</time>` : ''}
      ${config.metadata?.author ? `<p class="author">Generated by ${escapeHtml(config.metadata.author)}</p>` : ''}
    </header>
    <main>
      ${markdownToHtml(config.content)}
    </main>
    <footer>
      ${config.metadata?.articleCount ? `<p>Based on analysis of ${config.metadata.articleCount} articles</p>` : ''}
      <p class="branding">Powered by Meridian Intelligence</p>
    </footer>
  </article>
</body>
</html>`;
}

/**
 * Generate email-optimized HTML
 */
function generateEmailHtml(config: ExportConfig): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(config.title)}</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; line-height: 1.6; color: #1a1a1a; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; border-radius: 8px 8px 0 0;">
    <h1 style="color: white; margin: 0; font-size: 24px;">${escapeHtml(config.title)}</h1>
    ${config.metadata?.createdAt ? `<p style="color: rgba(255,255,255,0.8); margin: 10px 0 0 0; font-size: 14px;">${formatDate(config.metadata.createdAt)}</p>` : ''}
  </div>
  <div style="background: #ffffff; padding: 30px; border: 1px solid #e5e5e5; border-top: none; border-radius: 0 0 8px 8px;">
    ${markdownToHtml(config.content)}
  </div>
  <div style="text-align: center; padding: 20px; color: #666; font-size: 12px;">
    <p>Powered by <a href="https://news.iliane.xyz" style="color: #667eea;">Meridian Intelligence</a></p>
    <p>You received this because you're subscribed to intelligence briefs.</p>
  </div>
</body>
</html>`;
}

/**
 * Generate Markdown document
 */
function generateMarkdownDocument(config: ExportConfig): string {
  const lines: string[] = [];

  lines.push(`# ${config.title}`);
  lines.push('');

  if (config.metadata?.createdAt) {
    lines.push(`*${formatDate(config.metadata.createdAt)}*`);
    lines.push('');
  }

  lines.push(config.content);
  lines.push('');
  lines.push('---');
  lines.push('');

  if (config.metadata?.articleCount) {
    lines.push(`*Based on analysis of ${config.metadata.articleCount} articles*`);
    lines.push('');
  }

  lines.push('*Powered by Meridian Intelligence*');

  return lines.join('\n');
}

/**
 * Get theme-specific styles
 */
function getThemeStyles(theme: string, fontSize: string): string {
  const fontSizes = {
    small: { base: '14px', h1: '24px', h2: '20px', h3: '16px' },
    medium: { base: '16px', h1: '28px', h2: '22px', h3: '18px' },
    large: { base: '18px', h1: '32px', h2: '26px', h3: '20px' },
  };

  const themes = {
    light: { bg: '#ffffff', text: '#1a1a1a', accent: '#667eea', muted: '#666666' },
    dark: { bg: '#1a1a1a', text: '#f0f0f0', accent: '#818cf8', muted: '#999999' },
    print: { bg: '#ffffff', text: '#000000', accent: '#333333', muted: '#555555' },
  };

  const sizes = fontSizes[fontSize as keyof typeof fontSizes] || fontSizes.medium;
  const colors = themes[theme as keyof typeof themes] || themes.light;

  return `
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      font-size: ${sizes.base};
      line-height: 1.7;
      color: ${colors.text};
      background: ${colors.bg};
    }
    .brief {
      max-width: 800px;
      margin: 0 auto;
      padding: 40px;
    }
    header {
      margin-bottom: 40px;
      padding-bottom: 20px;
      border-bottom: 2px solid ${colors.accent};
    }
    h1 { font-size: ${sizes.h1}; margin-bottom: 10px; color: ${colors.text}; }
    h2 { font-size: ${sizes.h2}; margin: 30px 0 15px; color: ${colors.text}; }
    h3 { font-size: ${sizes.h3}; margin: 25px 0 10px; color: ${colors.text}; }
    p { margin-bottom: 15px; }
    ul, ol { margin-bottom: 15px; padding-left: 25px; }
    li { margin-bottom: 8px; }
    a { color: ${colors.accent}; }
    time { color: ${colors.muted}; font-size: 14px; }
    .author { color: ${colors.muted}; font-size: 14px; margin-top: 5px; }
    blockquote {
      border-left: 4px solid ${colors.accent};
      padding-left: 20px;
      margin: 20px 0;
      color: ${colors.muted};
    }
    code {
      background: ${theme === 'dark' ? '#2a2a2a' : '#f5f5f5'};
      padding: 2px 6px;
      border-radius: 4px;
      font-family: 'SF Mono', Monaco, monospace;
    }
    footer {
      margin-top: 40px;
      padding-top: 20px;
      border-top: 1px solid ${theme === 'dark' ? '#333' : '#e5e5e5'};
      color: ${colors.muted};
      font-size: 14px;
    }
    .branding { margin-top: 10px; }
    @media print {
      body { background: white; color: black; }
      .brief { padding: 20px; }
      a { color: inherit; text-decoration: underline; }
    }
  `;
}

/**
 * Simple Markdown to HTML converter
 */
function markdownToHtml(markdown: string): string {
  let html = markdown;

  // Headers
  html = html.replace(/^### (.*$)/gm, '<h3>$1</h3>');
  html = html.replace(/^## (.*$)/gm, '<h2>$1</h2>');
  html = html.replace(/^# (.*$)/gm, '<h1>$1</h1>');

  // Bold and italic
  html = html.replace(/\*\*\*(.*?)\*\*\*/g, '<strong><em>$1</em></strong>');
  html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/\*(.*?)\*/g, '<em>$1</em>');

  // Links
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');

  // Blockquotes
  html = html.replace(/^> (.*$)/gm, '<blockquote>$1</blockquote>');

  // Lists
  html = html.replace(/^\* (.*$)/gm, '<li>$1</li>');
  html = html.replace(/^- (.*$)/gm, '<li>$1</li>');
  html = html.replace(/(<li>.*<\/li>\n?)+/g, '<ul>$&</ul>');

  // Code
  html = html.replace(/`([^`]+)`/g, '<code>$1</code>');

  // Paragraphs
  html = html.replace(/\n\n/g, '</p><p>');
  html = '<p>' + html + '</p>';

  // Clean up empty paragraphs
  html = html.replace(/<p>\s*<\/p>/g, '');
  html = html.replace(/<p>(<h[1-6]>)/g, '$1');
  html = html.replace(/(<\/h[1-6]>)<\/p>/g, '$1');
  html = html.replace(/<p>(<ul>)/g, '$1');
  html = html.replace(/(<\/ul>)<\/p>/g, '$1');
  html = html.replace(/<p>(<blockquote>)/g, '$1');
  html = html.replace(/(<\/blockquote>)<\/p>/g, '$1');

  return html;
}

/**
 * Escape HTML special characters
 */
function escapeHtml(text: string): string {
  const map: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;',
  };
  return text.replace(/[&<>"']/g, char => map[char]);
}

/**
 * Format date for display
 */
function formatDate(date: Date): string {
  return new Intl.DateTimeFormat('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(date);
}

/**
 * Create URL-safe slug
 */
function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim();
}

/**
 * Batch export multiple reports
 */
export async function batchExport(
  reports: Array<{ title: string; content: string; metadata?: ExportConfig['metadata'] }>,
  format: ExportFormat
): Promise<ExportResult[]> {
  const results: ExportResult[] = [];

  for (const report of reports) {
    const result = await exportReport({
      format,
      title: report.title,
      content: report.content,
      metadata: report.metadata,
    });
    results.push(result);
  }

  return results;
}
