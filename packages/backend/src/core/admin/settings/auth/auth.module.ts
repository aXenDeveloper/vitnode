import { Module } from '@nestjs/common';

import { AuthSettingsAdminController } from './auth.controller';
import { EditAuthSettingsAdminService } from './services/edit.service';
import { ShowAuthSettingsAdminService } from './services/show.service';

@Module({
  providers: [ShowAuthSettingsAdminService, EditAuthSettingsAdminService],
  controllers: [AuthSettingsAdminController],
})
export class AuthSettingsAdminModule {}
