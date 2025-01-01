import { AdminPermission } from '@/helpers/auth/admin-permission.decorator';
import { Controllers } from '@/helpers/controller.decorator';
import { Delete, Get, Param, Query } from '@nestjs/common';
import { ApiOkResponse } from '@nestjs/swagger';
import {
  ShowFilesAdvancedAdminObj,
  ShowFilesAdvancedAdminQuery,
} from 'vitnode-shared/admin/advanced/files.dto';

import { DeleteFilesAdvancedAdminService } from './services/delete.service';
import { ShowFilesAdvancedAdminService } from './services/show.service';

@Controllers({
  plugin_name: 'Core',
  plugin_code: 'advanced',
  isAdmin: true,
  route: 'files',
})
export class FilesAdvancedAdminController {
  constructor(
    private readonly showService: ShowFilesAdvancedAdminService,
    private readonly deleteService: DeleteFilesAdvancedAdminService,
  ) {}

  @AdminPermission({
    plugin_code: 'core',
    group: 'advanced',
    permission: 'can_manage_advanced_files',
  })
  @ApiOkResponse({
    description: 'Delete file',
  })
  @Delete(':id')
  async deleteFile(@Param('id') id: string): Promise<void> {
    await this.deleteService.delete(+id);
  }

  @AdminPermission({
    plugin_code: 'core',
    group: 'advanced',
    permission: 'can_manage_advanced_files',
  })
  @ApiOkResponse({
    type: ShowFilesAdvancedAdminObj,
    description: 'Show files from all users',
  })
  @Get()
  async showFiles(
    @Query() query: ShowFilesAdvancedAdminQuery,
  ): Promise<ShowFilesAdvancedAdminObj> {
    return await this.showService.show(query);
  }
}
