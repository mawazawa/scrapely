/**
 * GraphQL Server Configuration
 * Uses GraphQL Yoga for Cloudflare Workers compatibility
 */

import { createSchema, createYoga } from 'graphql-yoga';
import { typeDefs } from './schema';
import { resolvers, type GraphQLContext } from './resolvers';
import { logger } from '../lib/logger';
import type { Env } from '../types';

/**
 * Create GraphQL schema
 */
const schema = createSchema({
  typeDefs,
  resolvers,
});

/**
 * Create GraphQL Yoga server instance
 */
export function createGraphQLServer(env: Env) {
  return createYoga<Env, GraphQLContext>({
    schema,
    graphqlEndpoint: '/graphql',
    landingPage: false,
    graphiql: {
      title: 'Meridian GraphQL API',
      defaultQuery: `# Welcome to the Meridian GraphQL API
#
# Try some example queries:

query GetStats {
  stats {
    sources {
      total
      enabled
      healthy
      failing
    }
    articles {
      today
      thisWeek
      total
    }
    reports {
      published
      scheduled
    }
  }
}

query SearchArticles {
  search(query: "technology", options: { limit: 10 }) {
    articles {
      id
      title
      url
      publishedAt
      topics
      sentiment {
        label
        score
      }
    }
    totalCount
    took
  }
}

query GetSources {
  sources(pagination: { limit: 10 }) {
    edges {
      node {
        id
        name
        url
        category
        enabled
        health {
          status
          successRate
        }
      }
    }
    pageInfo {
      hasNextPage
      totalCount
    }
  }
}
`,
    },

    // Context setup
    context: async ({ request }) => {
      // Extract auth from headers
      const authHeader = request.headers.get('Authorization');
      let userId: string | undefined;
      let userTier: string | undefined;

      if (authHeader?.startsWith('Bearer ')) {
        const token = authHeader.replace('Bearer ', '');
        // In production, validate JWT and extract user info
        if (token === env.MERIDIAN_SECRET_KEY) {
          userId = 'admin';
          userTier = 'ADMIN';
        }
      }

      return {
        env,
        userId,
        userTier,
      };
    },

    // Logging
    logging: {
      debug: (...args) => logger.debug('GraphQL', { args }),
      info: (...args) => logger.info('GraphQL', { args }),
      warn: (...args) => logger.warn('GraphQL', { args }),
      error: (...args) => logger.error('GraphQL', { args }),
    },

    // CORS
    cors: {
      origin: ['https://news.iliane.xyz', 'http://localhost:3000'],
      credentials: true,
      methods: ['GET', 'POST', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization'],
    },

    // Plugins
    plugins: [
      // Request logging
      {
        onRequest({ request }) {
          logger.debug('GraphQL request', {
            method: request.method,
            url: request.url,
          });
        },
        onResponse({ response }) {
          logger.debug('GraphQL response', {
            status: response.status,
          });
        },
      },
      // Error handling
      {
        onExecute() {
          return {
            onExecuteDone({ result }) {
              if ('errors' in result && result.errors) {
                for (const error of result.errors) {
                  logger.error('GraphQL execution error', {
                    message: error.message,
                    path: error.path,
                    locations: error.locations,
                  });
                }
              }
            },
          };
        },
      },
    ],

    // Batching support
    batching: true,

    // Masking errors in production
    maskedErrors: {
      isDev: false,
    },
  });
}

/**
 * Handle GraphQL requests
 */
export async function handleGraphQL(request: Request, env: Env): Promise<Response> {
  const yoga = createGraphQLServer(env);
  return yoga.fetch(request, env);
}

/**
 * Export types for client-side codegen
 */
export type { GraphQLContext };
