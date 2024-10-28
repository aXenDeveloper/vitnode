import { Module } from '@nestjs/common';

import { EditMainSettingsAdminService } from './services/edit.main.service';
import { SettingsAdminController } from './settings.controller';

@Module({
  providers: [EditMainSettingsAdminService],
  controllers: [SettingsAdminController],
})
export class SettingsAdminModule {}
