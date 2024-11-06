import { Module } from '@nestjs/common';

import { FilesAdvancedAdminModule } from './files/files.module';

@Module({
  imports: [FilesAdvancedAdminModule],
})
export class AdvancedAdminModule {}
