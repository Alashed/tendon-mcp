import type { FastifyInstance } from 'fastify';
import { createHash } from 'crypto';
import { z } from 'zod';
import { getContainer } from '../../di/container.js';
import { ConflictError, UnauthorizedError } from '../../shared/errors/AppError.js';

function hashPassword(password: string): string {
  return createHash('sha256').update(password).digest('hex');
}

const RegisterSchema = z.object({
  email: z.email(),
  name: z.string().min(1),
  password: z.string().min(8),
});

const LoginSchema = z.object({
  email: z.email(),
  password: z.string().min(1),
});

export async function authRoutes(app: FastifyInstance): Promise<void> {
  const { userRepository, workspaceRepository } = getContainer();

  app.post('/auth/register', async (request, reply) => {
    const body = RegisterSchema.parse(request.body);

    const existing = await userRepository.findByEmail(body.email);
    if (existing) throw new ConflictError('Email already registered');

    const user = await userRepository.create({
      email: body.email,
      name: body.name,
      password_hash: hashPassword(body.password),
    });

    // Auto-create personal workspace
    await workspaceRepository.createPersonal(user.id, `${body.name}'s workspace`);

    const token = app.jwt.sign({ sub: user.id, email: user.email });
    return reply.status(201).send({ data: { user, token } });
  });

  app.post('/auth/login', async (request, reply) => {
    const body = LoginSchema.parse(request.body);

    const user = await userRepository.findByEmail(body.email);
    if (!user || user.password_hash !== hashPassword(body.password)) {
      throw new UnauthorizedError('Invalid credentials');
    }

    const token = app.jwt.sign({ sub: user.id, email: user.email });
    const { password_hash: _, ...safeUser } = user;
    return reply.send({ data: { user: safeUser, token } });
  });
}
