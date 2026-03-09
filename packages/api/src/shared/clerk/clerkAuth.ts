import { createClerkClient, verifyToken } from '@clerk/backend';
import { config } from '../../config/index.js';
import type { UserRepository } from '../../domains/users/UserRepository.js';
import type { WorkspaceRepository } from '../../domains/workspaces/WorkspaceRepository.js';
import type { User } from '@alashed/shared';

const clerk = createClerkClient({ secretKey: config.clerkSecretKey });

export interface ClerkAuthResult {
  clerkUserId: string;
  user: User;
  workspaceId: string;
}

/**
 * Verify a Clerk session token and upsert the user in our database.
 * Creates a personal workspace for new users automatically.
 */
export async function verifyAndUpsertClerkUser(
  token: string,
  userRepo: UserRepository,
  workspaceRepo: WorkspaceRepository,
): Promise<ClerkAuthResult> {
  const payload = await verifyToken(token, { secretKey: config.clerkSecretKey });
  const clerkUserId = payload.sub;

  let user = await userRepo.findByClerkId(clerkUserId);

  if (!user) {
    // First time this Clerk user hits our API — fetch their details
    const clerkUser = await clerk.users.getUser(clerkUserId);
    const email = clerkUser.emailAddresses[0]?.emailAddress ?? '';
    const name =
      [clerkUser.firstName, clerkUser.lastName].filter(Boolean).join(' ').trim() || email;

    // Try to link by email (user may have registered before Clerk was added)
    const existing = await userRepo.findByEmail(email);
    if (existing) {
      await userRepo.setClerkId(existing.id, clerkUserId);
      user = existing;
    } else {
      // Brand new user — create account + workspace
      user = await userRepo.create({ email, name, clerk_user_id: clerkUserId });
      await workspaceRepo.createPersonal(user.id, `${name}'s workspace`);
    }
  }

  const workspaces = await workspaceRepo.listForUser(user.id);
  const personal = workspaces.find((w) => w.type === 'personal') ?? workspaces[0];

  return {
    clerkUserId,
    user,
    workspaceId: personal?.id ?? '',
  };
}
