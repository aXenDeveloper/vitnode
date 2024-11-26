import { Module } from '@nestjs/common';

import { AuthSettingsAdminController } from './auth.controller';
import { MethodsAuthSettingsAdminModule } from './methods/methods.module';
import { EditAuthSettingsAdminService } from './services/edit.service';
import { ShowAuthSettingsAdminService } from './services/show.service';

@Module({
  providers: [ShowAuthSettingsAdminService, EditAuthSettingsAdminService],
  controllers: [AuthSettingsAdminController],
  imports: [MethodsAuthSettingsAdminModule],
})
export class AuthSettingsAdminModule {}
