import { Module } from '@nestjs/common';

import { ChangeFilesPluginsAdminHelpersService } from './helpers/change-files.service';
import { ValidateFilesPluginsAdminHelpersService } from './helpers/validate-files.service';
import { NavPluginsAdminModule } from './nav/nav.module';
import { PluginsAdminController } from './plugins.controller';
import { CreatePluginsAdminService } from './services/create.service';
import { DeletePluginsAdminService } from './services/delete.service';
import { EditPluginsAdminService } from './services/edit.service';
import { ItemPluginsAdminService } from './services/item.service';
import { ShowPluginsAdminService } from './services/show.service';

@Module({
  providers: [
    ShowPluginsAdminService,
    CreatePluginsAdminService,
    ValidateFilesPluginsAdminHelpersService,
    ChangeFilesPluginsAdminHelpersService,
    DeletePluginsAdminService,
    ItemPluginsAdminService,
    EditPluginsAdminService,
  ],
  controllers: [PluginsAdminController],
  imports: [NavPluginsAdminModule],
})
export class PluginsAdminModule {}
