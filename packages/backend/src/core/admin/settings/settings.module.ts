import { Module } from '@nestjs/common';

import { EmailSettingsAdminModule } from './email/email.module';
import { LegalSettingsAdminModule } from './legal/legal.module';
import { MainSettingsAdminModule } from './main/main.module';

@Module({
  imports: [
    MainSettingsAdminModule,
    LegalSettingsAdminModule,
    EmailSettingsAdminModule,
  ],
})
export class SettingsAdminModule {}
