import { UserRepository } from '../domains/users/UserRepository.js';
import { WorkspaceRepository } from '../domains/workspaces/WorkspaceRepository.js';
import { TaskRepository } from '../domains/tasks/TaskRepository.js';
import { ActivityRepository } from '../domains/activities/ActivityRepository.js';
import { ActivityService } from '../domains/activities/ActivityService.js';
import { OAuthRepository } from '../domains/oauth/OAuthRepository.js';
import { OAuthService } from '../domains/oauth/OAuthService.js';
import { TelegramRepository } from '../domains/telegram/TelegramRepository.js';
import { TelegramService } from '../domains/telegram/TelegramService.js';

export interface Container {
  userRepository: UserRepository;
  workspaceRepository: WorkspaceRepository;
  taskRepository: TaskRepository;
  activityRepository: ActivityRepository;
  activityService: ActivityService;
  oauthRepository: OAuthRepository;
  oauthService: OAuthService;
  telegramRepository: TelegramRepository;
  telegramService: TelegramService;
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
  const telegramRepository = new TelegramRepository();
  const telegramService = new TelegramService(telegramRepository);

  container = {
    userRepository,
    workspaceRepository,
    taskRepository,
    activityRepository,
    activityService,
    oauthRepository,
    oauthService,
    telegramRepository,
    telegramService,
  };

  return container;
}

export function getContainer(): Container {
  if (!container) throw new Error('Container not initialized');
  return container;
}
