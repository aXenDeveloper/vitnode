import { core_users_confirm_emails } from '@/database/schema/users';
import { InternalDatabaseService } from '@/utils/database/internal_database.service';
import { Injectable } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { lte } from 'drizzle-orm';

@Injectable()
export class ClearTokenConfirmEmailAuthCron {
  constructor(private readonly databaseService: InternalDatabaseService) {}

  @Cron(CronExpression.EVERY_MINUTE, {
    name: 'ClearTokenConfirmEmailCoreSessionsCron',
  })
  async clearTokenEmail() {
    await this.databaseService.db
      .delete(core_users_confirm_emails)
      .where(lte(core_users_confirm_emails.expires, new Date()));
  }
}
