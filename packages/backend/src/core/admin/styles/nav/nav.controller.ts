import { NavMiddlewareService } from '@/core/middleware/services/nav.service';
import { AdminAuthGuard } from '@/guards/admin-auth.guard';
import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import {
  ApiCreatedResponse,
  ApiOkResponse,
  ApiSecurity,
  ApiTags,
} from '@nestjs/swagger';
import {
  ChangePositionNavStylesAdminBody,
  CreateNavStylesAdminBody,
} from 'vitnode-shared/admin/styles/nav.dto';
import { ShowNavStyles } from 'vitnode-shared/nav.dto';

import { ChangePositionNavStylesAdminService } from './services/change_position.service';
import { CreateNavStylesAdminService } from './services/create.service';
import { DeleteNavStylesAdminService } from './services/delete.service';
import { EditNavStylesAdminService } from './services/edit.service';

@ApiTags('Admin')
@Controller('admin/styles/nav')
@ApiSecurity('admin')
@UseGuards(AdminAuthGuard)
export class NavStylesAdminController {
  constructor(
    private readonly showService: NavMiddlewareService,
    private readonly createService: CreateNavStylesAdminService,
    private readonly deleteService: DeleteNavStylesAdminService,
    private readonly editService: EditNavStylesAdminService,
    private readonly changePositionService: ChangePositionNavStylesAdminService,
  ) {}

  @Put('change_position')
  @ApiOkResponse({
    description: 'Change position of nav style',
  })
  async changePosition(
    @Body() body: ChangePositionNavStylesAdminBody,
  ): Promise<void> {
    await this.changePositionService.changePosition(body);
  }

  @Post()
  @ApiCreatedResponse({
    type: ShowNavStyles,
    description: 'Create a new nav style',
  })
  async createNav(
    @Body() body: CreateNavStylesAdminBody,
  ): Promise<ShowNavStyles> {
    return await this.createService.create(body);
  }

  @Delete(':id')
  @ApiOkResponse({
    description: 'Delete a nav style',
  })
  async deleteNav(@Param('id') id: string): Promise<void> {
    await this.deleteService.delete(+id);
  }

  @Put(':id')
  @ApiOkResponse({
    type: ShowNavStyles,
    description: 'Edit a nav style',
  })
  async editNav(
    @Param('id') id: string,
    @Body() body: CreateNavStylesAdminBody,
  ) {
    return await this.editService.edit({ body, id: +id });
  }

  @Get()
  @ApiOkResponse({
    type: [ShowNavStyles],
    description: 'Show all nav styles',
  })
  async showNav(): Promise<ShowNavStyles[]> {
    return await this.showService.show();
  }
}
