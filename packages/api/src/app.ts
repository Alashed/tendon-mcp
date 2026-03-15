import Fastify, { type FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import formbody from '@fastify/formbody';
import helmet from '@fastify/helmet';
import jwt from '@fastify/jwt';
import rateLimit from '@fastify/rate-limit';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import { config } from './config/index.js';
import { registerRoutes } from './http/routes/index.js';
import { initContainer } from './di/container.js';
import { AppError } from './shared/errors/AppError.js';

export async function buildApp(): Promise<FastifyInstance> {
  const app = Fastify({
    logger: config.isDev
      ? { level: 'info', transport: { target: 'pino-pretty', options: { colorize: true, translateTime: 'HH:MM:ss', ignore: 'pid,hostname' } } }
      : { level: 'warn' },
  });

  await app.register(helmet, { contentSecurityPolicy: false });
  await app.register(cors, {
    origin: config.isDev ? true : config.cors.allowedOrigins,
    credentials: true,
  });
  await app.register(jwt, { secret: config.jwt.secret });
  await app.register(rateLimit, {
    max: 200,
    timeWindow: '1 minute',
    // Behind nginx all requests share the same IP — key by token instead
    keyGenerator: (request: import('fastify').FastifyRequest) => {
      const auth = request.headers['authorization'];
      if (auth?.startsWith('Bearer ')) return auth.slice(7, 48); // first 41 chars of token
      return request.ip;
    },
    skipOnError: true,
    // SSE connections must not be rate-limited (long-lived GET /mcp)
    skip: (request: import('fastify').FastifyRequest) => request.method === 'GET' && request.url.startsWith('/mcp'),
    errorResponseBuilder: () => ({ error: 'Too many requests — slow down', retryAfter: 60 }),
  } as Parameters<typeof rateLimit>[1]);
  await app.register(formbody);
  await app.register(swagger, {
    openapi: {
      info: { title: 'Alashed Tracker API', version: '1.0.0' },
      components: {
        securitySchemes: { Bearer: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' } },
      },
    },
  });
  await app.register(swaggerUi, { routePrefix: '/docs' });

  initContainer();
  await registerRoutes(app);

  app.setErrorHandler((error: Error & { statusCode?: number; errors?: unknown[] }, request, reply) => {
    if (error instanceof AppError) {
      return reply.status(error.statusCode).send({ error: error.message, code: error.code });
    }
    if (error.name === 'ZodError') {
      return reply.status(400).send({ error: 'Validation failed', details: error.errors });
    }
    request.log.error(error);
    return reply.status(error.statusCode ?? 500).send({ error: config.isDev ? error.message : 'Internal Server Error' });
  });

  return app;
}
