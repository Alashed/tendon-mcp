import type { FastifyInstance } from 'fastify';
import { getContainer } from '../../di/container.js';
import { verifyAndUpsertClerkUser } from '../../shared/clerk/clerkAuth.js';

export async function telegramRoutes(app: FastifyInstance): Promise<void> {
  const { userRepository, workspaceRepository } = getContainer();

  // ── POST /telegram/webhook — receive updates from Telegram ──────────────
  app.post('/telegram/webhook', async (request, reply) => {
    const { telegramService } = getContainer();
    // Fire-and-forget; always return 200 to Telegram
    telegramService.handleUpdate(request.body as any).catch((err) =>
      console.error('[TG webhook]', err)
    );
    return reply.status(200).send({ ok: true });
  });

  // ── GET /telegram/link — fetch code metadata (for web confirmation UI) ──
  app.get('/telegram/link', async (request, reply) => {
    const { code } = request.query as { code?: string };
    if (!code) return reply.status(400).send({ error: 'missing code' });
    // Just acknowledge the code exists (web app does the actual display)
    return { ok: true };
  });

  // ── POST /telegram/link/confirm — called by web after Clerk auth ─────────
  // Body: { code: string }
  // Header: Authorization: Bearer <clerk_jwt>
  app.post('/telegram/link/confirm', async (request, reply) => {
    const authHeader = request.headers['authorization'];
    const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
    if (!token) return reply.status(401).send({ error: 'Unauthorized' });

    let workspaceId: string;
    try {
      const { workspaceId: wsId } = await verifyAndUpsertClerkUser(
        token, userRepository, workspaceRepository,
      );
      workspaceId = wsId;
    } catch {
      return reply.status(401).send({ error: 'invalid_token' });
    }

    const { code } = request.body as { code?: string };
    if (!code) return reply.status(400).send({ error: 'missing code' });

    const { telegramService, telegramRepository } = getContainer();

    const linkData = await telegramRepository.consumeLinkCode(code);
    if (!linkData) return reply.status(400).send({ error: 'Invalid or expired code' });

    await telegramRepository.linkChat(linkData.chat_id, linkData.thread_id, workspaceId);

    // Notify the chat
    await telegramService.sendMessage(
      linkData.chat_id,
      `✅ <b>Chat connected to your tendon workspace!</b>\n\nYou'll receive daily summaries here. Use /today anytime for an instant report.`,
      linkData.thread_id,
    );

    return { ok: true };
  });
}
