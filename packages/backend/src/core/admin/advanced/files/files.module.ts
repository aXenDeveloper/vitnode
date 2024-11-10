import { Module } from '@nestjs/common';

import { FilesAdvancedAdminController } from './files.controller';
import { DeleteFilesAdvancedAdminService } from './services/delete.service';
import { ShowFilesAdvancedAdminService } from './services/show.service';

@Module({
  providers: [ShowFilesAdvancedAdminService, DeleteFilesAdvancedAdminService],
  controllers: [FilesAdvancedAdminController],
})
export class FilesAdvancedAdminModule {}
