/**
 * Custom Report Builder
 * User-configurable report generation with templates and filters
 */

import { z } from 'zod';
import { generateText } from 'ai';
import { google } from '@ai-sdk/google';
import { logger } from './logger';

/**
 * Report template definition
 */
export interface ReportTemplate {
  id: string;
  name: string;
  description: string;
  sections: ReportSection[];
  styling: ReportStyling;
  schedule?: ReportSchedule;
  createdAt: Date;
  updatedAt: Date;
  isPublic: boolean;
  tags: string[];
}

/**
 * Report section configuration
 */
export interface ReportSection {
  id: string;
  type: SectionType;
  title: string;
  config: SectionConfig;
  order: number;
}

/**
 * Section types
 */
export type SectionType =
  | 'summary'         // AI-generated executive summary
  | 'headlines'       // Top headlines list
  | 'deep_dive'       // Detailed analysis of top story
  | 'trends'          // Trend charts and analysis
  | 'sentiment'       // Sentiment overview
  | 'sources'         // Source breakdown
  | 'entities'        // Key entities mentioned
  | 'custom'          // User-defined content
  | 'quote'           // Featured quote
  | 'statistics';     // Key statistics

/**
 * Section configuration
 */
export interface SectionConfig {
  // Content filters
  topics?: string[];
  regions?: string[];
  sourceIds?: number[];
  dateRange?: { start: Date; end: Date };
  sentiment?: 'all' | 'positive' | 'negative' | 'neutral';

  // Display options
  maxItems?: number;
  includeImages?: boolean;
  showSources?: boolean;
  showDates?: boolean;

  // AI options
  aiModel?: 'fast' | 'balanced' | 'quality';
  customPrompt?: string;
  maxTokens?: number;

  // Custom content
  customHtml?: string;
  customMarkdown?: string;
}

/**
 * Report styling
 */
export interface ReportStyling {
  theme: 'light' | 'dark' | 'corporate' | 'minimal';
  primaryColor: string;
  fontFamily: string;
  logoUrl?: string;
  headerHtml?: string;
  footerHtml?: string;
  customCss?: string;
}

/**
 * Report schedule
 */
export interface ReportSchedule {
  enabled: boolean;
  cronExpression: string;
  timezone: string;
  recipients: string[];
  format: 'email' | 'pdf' | 'both';
}

/**
 * Generated report
 */
export interface GeneratedReport {
  id: string;
  templateId: string;
  title: string;
  generatedAt: Date;
  sections: GeneratedSection[];
  metadata: {
    articleCount: number;
    sourceCount: number;
    dateRange: { start: string; end: string };
    generationTimeMs: number;
  };
}

/**
 * Generated section
 */
export interface GeneratedSection {
  id: string;
  type: SectionType;
  title: string;
  content: string;
  data?: unknown;
}

/**
 * Default report templates
 */
export const DEFAULT_TEMPLATES: Omit<ReportTemplate, 'id' | 'createdAt' | 'updatedAt'>[] = [
  {
    name: 'Daily Intelligence Brief',
    description: 'Comprehensive daily overview of key events',
    sections: [
      {
        id: 'summary',
        type: 'summary',
        title: 'Executive Summary',
        config: { aiModel: 'quality', maxTokens: 500 },
        order: 1,
      },
      {
        id: 'headlines',
        type: 'headlines',
        title: 'Top Headlines',
        config: { maxItems: 10, showSources: true, showDates: true },
        order: 2,
      },
      {
        id: 'deep-dive',
        type: 'deep_dive',
        title: 'Story of the Day',
        config: { maxItems: 1, aiModel: 'quality' },
        order: 3,
      },
      {
        id: 'trends',
        type: 'trends',
        title: 'Trend Analysis',
        config: { maxItems: 5 },
        order: 4,
      },
    ],
    styling: {
      theme: 'corporate',
      primaryColor: '#667eea',
      fontFamily: 'Inter, sans-serif',
    },
    isPublic: true,
    tags: ['daily', 'comprehensive'],
  },
  {
    name: 'Market Moving News',
    description: 'Focus on market-relevant developments',
    sections: [
      {
        id: 'summary',
        type: 'summary',
        title: 'Market Overview',
        config: {
          topics: ['finance', 'markets', 'economy'],
          aiModel: 'quality',
        },
        order: 1,
      },
      {
        id: 'headlines',
        type: 'headlines',
        title: 'Market Headlines',
        config: {
          topics: ['finance', 'markets', 'economy'],
          maxItems: 15,
        },
        order: 2,
      },
      {
        id: 'sentiment',
        type: 'sentiment',
        title: 'Market Sentiment',
        config: {},
        order: 3,
      },
    ],
    styling: {
      theme: 'minimal',
      primaryColor: '#1a1a1a',
      fontFamily: 'Georgia, serif',
    },
    isPublic: true,
    tags: ['finance', 'markets'],
  },
];

