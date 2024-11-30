import { Module } from '@nestjs/common';

import { MainSettingsAdminController } from './main.controller';
import { EditMainSettingsAdminService } from './services/edit.service';

@Module({
  providers: [EditMainSettingsAdminService],
  controllers: [MainSettingsAdminController],
})
export class MainSettingsAdminModule {}
