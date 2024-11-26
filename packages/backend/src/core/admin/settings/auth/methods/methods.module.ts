import { Module } from '@nestjs/common';

import { MethodsAuthSettingsAdminController } from './methods.controller';
import { CreateMethodsAuthSettingsAdminService } from './services/create.service';
import { DeleteMethodsAuthSettingsAdminService } from './services/delete.service';
import { EditMethodsAuthSettingsAdminService } from './services/edit.service';
import { ShowMethodsAuthSettingsAdminService } from './services/show.service';

@Module({
  providers: [
    ShowMethodsAuthSettingsAdminService,
    CreateMethodsAuthSettingsAdminService,
    DeleteMethodsAuthSettingsAdminService,
    EditMethodsAuthSettingsAdminService,
  ],
  controllers: [MethodsAuthSettingsAdminController],
})
export class MethodsAuthSettingsAdminModule {}
