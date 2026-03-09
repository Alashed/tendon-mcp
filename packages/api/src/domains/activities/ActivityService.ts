import { ActivityRepository, type StartActivityDTO } from './ActivityRepository.js';
import { TaskRepository } from '../tasks/TaskRepository.js';
import type { Activity, SyncRequest, SyncResponse, SyncActivityItem } from '@alashed/shared';
import { NotFoundError } from '../../shared/errors/AppError.js';

export class ActivityService {
  constructor(
    private readonly activityRepo: ActivityRepository,
    private readonly taskRepo: TaskRepository,
  ) {}

  async startFocus(dto: StartActivityDTO): Promise<Activity> {
    // Business rule: only one active activity per user — stop previous
    await this.activityRepo.stopOngoing(dto.workspace_id, dto.user_id);

    // If task_id provided, set it to in_progress
    if (dto.task_id) {
      const task = await this.taskRepo.findById(dto.task_id);
      if (!task) throw new NotFoundError('Task');
      if (task.status === 'planned') {
        await this.taskRepo.updateStatus(dto.task_id, 'in_progress');
      }
    }

    return this.activityRepo.start(dto);
  }

  async stopFocus(workspace_id: string, user_id: string, activity_id?: string): Promise<Activity | null> {
    if (activity_id) {
      return this.activityRepo.stop(activity_id);
    }
    return this.activityRepo.stopOngoing(workspace_id, user_id);
  }

  async sync(req: SyncRequest): Promise<SyncResponse> {
    const id_map: Record<string, string> = {};
    let task_updates_applied = 0;

    // Stop any ongoing activity before bulk insert
    if (req.new_activities.length > 0) {
      const firstActivity = req.new_activities[0];
      if (firstActivity) {
        await this.activityRepo.stopOngoing(req.workspace_id, firstActivity.user_id);
      }
    }

    for (const a of req.new_activities) {
      // Deduplicate by client_id
      if (a.client_id) {
        const existing = await this.activityRepo.findByClientId(a.client_id);
        if (existing) {
          id_map[a.client_id] = existing.id;
          continue;
        }
      }

      const created = await this.activityRepo.start({
        workspace_id: req.workspace_id,
        user_id: a.user_id,
        task_id: a.task_id,
        source: a.source,
        client_id: a.client_id,
        start_time: a.start_time,
      });

      if (a.end_time) {
        await this.activityRepo.stop(created.id, a.end_time);
      }

      if (a.client_id) {
        id_map[a.client_id] = created.id;
      }
    }

    for (const update of req.local_task_updates) {
      await this.taskRepo.updateStatus(update.id, update.status);
      task_updates_applied++;
    }

    return { activity_id_map: id_map, task_updates_applied };
  }
}
