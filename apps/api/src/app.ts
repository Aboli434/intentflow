import Fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import { env } from './config/env.js';
import { checkDatabaseConnection } from './config/database.js';

export function buildApp() {
  const app = Fastify({
    logger: env.NODE_ENV === 'test' ? false : true,
  });

  // Security Plugins
  app.register(helmet, { contentSecurityPolicy: false });
  app.register(cors, {
    origin: env.CORS_ORIGIN === '*' ? true : env.CORS_ORIGIN,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  });

  // Centralized Error Handler
  app.setErrorHandler((error: Error & { statusCode?: number; code?: string }, _request, reply) => {
    app.log.error(error);
    const statusCode = error.statusCode || 500;
    reply.status(statusCode).send({
      success: false,
      error: {
        code: error.code || 'INTERNAL_SERVER_ERROR',
        message: error.message || 'An unexpected error occurred',
      },
    });
  });

  // Root Endpoint
  app.get('/', async () => {
    return {
      message: 'IntentFlow API Service Foundation',
      version: '0.1.0',
      phase: 'Phase 1 — Engineering Foundation',
      docs: '/health',
    };
  });

  // Health Check Endpoint (Required standard format)
  app.get('/health', async (_request, reply) => {
    const dbStatus = await checkDatabaseConnection();
    return reply.status(200).send({
      status: 'ok',
      service: 'intentflow-api',
      timestamp: new Date().toISOString(),
      database: dbStatus.connected ? 'connected' : 'disconnected',
    });
  });

  return app;
}
