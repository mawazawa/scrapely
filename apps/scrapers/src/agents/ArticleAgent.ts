/**
 * Article Processing Agent
 * Uses Cloudflare Agents SDK for agentic article processing
 *
 * @see https://developers.cloudflare.com/agents/
 */

import { Agent, AgentContext, tool } from 'agents';
import { z } from 'zod';
import { Env } from '../index';

/**
 * Agent state schema
 */
export interface ArticleAgentState {
  articleId: number;
  url: string;
  status: 'pending' | 'scraping' | 'analyzing' | 'completed' | 'failed';
  content?: string;
  analysis?: {
    relevance: 'RELEVANT' | 'IRRELEVANT' | 'SOMEWHAT_RELEVANT';
    summary?: string;
    category?: string;
    entities?: string[];
  };
  error?: string;
  startedAt: number;
  completedAt?: number;
}

/**
 * Scrape tool - fetches article content
 */
const scrapeTool = tool({
  name: 'scrape',
  description: 'Fetch and extract article content from a URL',
  parameters: z.object({
    url: z.string().url().describe('The URL of the article to scrape'),
    useFirecrawl: z.boolean().optional().describe('Use Firecrawl agent for complex sites'),
  }),
  execute: async ({ url, useFirecrawl }, context: AgentContext<Env>) => {
    const { env } = context;

    if (useFirecrawl && env.FIRECRAWL_API_KEY) {
      // Use Firecrawl for complex sites
      const response = await fetch('https://api.firecrawl.dev/v1/scrape', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${env.FIRECRAWL_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ url, formats: ['markdown'] }),
      });

      if (!response.ok) {
        throw new Error(`Firecrawl error: ${response.status}`);
      }

      const data = await response.json() as { data?: { markdown?: string } };
      return { content: data.data?.markdown || '', method: 'firecrawl' };
    }

    // Standard fetch with Readability
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; MeridianBot/1.0)',
      },
    });

    if (!response.ok) {
      throw new Error(`Fetch error: ${response.status}`);
    }

    const html = await response.text();
    // Note: In production, use linkedom + Readability
    return { content: html.slice(0, 50000), method: 'fetch' };
  },
});

/**
 * Analyze tool - analyzes article content with LLM
 */
const analyzeTool = tool({
  name: 'analyze',
  description: 'Analyze article content for relevance and extract key information',
  parameters: z.object({
    content: z.string().describe('The article content to analyze'),
    title: z.string().optional().describe('The article title'),
  }),
  execute: async ({ content, title }, context: AgentContext<Env>) => {
    const { env } = context;

    // Use Gemini for analysis
    const response = await fetch(`${env.GOOGLE_BASE_URL}/v1beta/models/gemini-2.0-flash:generateContent`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': env.GOOGLE_API_KEY,
      },
      body: JSON.stringify({
        contents: [{
          parts: [{
            text: `Analyze this article and determine its relevance for a geopolitical intelligence brief.

Title: ${title || 'Unknown'}
Content: ${content.slice(0, 10000)}

Respond in JSON format:
{
  "relevance": "RELEVANT" | "IRRELEVANT" | "SOMEWHAT_RELEVANT",
  "summary": "2-3 sentence summary",
  "category": "one of: politics, economics, security, technology, environment, social",
  "entities": ["key entities mentioned"],
  "confidence": 0.0-1.0
}`,
          }],
        }],
        generationConfig: {
          responseMimeType: 'application/json',
        },
      }),
    });

    if (!response.ok) {
      throw new Error(`Gemini error: ${response.status}`);
    }

    const data = await response.json() as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
    };
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '{}';

    try {
      return JSON.parse(text);
    } catch {
      return { relevance: 'IRRELEVANT', error: 'Failed to parse response' };
    }
  },
});

/**
 * Summarize tool - generates a summary of the article
 */
const summarizeTool = tool({
  name: 'summarize',
  description: 'Generate a concise summary of the article',
  parameters: z.object({
    content: z.string().describe('The article content to summarize'),
    maxLength: z.number().optional().describe('Maximum summary length in words'),
  }),
  execute: async ({ content, maxLength = 100 }, context: AgentContext<Env>) => {
    const { env } = context;

    const response = await fetch(`${env.GOOGLE_BASE_URL}/v1beta/models/gemini-2.0-flash:generateContent`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': env.GOOGLE_API_KEY,
      },
      body: JSON.stringify({
        contents: [{
          parts: [{
            text: `Summarize this article in ${maxLength} words or less. Focus on key facts and implications.

${content.slice(0, 10000)}`,
          }],
        }],
      }),
    });

    if (!response.ok) {
      throw new Error(`Gemini error: ${response.status}`);
    }

    const data = await response.json() as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
    };
    return { summary: data.candidates?.[0]?.content?.parts?.[0]?.text || '' };
  },
});

