import { Module } from '@nestjs/common';

import { EmailSettingsAdminController } from './email.controller';
import { EditEmailSettingsAdminService } from './services/edit.service';
import { ShowEmailSettingsAdminService } from './services/show.service';
import { TestEmailSettingsAdminService } from './services/test.service';

@Module({
  providers: [
    ShowEmailSettingsAdminService,
    EditEmailSettingsAdminService,
    TestEmailSettingsAdminService,
  ],
  controllers: [EmailSettingsAdminController],
})
export class EmailSettingsAdminModule {}
