import { Module } from '@nestjs/common';

import { AuthSettingsAdminModule } from './auth/auth.module';
import { EmailSettingsAdminModule } from './email/email.module';
import { LegalSettingsAdminModule } from './legal/legal.module';
import { MainSettingsAdminModule } from './main/main.module';
import { MetadataSettingsAdminModule } from './metadata/metadata.module';

@Module({
  imports: [
    MainSettingsAdminModule,
    LegalSettingsAdminModule,
    EmailSettingsAdminModule,
    AuthSettingsAdminModule,
    MetadataSettingsAdminModule,
  ],
})
export class SettingsAdminModule {}
