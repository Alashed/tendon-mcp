import type { FastifyRequest, FastifyReply } from 'fastify';
import { UnauthorizedError } from '../../shared/errors/AppError.js';

declare module '@fastify/jwt' {
  interface FastifyJWT {
    payload: { sub: string; email: string };
    user: { sub: string; email: string };
  }
}

export async function authenticate(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  try {
    await request.jwtVerify();
  } catch {
    const err = new UnauthorizedError();
    reply.status(err.statusCode).send({ error: err.message });
  }
}
