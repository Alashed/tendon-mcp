import { UserRepository } from '../domains/users/UserRepository.js';
import { WorkspaceRepository } from '../domains/workspaces/WorkspaceRepository.js';
import { TaskRepository } from '../domains/tasks/TaskRepository.js';
import { ActivityRepository } from '../domains/activities/ActivityRepository.js';
import { ActivityService } from '../domains/activities/ActivityService.js';
import { OAuthRepository } from '../domains/oauth/OAuthRepository.js';
import { OAuthService } from '../domains/oauth/OAuthService.js';

export interface Container {
  userRepository: UserRepository;
  workspaceRepository: WorkspaceRepository;
  taskRepository: TaskRepository;
  activityRepository: ActivityRepository;
  activityService: ActivityService;
  oauthRepository: OAuthRepository;
  oauthService: OAuthService;
}

let container: Container | null = null;

export function initContainer(): Container {
  const userRepository = new UserRepository();
  const workspaceRepository = new WorkspaceRepository();
  const taskRepository = new TaskRepository();
  const activityRepository = new ActivityRepository();
  const activityService = new ActivityService(activityRepository, taskRepository);
  const oauthRepository = new OAuthRepository();
  const oauthService = new OAuthService(oauthRepository, userRepository, workspaceRepository);

  container = {
    userRepository,
    workspaceRepository,
    taskRepository,
    activityRepository,
    activityService,
    oauthRepository,
    oauthService,
  };

  return container;
}

export function getContainer(): Container {
  if (!container) throw new Error('Container not initialized');
  return container;
}
