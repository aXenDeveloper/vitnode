import { AdminAuthGuard } from '@/guards/admin-auth.guard';
import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiCreatedResponse,
  ApiOkResponse,
  ApiSecurity,
  ApiTags,
} from '@nestjs/swagger';
import { EditPluginsAdminBody } from 'vitnode-shared/admin/plugin.dto';
import {
  CreatePluginsAdminBody,
  ShowPluginAdmin,
  ShowPluginsAdminObj,
  ShowPluginsAdminQuery,
} from 'vitnode-shared/admin/plugins.dto';

import { CreatePluginsAdminService } from './services/create.service';
import { DeletePluginsAdminService } from './services/delete.service';
import { EditPluginsAdminService } from './services/edit.service';
import { ItemPluginsAdminService } from './services/item.service';
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
    private readonly itemService: ItemPluginsAdminService,
    private readonly editService: EditPluginsAdminService,
  ) {}

  @Post()
  @ApiCreatedResponse({ description: 'Plugin created', type: ShowPluginAdmin })
  async createPlugin(
    @Body() body: CreatePluginsAdminBody,
  ): Promise<ShowPluginAdmin> {
    return await this.createService.create(body);
  }

  @Delete(':id')
  @ApiOkResponse({ description: 'Plugin deleted' })
  async deletePlugin(@Param('id') id: string): Promise<void> {
    await this.deleteService.delete(+id);
  }

  @Put(':code')
  @ApiOkResponse({
    type: ShowPluginAdmin,
    description: 'Plugin updated',
  })
  async editPlugin(
    @Param('code') code: string,
    @Body() body: EditPluginsAdminBody,
  ): Promise<ShowPluginAdmin> {
    return await this.editService.edit({ code, body });
  }

  @Get(':code')
  @ApiOkResponse({ type: ShowPluginAdmin, description: 'Plugin details' })
  async itemPlugin(@Param('code') code: string): Promise<ShowPluginAdmin> {
    return await this.itemService.item(code);
  }

  @Get()
  @ApiOkResponse({ type: ShowPluginsAdminObj, description: 'List of plugins' })
  async showPlugin(
    @Query() query: ShowPluginsAdminQuery,
  ): Promise<ShowPluginsAdminObj> {
    return await this.showService.show(query);
  }
}