/**
 * Report builder class
 */
export class ReportBuilder {
  private templates: Map<string, ReportTemplate> = new Map();
  private kv: KVNamespace | undefined;

  constructor(kv?: KVNamespace) {
    this.kv = kv;
  }

  /**
   * Create a new template
   */
  async createTemplate(
    template: Omit<ReportTemplate, 'id' | 'createdAt' | 'updatedAt'>
  ): Promise<ReportTemplate> {
    const now = new Date();
    const fullTemplate: ReportTemplate = {
      ...template,
      id: crypto.randomUUID(),
      createdAt: now,
      updatedAt: now,
    };

    this.templates.set(fullTemplate.id, fullTemplate);

    if (this.kv) {
      await this.kv.put(
        `report_template:${fullTemplate.id}`,
        JSON.stringify(fullTemplate)
      );
    }

    logger.info('Report template created', {
      templateId: fullTemplate.id,
      name: fullTemplate.name,
    });

    return fullTemplate;
  }

  /**
   * Get template by ID
   */
  async getTemplate(templateId: string): Promise<ReportTemplate | null> {
    // Check memory cache
    const cached = this.templates.get(templateId);
    if (cached) return cached;

    // Check KV
    if (this.kv) {
      const stored = await this.kv.get<ReportTemplate>(
        `report_template:${templateId}`,
        'json'
      );
      if (stored) {
        this.templates.set(templateId, stored);
        return stored;
      }
    }

    return null;
  }

  /**
   * Update template
   */
  async updateTemplate(
    templateId: string,
    updates: Partial<ReportTemplate>
  ): Promise<ReportTemplate | null> {
    const template = await this.getTemplate(templateId);
    if (!template) return null;

    const updated: ReportTemplate = {
      ...template,
      ...updates,
      id: template.id,
      createdAt: template.createdAt,
      updatedAt: new Date(),
    };

    this.templates.set(templateId, updated);

    if (this.kv) {
      await this.kv.put(
        `report_template:${templateId}`,
        JSON.stringify(updated)
      );
    }

    return updated;
  }

  /**
   * Delete template
   */
  async deleteTemplate(templateId: string): Promise<boolean> {
    this.templates.delete(templateId);

    if (this.kv) {
      await this.kv.delete(`report_template:${templateId}`);
    }

    return true;
  }

  /**
   * List templates
   */
  async listTemplates(options: {
    tags?: string[];
    isPublic?: boolean;
    limit?: number;
  } = {}): Promise<ReportTemplate[]> {
    const templates: ReportTemplate[] = [];

    if (this.kv) {
      const listed = await this.kv.list({
        prefix: 'report_template:',
        limit: options.limit || 100,
      });

      for (const key of listed.keys) {
        const template = await this.kv.get<ReportTemplate>(key.name, 'json');
        if (!template) continue;

        // Apply filters
        if (options.isPublic !== undefined && template.isPublic !== options.isPublic) {
          continue;
        }

        if (options.tags?.length) {
          const hasTag = options.tags.some(t => template.tags.includes(t));
          if (!hasTag) continue;
        }

        templates.push(template);
      }
    }

    return templates;
  }