/**
 * Extract entities tool - extracts named entities from content
 */
const extractEntitiesTool = tool({
  name: 'extractEntities',
  description: 'Extract named entities (people, organizations, locations) from content',
  parameters: z.object({
    content: z.string().describe('The content to extract entities from'),
  }),
  execute: async ({ content }, context: AgentContext<Env>) => {
    const { env } = context;

    const response = await fetch(`${env.GOOGLE_BASE_URL}/v1beta/models/gemini-2.0-flash:generateContent`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': env.GOOGLE_API_KEY,
      },
      body: JSON.stringify({
        contents: [{
          parts: [{
            text: `Extract named entities from this text. Return JSON:
{
  "people": ["name1", "name2"],
  "organizations": ["org1", "org2"],
  "locations": ["loc1", "loc2"],
  "events": ["event1", "event2"]
}

Text: ${content.slice(0, 5000)}`,
          }],
        }],
        generationConfig: {
          responseMimeType: 'application/json',
        },
      }),
    });

    if (!response.ok) {
      throw new Error(`Gemini error: ${response.status}`);
    }

    const data = await response.json() as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
    };
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '{}';

    try {
      return JSON.parse(text);
    } catch {
      return { people: [], organizations: [], locations: [], events: [] };
    }
  },
});

/**
 * Article Processing Agent
 */
export class ArticleAgent extends Agent<Env, ArticleAgentState> {
  tools = [scrapeTool, analyzeTool, summarizeTool, extractEntitiesTool];

  /**
   * Initial state for the agent
   */
  initialState(): ArticleAgentState {
    return {
      articleId: 0,
      url: '',
      status: 'pending',
      startedAt: Date.now(),
    };
  }

  /**
   * System prompt for the agent
   */
  systemPrompt(): string {
    return `You are an AI article processing agent for Meridian, an intelligence briefing system.

Your job is to:
1. Scrape article content from URLs
2. Analyze articles for relevance to geopolitical intelligence
3. Extract key information and entities
4. Provide structured analysis

Process articles methodically:
- First scrape the content
- Then analyze for relevance
- If relevant, extract entities and summarize
- Report your findings

Be efficient and accurate. Focus on geopolitical, economic, and security topics.`;
  }

  /**
   * Handle incoming messages
   */
  async onMessage(message: string): Promise<string> {
    // Update state to show we're processing
    this.setState({ ...this.state, status: 'scraping' });

    // Let the agent process using tools
    const result = await this.chat(message);

    // Update state based on result
    this.setState({
      ...this.state,
      status: 'completed',
      completedAt: Date.now(),
    });

    return result;
  }

  /**
   * Process an article by URL
   */
  async processArticle(articleId: number, url: string): Promise<ArticleAgentState> {
    this.setState({
      articleId,
      url,
      status: 'scraping',
      startedAt: Date.now(),
    });

    try {
      // Scrape the article
      const scrapeResult = await this.useTool('scrape', { url });
      this.setState({ ...this.state, content: scrapeResult.content });

      // Analyze for relevance
      this.setState({ ...this.state, status: 'analyzing' });
      const analysisResult = await this.useTool('analyze', {
        content: scrapeResult.content,
      });

      // Extract entities if relevant
      let entities: string[] = [];
      if (analysisResult.relevance !== 'IRRELEVANT') {
        const entityResult = await this.useTool('extractEntities', {
          content: scrapeResult.content,
        });
        entities = [
          ...entityResult.people,
          ...entityResult.organizations,
          ...entityResult.locations,
        ];
      }

      const finalState: ArticleAgentState = {
        ...this.state,
        status: 'completed',
        analysis: {
          relevance: analysisResult.relevance,
          summary: analysisResult.summary,
          category: analysisResult.category,
          entities,
        },
        completedAt: Date.now(),
      };

      this.setState(finalState);
      return finalState;
    } catch (error) {
      const errorState: ArticleAgentState = {
        ...this.state,
        status: 'failed',
        error: error instanceof Error ? error.message : 'Unknown error',
        completedAt: Date.now(),
      };
      this.setState(errorState);
      return errorState;
    }
  }
}

export default ArticleAgent;
