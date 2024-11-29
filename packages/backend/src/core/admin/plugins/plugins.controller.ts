import { Controllers } from '@/helpers/controller.decorator';
import { Body, Delete, Get, Param, Post, Put, Query } from '@nestjs/common';
import { ApiCreatedResponse, ApiOkResponse } from '@nestjs/swagger';
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

@Controllers({ plugin_name: 'Core', plugin_code: 'plugins', isAdmin: true })
export class PluginsAdminController {
  constructor(
    private readonly showService: ShowPluginsAdminService,
    private readonly createService: CreatePluginsAdminService,
    private readonly deleteService: DeletePluginsAdminService,
    private readonly itemService: ItemPluginsAdminService,
    private readonly editService: EditPluginsAdminService,
  ) {}

  @ApiCreatedResponse({ description: 'Plugin created', type: ShowPluginAdmin })
  @Post()
  async createPlugin(
    @Body() body: CreatePluginsAdminBody,
  ): Promise<ShowPluginAdmin> {
    return await this.createService.create(body);
  }

  @ApiOkResponse({ description: 'Plugin deleted' })
  @Delete(':id')
  async deletePlugin(@Param('id') id: string): Promise<void> {
    await this.deleteService.delete(+id);
  }

  @ApiOkResponse({
    type: ShowPluginAdmin,
    description: 'Plugin updated',
  })
  @Put(':code')
  async editPlugin(
    @Param('code') code: string,
    @Body() body: EditPluginsAdminBody,
  ): Promise<ShowPluginAdmin> {
    return await this.editService.edit({ code, body });
  }

  @ApiOkResponse({ type: ShowPluginAdmin, description: 'Plugin details' })
  @Get(':code')
  async itemPlugin(@Param('code') code: string): Promise<ShowPluginAdmin> {
    return await this.itemService.item(code);
  }

  @ApiOkResponse({ type: ShowPluginsAdminObj, description: 'List of plugins' })
  @Get()
  async showPlugin(
    @Query() query: ShowPluginsAdminQuery,
  ): Promise<ShowPluginsAdminObj> {
    return await this.showService.show(query);
  }
}
