import { EventEmitter } from 'events';

// In-process event bus.
// Emit task:changed whenever a task is mutated (create / update / archive).
// MCP sessions subscribe and push notifications/resources/updated to Claude via SSE.
export const appEvents = new EventEmitter();

// Per-workspace debounce — batch rapid mutations within 100ms into one event.
const debounceTimers = new Map<string, NodeJS.Timeout>();

export function emitTaskChanged(workspace_id: string): void {
  const existing = debounceTimers.get(workspace_id);
  if (existing) clearTimeout(existing);
  debounceTimers.set(
    workspace_id,
    setTimeout(() => {
      debounceTimers.delete(workspace_id);
      appEvents.emit('task:changed', workspace_id);
    }, 100),
  );
}
