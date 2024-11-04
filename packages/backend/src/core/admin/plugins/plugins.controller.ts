import { AdminAuthGuard } from '@/guards/admin-auth.guard';
import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiCreatedResponse,
  ApiOkResponse,
  ApiSecurity,
  ApiTags,
} from '@nestjs/swagger';
import {
  CreatePluginsAdminBody,
  ShowPluginAdmin,
  ShowPluginsAdminObj,
  ShowPluginsAdminQuery,
} from 'vitnode-shared/admin/plugins.dto';

import { CreatePluginsAdminService } from './services/create.service';
import { DeletePluginsAdminService } from './services/delete.service';
import { ShowPluginsAdminService } from './services/show.service';

@ApiTags('Admin')
@Controller('admin/plugins')
@ApiSecurity('admin')
@UseGuards(AdminAuthGuard)
export class PluginsAdminController {
  constructor(
    private readonly showService: ShowPluginsAdminService,
    private readonly createService: CreatePluginsAdminService,
    private readonly deleteService: DeletePluginsAdminService,
  ) {}

  @Post()
  @ApiCreatedResponse({ description: 'Plugin created', type: ShowPluginAdmin })
  async create(@Body() body: CreatePluginsAdminBody): Promise<ShowPluginAdmin> {
    return await this.createService.create(body);
  }

  @Delete(':id')
  @ApiOkResponse({ description: 'Plugin deleted' })
  async delete(@Param('id') id: string): Promise<void> {
    await this.deleteService.delete(+id);
  }

  @Get()
  @ApiOkResponse({ type: ShowPluginsAdminObj, description: 'List of plugins' })
  async show(
    @Query() query: ShowPluginsAdminQuery,
  ): Promise<ShowPluginsAdminObj> {
    return await this.showService.show(query);
  }
}
