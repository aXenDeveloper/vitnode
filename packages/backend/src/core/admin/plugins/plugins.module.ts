import { Module } from '@nestjs/common';

import { ChangeFilesPluginsAdminHelpersService } from './helpers/change-files.service';
import { ValidateFilesPluginsAdminHelpersService } from './helpers/validate-files.service';
import { PluginsAdminController } from './plugins.controller';
import { CreatePluginsAdminService } from './services/create.service';
import { DeletePluginsAdminService } from './services/delete.service';
import { ShowPluginsAdminService } from './services/show.service';

@Module({
  providers: [
    ShowPluginsAdminService,
    CreatePluginsAdminService,
    ValidateFilesPluginsAdminHelpersService,
    ChangeFilesPluginsAdminHelpersService,
    DeletePluginsAdminService,
  ],
  controllers: [PluginsAdminController],
})
export class PluginsAdminModule {}
