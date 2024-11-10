import { Module } from '@nestjs/common';

import { EmailSettingsAdminController } from './email.controller';
import { EditEmailSettingsAdminService } from './services/edit.service';
import { LogsEmailSettingsAdminService } from './services/lags.service';
import { ShowEmailSettingsAdminService } from './services/show.service';
import { TestEmailSettingsAdminService } from './services/test.service';

@Module({
  providers: [
    ShowEmailSettingsAdminService,
    EditEmailSettingsAdminService,
    TestEmailSettingsAdminService,
    LogsEmailSettingsAdminService,
  ],
  controllers: [EmailSettingsAdminController],
})
export class EmailSettingsAdminModule {}
