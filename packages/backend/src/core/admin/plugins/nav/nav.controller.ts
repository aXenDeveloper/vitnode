import { Controllers } from '@/helpers/controller.decorator';
import { Body, Delete, Get, Param, Post, Put } from '@nestjs/common';
import { ApiOkResponse } from '@nestjs/swagger';
import { ParentNavAuthAdminObj } from 'vitnode-shared/admin/auth.dto';
import {
  ChangePositionNavPluginsAdminBody,
  CreateNavPluginsAdminBody,
  DeleteNavPluginsAdminBody,
} from 'vitnode-shared/admin/plugins/nav.dto';

import { ChangePositionNavPluginsAdminService } from './services/change_position.service';
import { CreateNavPluginsAdminService } from './services/create.service';
import { DeleteNavPluginsAdminService } from './services/delete.service';
import { EditNavPluginsAdminService } from './services/edit.service';
import { ShowNavPluginsAdminService } from './services/show.service';

@Controllers({
  plugin_name: 'Core',
  plugin_code: 'plugins',
  isAdmin: true,
  route: 'nav',
})
export class NavPluginsAdminController {
  constructor(
    private readonly showService: ShowNavPluginsAdminService,
    private readonly createService: CreateNavPluginsAdminService,
    private readonly editService: EditNavPluginsAdminService,
    private readonly deleteService: DeleteNavPluginsAdminService,
    private readonly changePositionService: ChangePositionNavPluginsAdminService,
  ) {}

  @ApiOkResponse({ description: 'Nav plugin position changed' })
  @Put('change_position/:plugin_code/:code')
  async changePositionNav(
    @Param('plugin_code') plugin_code: string,
    @Param('code') code: string,
    @Body() body: ChangePositionNavPluginsAdminBody,
  ): Promise<void> {
    await this.changePositionService.changePosition({
      plugin_code,
      code,
      body,
    });
  }

  @ApiOkResponse({
    description: 'Nav plugin created',
    type: ParentNavAuthAdminObj,
  })
  @Post(':plugin_code')
  async createNav(
    @Param('plugin_code') plugin_code: string,
    @Body() body: CreateNavPluginsAdminBody,
  ): Promise<ParentNavAuthAdminObj> {
    return await this.createService.create({ plugin_code, body });
  }

  @ApiOkResponse({ description: 'Nav plugin position changed' })
  @ApiOkResponse({ description: 'Nav plugin deleted' })
  @Delete(':plugin_code/:code')
  async deleteNav(
    @Param('plugin_code') plugin_code: string,
    @Param('code') code: string,
    @Body() body: DeleteNavPluginsAdminBody,
  ): Promise<void> {
    await this.deleteService.delete({ plugin_code, code, body });
  }

  @ApiOkResponse({
    description: 'Nav plugin edited',
    type: ParentNavAuthAdminObj,
  })
  @Put(':plugin_code/:code')
  async editNav(
    @Param('plugin_code') plugin_code: string,
    @Param('code') code: string,
    @Body() body: CreateNavPluginsAdminBody,
  ): Promise<ParentNavAuthAdminObj> {
    return await this.editService.edit({
      body,
      plugin_code,
      previous_code: code,
    });
  }

  @ApiOkResponse({ description: 'Nav plugins', type: [ParentNavAuthAdminObj] })
  @Get(':plugin_code')
  async showNav(
    @Param('plugin_code') plugin_code: string,
  ): Promise<ParentNavAuthAdminObj[]> {
    return await this.showService.show(plugin_code);
  }
}