  /**
   * Generate report from template
   */
  async generateReport(
    templateId: string,
    articles: Array<{
      id: number;
      title: string;
      content: string;
      url: string;
      source: string;
      publishedAt: Date;
      topics?: string[];
      sentiment?: { score: number; label: string };
    }>,
    overrides?: Partial<ReportTemplate>
  ): Promise<GeneratedReport> {
    const startTime = Date.now();
    const template = await this.getTemplate(templateId);

    if (!template) {
      throw new Error(`Template not found: ${templateId}`);
    }

    // Apply overrides
    const finalTemplate = overrides
      ? { ...template, ...overrides }
      : template;

    const generatedSections: GeneratedSection[] = [];

    // Generate each section
    for (const section of finalTemplate.sections.sort((a, b) => a.order - b.order)) {
      const generated = await this.generateSection(section, articles);
      generatedSections.push(generated);
    }

    const report: GeneratedReport = {
      id: crypto.randomUUID(),
      templateId,
      title: finalTemplate.name,
      generatedAt: new Date(),
      sections: generatedSections,
      metadata: {
        articleCount: articles.length,
        sourceCount: new Set(articles.map(a => a.source)).size,
        dateRange: {
          start: articles.length > 0
            ? new Date(Math.min(...articles.map(a => a.publishedAt.getTime()))).toISOString()
            : new Date().toISOString(),
          end: articles.length > 0
            ? new Date(Math.max(...articles.map(a => a.publishedAt.getTime()))).toISOString()
            : new Date().toISOString(),
        },
        generationTimeMs: Date.now() - startTime,
      },
    };

    logger.info('Report generated', {
      reportId: report.id,
      templateId,
      sections: generatedSections.length,
      durationMs: report.metadata.generationTimeMs,
    });

    return report;
  }

  /**
   * Generate individual section
   */
  private async generateSection(
    section: ReportSection,
    articles: Array<{
      id: number;
      title: string;
      content: string;
      url: string;
      source: string;
      publishedAt: Date;
      topics?: string[];
      sentiment?: { score: number; label: string };
    }>
  ): Promise<GeneratedSection> {
    // Filter articles based on section config
    let filtered = articles;

    if (section.config.topics?.length) {
      filtered = filtered.filter(a =>
        a.topics?.some(t => section.config.topics!.includes(t))
      );
    }

    if (section.config.sourceIds?.length) {
      // Would filter by source IDs
    }

    if (section.config.sentiment && section.config.sentiment !== 'all') {
      filtered = filtered.filter(a =>
        a.sentiment?.label === section.config.sentiment
      );
    }

    if (section.config.dateRange) {
      const start = section.config.dateRange.start.getTime();
      const end = section.config.dateRange.end.getTime();
      filtered = filtered.filter(a =>
        a.publishedAt.getTime() >= start && a.publishedAt.getTime() <= end
      );
    }

    if (section.config.maxItems) {
      filtered = filtered.slice(0, section.config.maxItems);
    }

    // Generate based on section type
    switch (section.type) {
      case 'summary':
        return this.generateSummarySection(section, filtered);

      case 'headlines':
        return this.generateHeadlinesSection(section, filtered);

      case 'deep_dive':
        return this.generateDeepDiveSection(section, filtered);

      case 'trends':
        return this.generateTrendsSection(section, filtered);

      case 'sentiment':
        return this.generateSentimentSection(section, filtered);

      case 'entities':
        return this.generateEntitiesSection(section, filtered);

      case 'statistics':
        return this.generateStatisticsSection(section, filtered);

      case 'custom':
        return {
          id: section.id,
          type: section.type,
          title: section.title,
          content: section.config.customHtml || section.config.customMarkdown || '',
        };

      default:
        return {
          id: section.id,
          type: section.type,
          title: section.title,
          content: '',
        };
    }
  }

