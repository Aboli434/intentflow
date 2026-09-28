import Fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import cookie from '@fastify/cookie';
import websocket from '@fastify/websocket';
import multipart from '@fastify/multipart';
import { env } from './config/env.js';
import { checkDatabaseConnection } from './config/database.js';
import { authRoutes } from './modules/auth/auth.routes.js';
import { usersRoutes } from './modules/users/users.routes.js';
import { organizationRoutes } from './modules/organizations/organizations.routes.js';
import { invitationRoutes } from './modules/invitations/invitations.routes.js';
import { projectRoutes } from './modules/projects/projects.routes.js';
import { conversationRoutes } from './modules/conversations/conversations.routes.js';
import { attachmentRoutes } from './modules/attachments/attachments.routes.js';
import { intentRoutes } from './modules/intents/intents.routes.js';
import { workRoutes } from './modules/work/work.routes.js';
import { notificationRoutes } from './modules/notifications/notifications.routes.js';
import { deliverableRoutes } from './modules/deliverables/deliverables.routes.js';
import { milestoneRoutes } from './modules/milestones/milestones.routes.js';
import { projectClosureRoutes } from './modules/project-closure/project-closure.routes.js';
import { projectMemberRoutes } from './modules/project-members/project-members.routes.js';

export function buildApp() {
  const app = Fastify({
    logger: env.NODE_ENV === 'test' ? false : true,
  });

  // Security & Media Plugins
  app.register(websocket);
  app.register(multipart, { limits: { fileSize: 25 * 1024 * 1024 } }); // 25MB max
  app.register(helmet, { contentSecurityPolicy: false });
  app.register(cors, {
    origin: env.CORS_ORIGIN === '*' ? true : env.CORS_ORIGIN,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  });
  app.register(cookie, {
    secret: process.env.JWT_SECRET || 'intentflow_cookie_secret_key_2026',
  });

  // Centralized Error Handler with Production Diagnostics Masking
  app.setErrorHandler((error: Error & { statusCode?: number; code?: string }, _request, reply) => {
    app.log.error(error);
    const statusCode = error.statusCode || 500;

    // Mask sensitive SQL errors or internal stack traces in production mode
    let message = error.message || 'An unexpected error occurred';
    let code = error.code || 'INTERNAL_SERVER_ERROR';

    if (env.NODE_ENV === 'production' && statusCode === 500) {
      message = 'An internal server error occurred while processing your request.';
      code = 'INTERNAL_SERVER_ERROR';
    }

    reply.status(statusCode).send({
      success: false,
      error: {
        code,
        message,
      },
    });
  });

  // Centralized 404 Not Found Handler
  app.setNotFoundHandler((request, reply) => {
    reply.status(404).send({
      success: false,
      error: {
        code: 'NOT_FOUND',
        message: `Route ${request.method}:${request.url} not found`,
      },
    });
  });

  // Root Endpoint
  app.get('/', async () => {
    return {
      message: 'IntentFlow API Production Platform',
      version: '1.0.0',
      phase: 'Phase 18 — Production Deployment & Launch Readiness',
      docs: '/health',
    };
  });

  // Health Check Endpoint (Liveness Check)
  app.get('/health', async (_request, reply) => {
    return reply.status(200).send({
      status: 'ok',
      service: 'intentflow-api',
      timestamp: new Date().toISOString(),
    });
  });

  // Readiness Check Endpoint (Dependency Verification)
  app.get('/ready', async (_request, reply) => {
    const dbStatus = await checkDatabaseConnection();
    const isReady = dbStatus.connected;

    if (!isReady) {
      return reply.status(503).send({
        ready: false,
        service: 'intentflow-api',
        database: 'disconnected',
        timestamp: new Date().toISOString(),
      });
    }

    return reply.status(200).send({
      ready: true,
      service: 'intentflow-api',
      database: 'connected',
      storage: env.STORAGE_PROVIDER,
      email: env.EMAIL_PROVIDER,
      sms: env.SMS_PROVIDER,
      timestamp: new Date().toISOString(),
    });
  });

  // Register API Domain Modules
  app.register(authRoutes, { prefix: '/api/auth' });
  app.register(usersRoutes, { prefix: '/api/users' });
  app.register(organizationRoutes, { prefix: '/api/organizations' });
  app.register(invitationRoutes, { prefix: '/api' });
  app.register(projectRoutes, { prefix: '/api/projects' });
  app.register(projectMemberRoutes, { prefix: '/api/projects' });
  app.register(conversationRoutes, { prefix: '/api' });
  app.register(attachmentRoutes, { prefix: '/api/attachments' });
  app.register(intentRoutes, { prefix: '/api' });
  app.register(workRoutes, { prefix: '/api' });
  app.register(notificationRoutes, { prefix: '/api' });
  app.register(deliverableRoutes, { prefix: '/api' });
  app.register(milestoneRoutes, { prefix: '/api' });
  app.register(projectClosureRoutes, { prefix: '/api' });

  return app;
}
