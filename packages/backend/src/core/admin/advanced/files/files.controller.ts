import { AdminAuthGuard } from '@/guards/admin-auth.guard';
import {
  Controller,
  Delete,
  Get,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiOkResponse, ApiSecurity, ApiTags } from '@nestjs/swagger';
import {
  ShowFilesAdvancedAdminObj,
  ShowFilesAdvancedAdminQuery,
} from 'vitnode-shared/admin/advanced/files.dto';

import { DeleteFilesAdvancedAdminService } from './services/delete.service';
import { ShowFilesAdvancedAdminService } from './services/show.service';

@ApiSecurity('admin')
@ApiTags('Admin')
@Controller('admin/advanced/files')
@UseGuards(AdminAuthGuard)
export class FilesAdvancedAdminController {
  constructor(
    private readonly showService: ShowFilesAdvancedAdminService,
    private readonly deleteService: DeleteFilesAdvancedAdminService,
  ) {}

  @ApiOkResponse({
    description: 'Delete file',
  })
  @Delete(':id')
  async deleteFile(@Param('id') id: string): Promise<void> {
    await this.deleteService.delete(+id);
  }

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
