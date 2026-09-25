import Fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import cookie from '@fastify/cookie';
import { env } from './config/env.js';
import { checkDatabaseConnection } from './config/database.js';
import { authRoutes } from './modules/auth/auth.routes.js';
import { usersRoutes } from './modules/users/users.routes.js';
import { organizationRoutes } from './modules/organizations/organizations.routes.js';
import { invitationRoutes } from './modules/invitations/invitations.routes.js';
import { projectRoutes } from './modules/projects/projects.routes.js';

export function buildApp() {
  const app = Fastify({
    logger: env.NODE_ENV === 'test' ? false : true,
  });

  // Security Plugins
  app.register(helmet, { contentSecurityPolicy: false });
  app.register(cors, {
    origin: env.CORS_ORIGIN === '*' ? true : env.CORS_ORIGIN,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  });
  app.register(cookie, {
    secret: process.env.JWT_SECRET || 'intentflow_cookie_secret_key_2026',
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
      version: '0.2.0',
      phase: 'Phase 2 — Authentication, Organizations & Projects',
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

  // Register API Domain Modules
  app.register(authRoutes, { prefix: '/api/auth' });
  app.register(usersRoutes, { prefix: '/api/users' });
  app.register(organizationRoutes, { prefix: '/api/organizations' });
  app.register(invitationRoutes, { prefix: '/api/invitations' });
  app.register(projectRoutes, { prefix: '/api/projects' });

  return app;
}
