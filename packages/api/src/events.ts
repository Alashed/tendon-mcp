import { EventEmitter } from 'events';

// In-process event bus.
// Emit task:changed whenever a task is mutated (create / update / archive).
// MCP sessions subscribe and push notifications/resources/updated to Claude via SSE.
export const appEvents = new EventEmitter();

export function emitTaskChanged(workspace_id: string): void {
  appEvents.emit('task:changed', workspace_id);
}
