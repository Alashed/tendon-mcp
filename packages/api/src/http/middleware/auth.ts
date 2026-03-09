import type { FastifyRequest, FastifyReply } from 'fastify';
import { UnauthorizedError } from '../../shared/errors/AppError.js';


export async function authenticate(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  try {
    await request.jwtVerify();
  } catch {
    const err = new UnauthorizedError();
    reply.status(err.statusCode).send({ error: err.message });
  }
}
