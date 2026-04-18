import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { query } from '../../shared/db/pool.js';
import { authenticate } from '../middleware/auth.js';

const AllowedEventNames = [
  'signup_completed',
  'onboarding_opened',
  'command_copied',
  'mcp_connected',
  'oauth_completed',
  'first_prompt_shown',
  'first_prompt_sent',
  'first_task_created',
  'first_focus_started',
  'first_value_achieved',
  'returned_day_1',
] as const;

const OnboardingEventSchema = z.object({
  event_name: z.enum(AllowedEventNames),
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

  app.get('/events/onboarding/status', { preHandler: authenticate }, async (request) => {
    const qs = request.query as { workspace_id?: string };

    let workspaceId = qs.workspace_id ?? null;
    if (!workspaceId) {
      const tokenResult = await query<{ workspace_id: string }>(
        `SELECT workspace_id
         FROM oauth_access_tokens
         WHERE user_id = $1
           AND revoked = FALSE
           AND expires_at > NOW()
         ORDER BY created_at DESC
         LIMIT 1`,
        [request.user.sub],
      );
      workspaceId = tokenResult.rows[0]?.workspace_id ?? null;
    }

    if (!workspaceId) {
      return {
        data: {
          connected: false,
          workspace_id: null,
          first_value_achieved: false,
          first_value_source: null,
        },
      };
    }

    const [eventResult, taskResult, activityResult] = await Promise.all([
      query<{ seen: boolean }>(
        `SELECT EXISTS (
           SELECT 1
           FROM onboarding_events
           WHERE user_id = $1
             AND event_name = 'first_value_achieved'
             AND (
               (properties ? 'workspace_id' AND properties->>'workspace_id' = $2)
               OR NOT (properties ? 'workspace_id')
             )
         ) AS seen`,
        [request.user.sub, workspaceId],
      ),
      query<{ count: string }>(
        `SELECT COUNT(*)::text AS count
         FROM tasks
         WHERE workspace_id = $1
           AND status != 'archived'`,
        [workspaceId],
      ),
      query<{ count: string }>(
        `SELECT COUNT(*)::text AS count
         FROM activities
         WHERE workspace_id = $1
           AND user_id = $2`,
        [workspaceId, request.user.sub],
      ),
    ]);

    const fromEvent = eventResult.rows[0]?.seen ?? false;
    const taskCount = parseInt(taskResult.rows[0]?.count ?? '0', 10);
    const activityCount = parseInt(activityResult.rows[0]?.count ?? '0', 10);
    const fromData = taskCount > 0 || activityCount > 0;

    return {
      data: {
        connected: true,
        workspace_id: workspaceId,
        first_value_achieved: fromEvent || fromData,
        first_value_source: fromEvent ? 'event' : fromData ? 'workspace_data' : null,
      },
    };
  });
}
