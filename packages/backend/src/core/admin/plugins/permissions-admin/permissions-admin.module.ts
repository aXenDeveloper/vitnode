import { Module } from '@nestjs/common';

import { PermissionsAdminPluginsAdminController } from './permissions-admin.controller';
import { CreatePermissionsAdminPluginsAdminService } from './services/create.service';
import { DeletePermissionsAdminPluginsAdminService } from './services/delete.service';
import { EditPermissionsAdminPluginsAdminService } from './services/edit.service';
import { ShowPermissionsAdminPluginsAdminService } from './services/show.service';

@Module({
  providers: [
    ShowPermissionsAdminPluginsAdminService,
    CreatePermissionsAdminPluginsAdminService,
    EditPermissionsAdminPluginsAdminService,
    DeletePermissionsAdminPluginsAdminService,
  ],
  controllers: [PermissionsAdminPluginsAdminController],
})
export class PermissionsAdminPluginsAdminModule {}
