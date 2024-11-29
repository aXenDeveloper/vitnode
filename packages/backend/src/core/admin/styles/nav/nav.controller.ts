import { NavMiddlewareService } from '@/core/middleware/services/nav.service';
import { Controllers } from '@/helpers/controller.decorator';
import { Body, Delete, Get, Param, Post, Put } from '@nestjs/common';
import { ApiCreatedResponse, ApiOkResponse } from '@nestjs/swagger';
import {
  ChangePositionNavStylesAdminBody,
  CreateNavStylesAdminBody,
} from 'vitnode-shared/admin/styles/nav.dto';
import { ShowNavStyles } from 'vitnode-shared/nav.dto';

import { ChangePositionNavStylesAdminService } from './services/change_position.service';
import { CreateNavStylesAdminService } from './services/create.service';
import { DeleteNavStylesAdminService } from './services/delete.service';
import { EditNavStylesAdminService } from './services/edit.service';

@Controllers({
  plugin_name: 'Core',
  plugin_code: 'styles',
  isAdmin: true,
  route: 'nav',
})
export class NavStylesAdminController {
  constructor(
    private readonly showService: NavMiddlewareService,
    private readonly createService: CreateNavStylesAdminService,
    private readonly deleteService: DeleteNavStylesAdminService,
    private readonly editService: EditNavStylesAdminService,
    private readonly changePositionService: ChangePositionNavStylesAdminService,
  ) {}

  @ApiOkResponse({
    description: 'Change position of nav style',
  })
  @Put('change_position')
  async changePosition(
    @Body() body: ChangePositionNavStylesAdminBody,
  ): Promise<void> {
    await this.changePositionService.changePosition(body);
  }

  @ApiCreatedResponse({
    type: ShowNavStyles,
    description: 'Create a new nav style',
  })
  @Post()
  async createNav(
    @Body() body: CreateNavStylesAdminBody,
  ): Promise<ShowNavStyles> {
    return await this.createService.create(body);
  }

  @ApiOkResponse({
    description: 'Delete a nav style',
  })
  @Delete(':id')
  async deleteNav(@Param('id') id: string): Promise<void> {
    await this.deleteService.delete(+id);
  }

  @ApiOkResponse({
    type: ShowNavStyles,
    description: 'Edit a nav style',
  })
  @Put(':id')
  async editNav(
    @Param('id') id: string,
    @Body() body: CreateNavStylesAdminBody,
  ) {
    return await this.editService.edit({ body, id: +id });
  }

  @ApiOkResponse({
    type: [ShowNavStyles],
    description: 'Show all nav styles',
  })
  @Get()
  async showNav(): Promise<ShowNavStyles[]> {
    return await this.showService.show();
  }
}
