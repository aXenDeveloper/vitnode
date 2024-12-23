import { Module } from '@nestjs/common';

import { AdvancedAdminModule } from './advanced/advanced.module';
import { AuthAdminModule } from './auth/auth.module';
import { DashboardAdminModule } from './dashboard/dashboard.module';
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
    AdvancedAdminModule,
    DashboardAdminModule,
  ],
})
export class AdminModule {}
