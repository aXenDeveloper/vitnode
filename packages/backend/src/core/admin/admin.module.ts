import { Module } from '@nestjs/common';

import { AuthAdminModule } from './auth/auth.module';
import { LanguagesAdminModule } from './languages/languages.module';
import { MembersAdminModule } from './members/members.module';
import { PluginsAdminModule } from './plugins/plugins.module';
import { SettingsAdminModule } from './settings/settings.module';
import { StylesAdminModule } from './styles/styles.module';

@Module({
  imports: [
    AuthAdminModule,
    SettingsAdminModule,
    MembersAdminModule,
    LanguagesAdminModule,
    PluginsAdminModule,
    StylesAdminModule,
  ],
})
export class AdminModule {}
