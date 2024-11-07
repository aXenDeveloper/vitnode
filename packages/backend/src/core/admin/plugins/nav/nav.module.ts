import { Module } from '@nestjs/common';

import { HelpersAdminNavPluginsService } from './helpers.service';
import { NavPluginsAdminController } from './nav.controller';
import { ChangePositionNavPluginsAdminService } from './services/change_position.service';
import { CreateNavPluginsAdminService } from './services/create.service';
import { DeleteNavPluginsAdminService } from './services/delete.service';
import { EditNavPluginsAdminService } from './services/edit.service';
import { ShowNavPluginsAdminService } from './services/show.service';

@Module({
  providers: [
    ShowNavPluginsAdminService,
    HelpersAdminNavPluginsService,
    CreateNavPluginsAdminService,
    EditNavPluginsAdminService,
    DeleteNavPluginsAdminService,
    ChangePositionNavPluginsAdminService,
  ],
  controllers: [NavPluginsAdminController],
})
export class NavPluginsAdminModule {}
