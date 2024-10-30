import { Module } from '@nestjs/common';

import { MainSettingsAdminController } from './main.controller';
import { EditMainSettingsAdminService } from './services/edit.main.service';

@Module({
  providers: [EditMainSettingsAdminService],
  controllers: [MainSettingsAdminController],
})
export class MainSettingsAdminModule {}
