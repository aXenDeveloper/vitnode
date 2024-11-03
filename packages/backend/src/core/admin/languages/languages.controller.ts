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
import {
  CreateLanguagesAdminBody,
  EditLanguagesAdminBody,
  LanguagesAdminObj,
  ShowLanguagesAdminObj,
  ShowLanguagesAdminQuery,
} from 'vitnode-shared/admin/language.dto';

import { CreateLanguagesAdminService } from './services/create.service';
import { DeleteLanguagesAdminService } from './services/delete.service';
import { EditLanguagesAdminService } from './services/edit.service';
import { ShowLanguagesAdminService } from './services/show.service';

@ApiTags('Admin')
@Controller('admin/core/languages')
@ApiSecurity('admin')
@UseGuards(AdminAuthGuard)
export class LanguagesAdminController {
  constructor(
    private readonly showService: ShowLanguagesAdminService,
    private readonly createService: CreateLanguagesAdminService,
    private readonly editService: EditLanguagesAdminService,
    private readonly deleteService: DeleteLanguagesAdminService,
  ) {}

  @Post()
  @ApiCreatedResponse({
    type: LanguagesAdminObj,
    description: 'Create language',
  })
  async createLang(
    @Body() body: CreateLanguagesAdminBody,
  ): Promise<LanguagesAdminObj> {
    return await this.createService.create(body);
  }

  @Delete(':id')
  @ApiOkResponse({
    description: 'Delete language',
  })
  async deleteLang(@Param('id') id: string) {
    await this.deleteService.delete(+id);
  }

  @Put(':id')
  @ApiOkResponse({
    type: LanguagesAdminObj,
    description: 'Edit language',
  })
  async editLang(
    @Body() body: EditLanguagesAdminBody,
    @Param('id') id: string,
  ): Promise<LanguagesAdminObj> {
    return await this.editService.edit({ body, id: +id });
  }

  @Get()
  @ApiOkResponse({
    type: ShowLanguagesAdminObj,
    description: 'Show languages',
  })
  async showLang(
    @Query() query: ShowLanguagesAdminQuery,
  ): Promise<ShowLanguagesAdminObj> {
    return await this.showService.show(query);
  }
}
