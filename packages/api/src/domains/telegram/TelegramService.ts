import { TelegramRepository } from './TelegramRepository.js';
import { config } from '../../config/index.js';

function fmt(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

export class TelegramService {
  private readonly apiBase: string;

  constructor(private readonly repo: TelegramRepository) {
    this.apiBase = `https://api.telegram.org/bot${config.telegramBotToken}`;
  }

  // ── Telegram Bot API ─────────────────────────────────────────────────────

  async sendMessage(
    chatId: number | bigint,
    text: string,
    threadId?: number | bigint | null,
  ): Promise<void> {
    const body: Record<string, unknown> = {
      chat_id: Number(chatId),
      text,
      parse_mode: 'HTML',
    };
    if (threadId) body['message_thread_id'] = Number(threadId);

    const res = await fetch(`${this.apiBase}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      console.error('[TG] sendMessage failed:', err);
    }
  }

  async setWebhook(webhookUrl: string): Promise<void> {
    if (!config.telegramBotToken) return;
    const res = await fetch(`${this.apiBase}/setWebhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: webhookUrl }),
    });
    const data = await res.json() as { ok: boolean; description?: string };
    if (data.ok) {
      console.log('[TG] Webhook registered:', webhookUrl);
    } else {
      console.error('[TG] Webhook registration failed:', data.description);
    }
  }

  // ── Incoming update handler ──────────────────────────────────────────────

  async handleUpdate(update: TelegramUpdate): Promise<void> {
    const msg = update.message ?? update.channel_post;
    if (!msg?.text) return;

    const chatId = msg.chat.id;
    const threadId = msg.message_thread_id ?? null;
    const text = msg.text.trim();

    if (text.startsWith('/start') || text.startsWith('/connect')) {
      await this.handleConnect(chatId, threadId, msg.chat.title ?? msg.from?.first_name ?? '');
    } else if (text.startsWith('/today')) {
      await this.handleToday(chatId, threadId);
    } else if (text.startsWith('/help')) {
      await this.sendMessage(chatId, this.helpText(), threadId);
    }
  }

  private async handleConnect(chatId: number, threadId: number | null, chatName: string): Promise<void> {
    const code = await this.repo.createLinkCode(chatId, threadId ?? undefined);
    const url = `${config.webBaseUrl}/telegram/link?code=${code}`;
    const text = [
      `<b>Connect this chat to your tendon workspace</b>`,
      '',
      `Open the link below while logged into <b>tendon.alashed.kz</b>:`,
      `<code>${url}</code>`,
      '',
      `The link expires in 15 minutes.`,
    ].join('\n');
    await this.sendMessage(chatId, text, threadId);
  }

  private async handleToday(chatId: number, threadId: number | null): Promise<void> {
    // Find which workspace this chat belongs to
    const chats = await this.repo.findChatsByWorkspace('__lookup__').catch(() => []);
    // We can't easily look up by chat_id here without an extra query - add a helper
    const result = await import('../../shared/db/pool.js').then(({ query }) =>
      query<{ workspace_id: string }>(
        `SELECT workspace_id FROM telegram_chats WHERE chat_id = $1 LIMIT 1`,
        [chatId],
      )
    );
    const workspaceId = result.rows[0]?.workspace_id;
    if (!workspaceId) {
      await this.sendMessage(chatId,
        '⚠️ This chat is not connected to a workspace yet.\nUse /connect to link it.',
        threadId,
      );
      return;
    }

    const today = new Date().toISOString().split('T')[0]!;
    const [stats, tasks] = await Promise.all([
      this.repo.getDailyStats(workspaceId, today),
      this.repo.getTaskSummary(workspaceId),
    ]);

    await this.sendMessage(chatId, this.buildReport(today, stats, tasks), threadId);
  }

  // ── Daily report ─────────────────────────────────────────────────────────

  async sendDailyReports(): Promise<void> {
    if (!config.telegramBotToken) return;
    const hour = new Date().getUTCHours();
    const today = new Date().toISOString().split('T')[0]!;
    const chats = await this.repo.findChatsForReport(hour);

    for (const chat of chats) {
      try {
        const [stats, tasks] = await Promise.all([
          this.repo.getDailyStats(chat.workspace_id, today),
          this.repo.getTaskSummary(chat.workspace_id),
        ]);
        if (stats.length === 0 && tasks.total === 0) continue; // nothing to report

        await this.sendMessage(chat.chat_id, this.buildReport(today, stats, tasks), chat.thread_id);
        await this.repo.markReportSent(chat.chat_id, today);
      } catch (err) {
        console.error('[TG] Failed to send daily report to', chat.chat_id, err);
      }
    }
  }

  // ── Report formatting ─────────────────────────────────────────────────────

  private buildReport(
    date: string,
    stats: Awaited<ReturnType<TelegramRepository['getDailyStats']>>,
    tasks: Awaited<ReturnType<TelegramRepository['getTaskSummary']>>,
  ): string {
    const d = new Date(date + 'T12:00:00Z').toLocaleDateString('en', {
      weekday: 'short', month: 'short', day: 'numeric',
    });

    const lines: string[] = [
      `📊 <b>Daily Summary — ${d}</b>`,
      '',
    ];

    if (stats.length > 0) {
      lines.push(`<b>Focus time:</b>`);
      for (const s of stats) {
        const bar = '█'.repeat(Math.min(Math.floor(s.total_minutes / 30), 8));
        lines.push(
          `  ${s.user_name}: <code>${fmt(s.total_minutes)}</code> ${bar ? `<i>${bar}</i>` : ''}`,
        );
      }
      lines.push('');
    }

    lines.push(`<b>Tasks:</b>`);
    lines.push(`  Total: ${tasks.total}  ·  In progress: ${tasks.in_progress}  ·  Done today: ${tasks.done_today}`);

    if (tasks.done_today > 0) {
      lines.push('');
      lines.push(`✅ ${tasks.done_today} task${tasks.done_today > 1 ? 's' : ''} completed today!`);
    }

    return lines.join('\n');
  }

  private helpText(): string {
    return [
      `<b>tendon tracker bot</b>`,
      '',
      `/connect — link this chat to your workspace`,
      `/today — show today's summary`,
      `/help — show this message`,
    ].join('\n');
  }
}

// ── Telegram update types ────────────────────────────────────────────────────

export interface TelegramUpdate {
  update_id: number;
  message?: TelegramMessage;
  channel_post?: TelegramMessage;
}

export interface TelegramMessage {
  message_id: number;
  from?: { id: number; first_name: string; username?: string };
  chat: { id: number; title?: string; type: string };
  message_thread_id?: number;
  text?: string;
  date: number;
}
