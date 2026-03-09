import { UserRepository } from '../domains/users/UserRepository.js';
import { WorkspaceRepository } from '../domains/workspaces/WorkspaceRepository.js';
import { TaskRepository } from '../domains/tasks/TaskRepository.js';
import { ActivityRepository } from '../domains/activities/ActivityRepository.js';
import { ActivityService } from '../domains/activities/ActivityService.js';

export interface Container {
  userRepository: UserRepository;
  workspaceRepository: WorkspaceRepository;
  taskRepository: TaskRepository;
  activityRepository: ActivityRepository;
  activityService: ActivityService;
}

let container: Container | null = null;

export function initContainer(): Container {
  const userRepository = new UserRepository();
  const workspaceRepository = new WorkspaceRepository();
  const taskRepository = new TaskRepository();
  const activityRepository = new ActivityRepository();
  const activityService = new ActivityService(activityRepository, taskRepository);

  container = {
    userRepository,
    workspaceRepository,
    taskRepository,
    activityRepository,
    activityService,
  };

  return container;
}

export function getContainer(): Container {
  if (!container) throw new Error('Container not initialized');
  return container;
}
