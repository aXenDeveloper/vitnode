import { Module } from '@nestjs/common';

import { MethodsAuthSettingsAdminController } from './methods.controller';
import { CreateMethodsAuthSettingsAdminService } from './services/create.service';
import { DeleteMethodsAuthSettingsAdminService } from './services/delete.service';
import { ShowMethodsAuthSettingsAdminService } from './services/show.service';

@Module({
  providers: [
    ShowMethodsAuthSettingsAdminService,
    CreateMethodsAuthSettingsAdminService,
    DeleteMethodsAuthSettingsAdminService,
  ],
  controllers: [MethodsAuthSettingsAdminController],
})
export class MethodsAuthSettingsAdminModule {}
