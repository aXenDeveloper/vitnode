import { Module } from '@nestjs/common';

import { LegalSettingsAdminModule } from './legal/legal.module';
import { MainSettingsAdminModule } from './main/main.module';

@Module({
  imports: [MainSettingsAdminModule, LegalSettingsAdminModule],
})
export class SettingsAdminModule {}
