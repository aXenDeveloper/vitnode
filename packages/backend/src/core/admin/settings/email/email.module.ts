import { Module } from '@nestjs/common';

import { EmailSettingsAdminController } from './email.controller';
import { EditEmailSettingsAdminService } from './services/edit.service';
import { ShowEmailSettingsAdminService } from './services/show.service';

@Module({
  providers: [ShowEmailSettingsAdminService, EditEmailSettingsAdminService],
  controllers: [EmailSettingsAdminController],
})
export class EmailSettingsAdminModule {}
