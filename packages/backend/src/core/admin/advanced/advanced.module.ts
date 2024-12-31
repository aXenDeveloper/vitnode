import { Module } from '@nestjs/common';

import { CronAdvancedAdminModule } from './cron/cron.module';
import { FilesAdvancedAdminModule } from './files/files.module';

@Module({
  imports: [FilesAdvancedAdminModule, CronAdvancedAdminModule],
})
export class AdvancedAdminModule {}
