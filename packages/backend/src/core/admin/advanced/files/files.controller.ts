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

@ApiTags('Admin')
@Controller('admin/advanced/files')
@ApiSecurity('admin')
@UseGuards(AdminAuthGuard)
export class FilesAdvancedAdminController {
  constructor(
    private readonly showService: ShowFilesAdvancedAdminService,
    private readonly deleteService: DeleteFilesAdvancedAdminService,
  ) {}

  @Delete(':id')
  @ApiOkResponse({
    description: 'Delete file',
  })
  async deleteFile(@Param('id') id: string): Promise<void> {
    await this.deleteService.delete(+id);
  }

  @Get()
  @ApiOkResponse({
    type: ShowFilesAdvancedAdminObj,
    description: 'Show files from all users',
  })
  async showFiles(
    @Query() query: ShowFilesAdvancedAdminQuery,
  ): Promise<ShowFilesAdvancedAdminObj> {
    return await this.showService.show(query);
  }
}
