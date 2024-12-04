import { core_users_forgot_password } from '@/database/schema/users';
import { InternalDatabaseService } from '@/utils/database/internal_database.service';
import { Injectable } from '@nestjs/common';
import { lte } from 'drizzle-orm';

@Injectable()
export class ForgotPasswordAuthCron {
  constructor(private readonly databaseService: InternalDatabaseService) {}

  async clearExpiredTokens() {
    await this.databaseService.db
      .delete(core_users_forgot_password)
      .where(lte(core_users_forgot_password.expires_at, new Date()));
  }
}
