import { Module } from "@nestjs/common";

import {
  CoreSessionsModule,
  GlobalCoreSessionsModule
} from "./sessions/sessions.module";
import { CoreMembersModule } from "./members/members.module";
import { CoreLanguagesModule } from "./languages/languages.module";
import { CoreMiddlewareModule } from "./middleware/middleware.module";
import { CoreFilesModule } from "./files/files.module";
import { CoreThemesModule } from "./themes/themes.module";
import { CoreNavModule } from "./nav/nav.module";
import { AdminModule } from "./admin/admin.module";
import { CorePluginsModule } from "./plugins/plugins.module";

@Module({
  imports: [
    AdminModule,
    GlobalCoreSessionsModule,
    CoreMembersModule,
    CoreSessionsModule,
    CoreLanguagesModule,
    CoreMiddlewareModule,
    CoreFilesModule,
    CoreThemesModule,
    CoreNavModule,
    CorePluginsModule
  ]
})
export class CoreModule {}
