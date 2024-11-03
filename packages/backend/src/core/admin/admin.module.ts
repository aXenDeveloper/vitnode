import { Module } from '@nestjs/common';

import { AuthAdminModule } from './auth/auth.module';
import { LanguagesAdminModule } from './languages/languages.module';
import { MembersAdminModule } from './members/members.module';
import { SettingsAdminModule } from './settings/settings.module';

@Module({
  imports: [
    AuthAdminModule,
    SettingsAdminModule,
    MembersAdminModule,
    LanguagesAdminModule,
  ],
})
export class AdminModule {}