  /**
   * Generate summary section using AI
   */
  private async generateSummarySection(
    section: ReportSection,
    articles: Array<{ title: string; content: string }>
  ): Promise<GeneratedSection> {
    const model = section.config.aiModel === 'quality'
      ? 'gemini-2.0-flash'
      : 'gemini-2.0-flash';

    const articleSummaries = articles
      .slice(0, 20)
      .map(a => `- ${a.title}: ${a.content.slice(0, 200)}...`)
      .join('\n');

    const prompt = section.config.customPrompt || `
Write an executive summary of today's key news developments.
Be concise, analytical, and highlight the most significant events.
Maximum ${section.config.maxTokens || 500} words.

Articles:
${articleSummaries}
`;

    try {
      const { text } = await generateText({
        model: google(model),
        prompt,
      });

      return {
        id: section.id,
        type: section.type,
        title: section.title,
        content: text,
      };
    } catch (error) {
      logger.error('Failed to generate summary', { error: String(error) });
      return {
        id: section.id,
        type: section.type,
        title: section.title,
        content: 'Summary generation failed.',
      };
    }
  }

  /**
   * Generate headlines section
   */
  private generateHeadlinesSection(
    section: ReportSection,
    articles: Array<{ title: string; url: string; source: string; publishedAt: Date }>
  ): GeneratedSection {
    const headlines = articles.map(a => ({
      title: a.title,
      url: a.url,
      source: section.config.showSources ? a.source : undefined,
      date: section.config.showDates ? a.publishedAt.toISOString() : undefined,
    }));

    return {
      id: section.id,
      type: section.type,
      title: section.title,
      content: headlines.map(h =>
        `- [${h.title}](${h.url})${h.source ? ` - ${h.source}` : ''}${h.date ? ` (${new Date(h.date).toLocaleDateString()})` : ''}`
      ).join('\n'),
      data: headlines,
    };
  }

  /**
   * Generate deep dive section
   */
  private async generateDeepDiveSection(
    section: ReportSection,
    articles: Array<{ title: string; content: string; source: string }>
  ): Promise<GeneratedSection> {
    if (articles.length === 0) {
      return {
        id: section.id,
        type: section.type,
        title: section.title,
        content: 'No articles available for deep dive.',
      };
    }

    const article = articles[0];

    try {
      const { text } = await generateText({
        model: google('gemini-2.0-flash'),
        prompt: `
Provide an in-depth analysis of this news story:

Title: ${article.title}
Source: ${article.source}

Content:
${article.content.slice(0, 5000)}

Include:
1. Background context
2. Key implications
3. What to watch for
`,
      });

      return {
        id: section.id,
        type: section.type,
        title: section.title,
        content: text,
        data: { articleTitle: article.title },
      };
    } catch (error) {
      return {
        id: section.id,
        type: section.type,
        title: section.title,
        content: article.content.slice(0, 1000),
      };
    }
  }

  /**
   * Generate trends section
   */
  private generateTrendsSection(
    section: ReportSection,
    articles: Array<{ topics?: string[] }>
  ): GeneratedSection {
    // Count topic occurrences
    const topicCounts: Record<string, number> = {};
    for (const article of articles) {
      for (const topic of article.topics || []) {
        topicCounts[topic] = (topicCounts[topic] || 0) + 1;
      }
    }

    const trends = Object.entries(topicCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, section.config.maxItems || 10)
      .map(([topic, count]) => ({ topic, count }));

    return {
      id: section.id,
      type: section.type,
      title: section.title,
      content: trends.map(t => `- **${t.topic}**: ${t.count} articles`).join('\n'),
      data: trends,
    };
  }

