import { query } from '../../shared/db/pool.js';
import type { User } from '@alashed/shared';

export interface CreateUserDTO {
  email: string;
  name: string;
  password_hash: string;
}

export class UserRepository {
  async create(dto: CreateUserDTO): Promise<User> {
    const result = await query<User>(
      `INSERT INTO users (email, name, password_hash) VALUES ($1, $2, $3) RETURNING id, email, name, telegram_id, created_at, updated_at`,
      [dto.email, dto.name, dto.password_hash],
    );
    return result.rows[0]!;
  }

  async findByEmail(email: string): Promise<(User & { password_hash: string }) | null> {
    const result = await query<User & { password_hash: string }>(
      `SELECT id, email, name, telegram_id, password_hash, created_at, updated_at FROM users WHERE email = $1`,
      [email],
    );
    return result.rows[0] ?? null;
  }

  async findById(id: string): Promise<User | null> {
    const result = await query<User>(
      `SELECT id, email, name, telegram_id, created_at, updated_at FROM users WHERE id = $1`,
      [id],
    );
    return result.rows[0] ?? null;
  }
}
