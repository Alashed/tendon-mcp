import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

export function registerPrompts(server: McpServer): void {

  // ── /morning — start of day ────────────────────────────────────────────────
  server.prompt(
    'morning',
    'Start your day: show today\'s plan and suggest what to focus on first',
    () => ({
      messages: [
        {
          role: 'user' as const,
          content: {
            type: 'text' as const,
            text: `Good morning! Let's start the day.

Please:
1. Call get_today_plan to show my current tasks and tracked time
2. Based on the plan, suggest what I should focus on first (consider priorities and what's already in progress)
3. If I have in-progress tasks, ask if I want to continue or start something new
4. When I pick a task, start a focus session on it`,
          },
        },
      ],
    }),
  );

  // ── /wrap_up — end of day ──────────────────────────────────────────────────
  server.prompt(
    'wrap_up',
    'End of day: stop tracking, summarize what was done, prep for tomorrow',
    () => ({
      messages: [
        {
          role: 'user' as const,
          content: {
            type: 'text' as const,
            text: `Time to wrap up.

Please:
1. Stop any active focus session
2. Call get_daily_summary to show what I accomplished today
3. List tasks still in_progress — ask if any should be moved back to planned
4. Based on what's left, suggest the top 3 priorities for tomorrow
5. Give a one-line verdict on the day (e.g. "Solid 3h20m, closed 3 tasks, 1 blocker to resolve")`,
          },
        },
      ],
    }),
  );

  // ── /standup — quick team update ──────────────────────────────────────────
  server.prompt(
    'standup',
    'Generate a standup update: yesterday / today / blockers',
    () => ({
      messages: [
        {
          role: 'user' as const,
          content: {
            type: 'text' as const,
            text: `Generate my standup update.

Please:
1. Call get_daily_summary(date="yesterday") to see what I did yesterday
2. Call get_today_plan to see what I'm working on today
3. Format a clean standup message:

   **Yesterday:** [done tasks]
   **Today:** [in-progress + top planned]
   **Blockers:** [any logged blockers, or "None"]

Keep it concise — one line per item.`,
          },
        },
      ],
    }),
  );

  // ── /review — weekly review ────────────────────────────────────────────────
  server.prompt(
    'review',
    'Weekly review: what you shipped, time spent, what to improve',
    () => ({
      messages: [
        {
          role: 'user' as const,
          content: {
            type: 'text' as const,
            text: `Let's do a weekly review.

Please:
1. Call week_summary to get the last 7 days of data
2. Highlight:
   - Total focus time and how it compares across days
   - Number of tasks completed vs created
   - Most productive day
   - Any patterns (e.g. "You tend to do deep work on Tuesdays")
3. Suggest 1-2 things to improve next week based on the data`,
          },
        },
      ],
    }),
  );
}