  /**
   * Generate sentiment section
   */
  private generateSentimentSection(
    section: ReportSection,
    articles: Array<{ sentiment?: { score: number; label: string } }>
  ): GeneratedSection {
    const sentiments = articles.filter(a => a.sentiment);

    const avgScore = sentiments.length > 0
      ? sentiments.reduce((sum, a) => sum + (a.sentiment?.score || 0), 0) / sentiments.length
      : 0;

    const distribution: Record<string, number> = {};
    for (const article of sentiments) {
      const label = article.sentiment?.label || 'neutral';
      distribution[label] = (distribution[label] || 0) + 1;
    }

    return {
      id: section.id,
      type: section.type,
      title: section.title,
      content: `
**Average Sentiment Score**: ${avgScore.toFixed(2)}

**Distribution**:
${Object.entries(distribution).map(([label, count]) => `- ${label}: ${count} (${Math.round(count / sentiments.length * 100)}%)`).join('\n')}
`,
      data: { avgScore, distribution },
    };
  }

  /**
   * Generate entities section
   */
  private generateEntitiesSection(
    section: ReportSection,
    articles: Array<{ title: string }>
  ): GeneratedSection {
    // Simple entity extraction from titles
    // In production, would use NER from article analysis
    return {
      id: section.id,
      type: section.type,
      title: section.title,
      content: 'Entity analysis pending.',
    };
  }

  /**
   * Generate statistics section
   */
  private generateStatisticsSection(
    section: ReportSection,
    articles: Array<{ source: string; publishedAt: Date }>
  ): GeneratedSection {
    const stats = {
      totalArticles: articles.length,
      uniqueSources: new Set(articles.map(a => a.source)).size,
      dateRange: articles.length > 0
        ? `${new Date(Math.min(...articles.map(a => a.publishedAt.getTime()))).toLocaleDateString()} - ${new Date(Math.max(...articles.map(a => a.publishedAt.getTime()))).toLocaleDateString()}`
        : 'N/A',
    };

    return {
      id: section.id,
      type: section.type,
      title: section.title,
      content: `
- **Total Articles**: ${stats.totalArticles}
- **Sources**: ${stats.uniqueSources}
- **Date Range**: ${stats.dateRange}
`,
      data: stats,
    };
  }

  /**
   * Render report to HTML
   */
  renderToHtml(report: GeneratedReport, template: ReportTemplate): string {
    const styling = template.styling;

    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>${report.title}</title>
  <style>
    body {
      font-family: ${styling.fontFamily};
      max-width: 800px;
      margin: 0 auto;
      padding: 40px;
      color: ${styling.theme === 'dark' ? '#fff' : '#1a1a1a'};
      background: ${styling.theme === 'dark' ? '#1a1a1a' : '#fff'};
    }
    h1, h2 { color: ${styling.primaryColor}; }
    a { color: ${styling.primaryColor}; }
    .section { margin-bottom: 40px; }
    .meta { color: #666; font-size: 14px; }
    ${styling.customCss || ''}
  </style>
</head>
<body>
  ${styling.headerHtml || ''}
  ${styling.logoUrl ? `<img src="${styling.logoUrl}" alt="Logo" style="max-height: 50px;">` : ''}
  <h1>${report.title}</h1>
  <p class="meta">Generated: ${report.generatedAt.toLocaleString()}</p>
  ${report.sections.map(s => `
    <div class="section">
      <h2>${s.title}</h2>
      <div>${this.markdownToHtml(s.content)}</div>
    </div>
  `).join('')}
  ${styling.footerHtml || ''}
</body>
</html>
`;
  }

  /**
   * Simple markdown to HTML converter
   */
  private markdownToHtml(markdown: string): string {
    return markdown
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>')
      .replace(/^- (.*$)/gm, '<li>$1</li>')
      .replace(/(<li>.*<\/li>\n?)+/g, '<ul>$&</ul>')
      .replace(/\n\n/g, '</p><p>')
      .replace(/^/g, '<p>')
      .replace(/$/g, '</p>');
  }
}

/**
 * Create report builder instance
 */
export function createReportBuilder(kv?: KVNamespace): ReportBuilder {
  return new ReportBuilder(kv);
}
