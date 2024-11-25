import { Module } from '@nestjs/common';

import { MethodsAuthSettingsAdminController } from './methods.controller';
import { ShowMethodsAuthSettingsAdminService } from './services/show.service';

@Module({
  providers: [ShowMethodsAuthSettingsAdminService],
  controllers: [MethodsAuthSettingsAdminController],
})
export class MethodsAuthSettingsAdminModule {}
