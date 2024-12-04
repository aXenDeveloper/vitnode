import {
  core_users,
  core_users_forgot_password,
} from '@/database/schema/users';
import { InternalDatabaseService } from '@/utils/database/internal_database.service';
import { Injectable, NotFoundException } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { ChangeForgotPasswordAuthBody } from 'vitnode-shared/auth/auth.dto';

import { encryptPassword } from '../../helpers/password';
import { VerifyForgotPasswordAuthService } from '../verify.service';

@Injectable()
export class ChangeForgotPasswordAuthService {
  constructor(
    private readonly databaseService: InternalDatabaseService,
    private readonly verifyService: VerifyForgotPasswordAuthService,
  ) {}

  async change({
    token,
    user_id,
    password,
  }: ChangeForgotPasswordAuthBody): Promise<void> {
    const data =
      await this.databaseService.db.query.core_users_forgot_password.findFirst({
        where: (table, { eq, and }) =>
          and(eq(table.token, token), eq(table.user_id, user_id)),
        columns: {
          id: true,
          token: true,
          expires_at: true,
        },
        with: {
          user: {
            columns: {
              email: true,
            },
          },
        },
      });

    if (!data || new Date(data.expires_at) < new Date()) {
      throw new NotFoundException();
    }

    try {
      await this.verifyService.verifyToken({
        email: data.user.email,
        token: data.token,
      });
    } catch (_) {
      throw new NotFoundException();
    }

    const hashPassword = await encryptPassword(password);

    await this.databaseService.db
      .update(core_users)
      .set({
        password: hashPassword,
      })
      .where(eq(core_users.id, user_id));

    await this.databaseService.db
      .delete(core_users_forgot_password)
      .where(eq(core_users_forgot_password.user_id, user_id));
  }
}
