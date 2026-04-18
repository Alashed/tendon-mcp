import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { query } from '../../shared/db/pool.js';
import { authenticate } from '../middleware/auth.js';

const OnboardingEventSchema = z.object({
  event_name: z.string().min(1).max(80),
  properties: z.record(z.string(), z.unknown()).optional(),
});

export async function eventRoutes(app: FastifyInstance): Promise<void> {
  app.post('/events/onboarding', { preHandler: authenticate }, async (request, reply) => {
    const body = OnboardingEventSchema.parse(request.body);

    await query(
      `INSERT INTO onboarding_events (user_id, event_name, properties)
       VALUES ($1, $2, $3::jsonb)`,
      [request.user.sub, body.event_name, JSON.stringify(body.properties ?? {})],
    );

    return reply.status(201).send({ data: { ok: true } });
  });
}
