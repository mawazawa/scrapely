/**
 * OpenAPI specification for Meridian API
 * Provides API documentation with Swagger UI
 */

import { z } from 'zod';

/**
 * OpenAPI 3.1 specification
 */
export const openApiSpec = {
  openapi: '3.1.0',
  info: {
    title: 'Meridian Intelligence API',
    version: '1.0.0',
    description: `
Meridian is an AI-powered news intelligence briefing system. This API provides access to:
- Articles scraped from 800+ news sources
- AI-analyzed and categorized content
- Intelligence briefs and reports
- Real-time processing status

## Authentication
Most endpoints require authentication via API key:
\`\`\`
Authorization: Bearer YOUR_API_KEY
\`\`\`

## Rate Limits
- Free tier: 20 requests/minute, 1000/day
- Pro tier: 60 requests/minute, 10000/day
- Enterprise: Custom limits
    `,
    contact: {
      name: 'Meridian Support',
      email: 'support@news.iliane.xyz',
      url: 'https://news.iliane.xyz',
    },
    license: {
      name: 'MIT',
      url: 'https://opensource.org/licenses/MIT',
    },
  },
  servers: [
    {
      url: 'https://meridian-production.alceos.workers.dev',
      description: 'Production server',
    },
    {
      url: 'http://localhost:8787',
      description: 'Development server',
    },
  ],
  tags: [
    { name: 'Events', description: 'Article events and processing' },
    { name: 'Reports', description: 'Intelligence briefs and reports' },
    { name: 'Sources', description: 'News source management' },
    { name: 'Search', description: 'Search functionality' },
    { name: 'Health', description: 'System health and status' },
  ],
  paths: {
    '/ping': {
      get: {
        tags: ['Health'],
        summary: 'Health check',
        description: 'Simple health check endpoint',
        responses: {
          200: {
            description: 'Service is healthy',
            content: {
              'text/plain': {
                schema: { type: 'string', example: 'pong' },
              },
            },
          },
        },
      },
    },
    '/events': {
      get: {
        tags: ['Events'],
        summary: 'Get processed articles',
        description: 'Retrieve articles processed on a specific date',
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: 'date',
            in: 'query',
            required: true,
            description: 'Date in YYYY-MM-DD format',
            schema: { type: 'string', format: 'date', example: '2025-12-27' },
          },
        ],
        responses: {
          200: {
            description: 'List of processed articles',
            content: {
              'application/json': {
                schema: {
                  type: 'array',
                  items: { $ref: '#/components/schemas/Article' },
                },
              },
            },
          },
          401: { $ref: '#/components/responses/Unauthorized' },
          429: { $ref: '#/components/responses/RateLimited' },
        },
      },
    },
    '/reports': {
      get: {
        tags: ['Reports'],
        summary: 'List reports',
        description: 'Get a list of published intelligence briefs',
        parameters: [
          {
            name: 'limit',
            in: 'query',
            description: 'Maximum number of reports to return',
            schema: { type: 'integer', default: 10, maximum: 100 },
          },
          {
            name: 'offset',
            in: 'query',
            description: 'Number of reports to skip',
            schema: { type: 'integer', default: 0 },
          },
        ],
        responses: {
          200: {
            description: 'List of reports',
            content: {
              'application/json': {
                schema: {
                  type: 'array',
                  items: { $ref: '#/components/schemas/ReportSummary' },
                },
              },
            },
          },
        },
      },
    },
    '/reports/{slug}': {
      get: {
        tags: ['Reports'],
        summary: 'Get report by slug',
        description: 'Retrieve a specific intelligence brief',
        parameters: [
          {
            name: 'slug',
            in: 'path',
            required: true,
            description: 'Report slug',
            schema: { type: 'string' },
          },
        ],
        responses: {
          200: {
            description: 'Report details',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Report' },
              },
            },
          },
          404: { $ref: '#/components/responses/NotFound' },
        },
      },
    },
    '/sources': {
      get: {
        tags: ['Sources'],
        summary: 'List sources',
        description: 'Get all configured news sources',
        security: [{ bearerAuth: [] }],
        responses: {
          200: {
            description: 'List of sources',
            content: {
              'application/json': {
                schema: {
                  type: 'array',
                  items: { $ref: '#/components/schemas/Source' },
                },
              },
            },
          },
          401: { $ref: '#/components/responses/Unauthorized' },
        },
      },
      post: {
        tags: ['Sources'],
        summary: 'Create source',
        description: 'Add a new news source',
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/CreateSource' },
            },
          },
        },
        responses: {
          201: {
            description: 'Source created',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Source' },
              },
            },
          },
          400: { $ref: '#/components/responses/BadRequest' },
          401: { $ref: '#/components/responses/Unauthorized' },
        },
      },
    },
    '/search': {
      get: {
        tags: ['Search'],
        summary: 'Search articles',
        description: 'Search articles using keywords or semantic search',
        parameters: [
          {
            name: 'q',
            in: 'query',
            required: true,
            description: 'Search query',
            schema: { type: 'string', minLength: 2 },
          },
          {
            name: 'limit',
            in: 'query',
            description: 'Maximum results',
            schema: { type: 'integer', default: 10, maximum: 50 },
          },
          {
            name: 'mode',
            in: 'query',
            description: 'Search mode',
            schema: { type: 'string', enum: ['keyword', 'semantic', 'hybrid'], default: 'hybrid' },
          },
        ],
        responses: {
          200: {
            description: 'Search results',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/SearchResults' },
              },
            },
          },
        },
      },
    },
  },
  components: {
    securitySchemes: {
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        description: 'API key authentication',
      },
    },
    schemas: {
      Article: {
        type: 'object',
        properties: {
          id: { type: 'integer' },
          title: { type: 'string' },
          url: { type: 'string', format: 'uri' },
          summary: { type: 'string' },
          relevance: { type: 'string', enum: ['RELEVANT', 'IRRELEVANT', 'SOMEWHAT_RELEVANT'] },
          category: { type: 'string' },
          region: { type: 'string' },
          publishDate: { type: 'string', format: 'date-time' },
          sourceId: { type: 'integer' },
          processedAt: { type: 'string', format: 'date-time' },
        },
      },
      ReportSummary: {
        type: 'object',
        properties: {
          id: { type: 'integer' },
          slug: { type: 'string' },
          title: { type: 'string' },
          tldr: { type: 'string' },
          totalArticles: { type: 'integer' },
          createdAt: { type: 'string', format: 'date-time' },
        },
      },
      Report: {
        type: 'object',
        properties: {
          id: { type: 'integer' },
          slug: { type: 'string' },
          title: { type: 'string' },
          content: { type: 'string' },
          tldr: { type: 'string' },
          totalArticles: { type: 'integer' },
          usedArticles: { type: 'integer' },
          modelAuthor: { type: 'string' },
          createdAt: { type: 'string', format: 'date-time' },
        },
      },
      Source: {
        type: 'object',
        properties: {
          id: { type: 'integer' },
          url: { type: 'string', format: 'uri' },
          name: { type: 'string' },
          category: { type: 'string' },
          scrapeFrequency: { type: 'integer', minimum: 1, maximum: 4 },
          successRate: { type: 'number' },
          disabled: { type: 'boolean' },
        },
      },
      CreateSource: {
        type: 'object',
        required: ['url', 'name', 'category'],
        properties: {
          url: { type: 'string', format: 'uri' },
          name: { type: 'string' },
          category: { type: 'string' },
          scrapeFrequency: { type: 'integer', minimum: 1, maximum: 4, default: 2 },
        },
      },
      SearchResults: {
        type: 'object',
        properties: {
          query: { type: 'string' },
          total: { type: 'integer' },
          results: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                id: { type: 'integer' },
                title: { type: 'string' },
                snippet: { type: 'string' },
                score: { type: 'number' },
                url: { type: 'string', format: 'uri' },
              },
            },
          },
        },
      },
      Error: {
        type: 'object',
        properties: {
          error: { type: 'string' },
          message: { type: 'string' },
          code: { type: 'string' },
        },
      },
    },
    responses: {
      Unauthorized: {
        description: 'Authentication required',
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/Error' },
            example: { error: 'Unauthorized', message: 'Valid API key required' },
          },
        },
      },
      NotFound: {
        description: 'Resource not found',
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/Error' },
            example: { error: 'Not Found', message: 'Resource does not exist' },
          },
        },
      },
      BadRequest: {
        description: 'Invalid request',
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/Error' },
            example: { error: 'Bad Request', message: 'Invalid input' },
          },
        },
      },
      RateLimited: {
        description: 'Rate limit exceeded',
        headers: {
          'Retry-After': {
            description: 'Seconds to wait before retrying',
            schema: { type: 'integer' },
          },
        },
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/Error' },
            example: { error: 'Rate limit exceeded', retryAfter: 60 },
          },
        },
      },
    },
  },
};

/**
 * Generate Swagger UI HTML
 */
export function generateSwaggerHtml(): string {
  return `<!DOCTYPE html>
<html>
<head>
  <title>Meridian API Documentation</title>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <link rel="stylesheet" type="text/css" href="https://unpkg.com/swagger-ui-dist@5/swagger-ui.css">
</head>
<body>
  <div id="swagger-ui"></div>
  <script src="https://unpkg.com/swagger-ui-dist@5/swagger-ui-bundle.js"></script>
  <script>
    window.onload = function() {
      SwaggerUIBundle({
        url: '/openapi.json',
        dom_id: '#swagger-ui',
        deepLinking: true,
        presets: [
          SwaggerUIBundle.presets.apis,
          SwaggerUIBundle.SwaggerUIStandalonePreset
        ],
        layout: "BaseLayout",
        defaultModelsExpandDepth: 1,
        defaultModelExpandDepth: 1,
      });
    };
  </script>
</body>
</html>`;
}
