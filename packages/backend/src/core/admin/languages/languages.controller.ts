import { OnlyForDevelopment } from '@/guards/dev.guard';
import { AdminPermission } from '@/helpers/auth/admin-permission.decorator';
import { Controllers } from '@/helpers/controller.decorator';
import {
  Body,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiCreatedResponse, ApiOkResponse } from '@nestjs/swagger';
import {
  CreateLanguagesAdminBody,
  EditLanguagesAdminBody,
  LanguagesAdminObj,
  ShowLanguagesAdminObj,
  ShowLanguagesAdminQuery,
  TranslateAiLanguagesAdminBody,
} from 'vitnode-shared/admin/language.dto';

import { CreateLanguagesAdminService } from './services/create.service';
import { DeleteLanguagesAdminService } from './services/delete.service';
import { EditLanguagesAdminService } from './services/edit.service';
import { ShowLanguagesAdminService } from './services/show.service';
import { TranslateAiLanguagesAdminService } from './services/translate-ai.service';

@Controllers({
  plugin_name: 'Core',
  plugin_code: 'languages',
  isAdmin: true,
})
export class LanguagesAdminController {
  constructor(
    private readonly showService: ShowLanguagesAdminService,
    private readonly createService: CreateLanguagesAdminService,
    private readonly editService: EditLanguagesAdminService,
    private readonly deleteService: DeleteLanguagesAdminService,
    private readonly translateAiService: TranslateAiLanguagesAdminService,
  ) {}

  @AdminPermission({
    plugin_code: 'core',
    group: 'can_manage_langs',
  })
  @ApiCreatedResponse({
    type: LanguagesAdminObj,
    description: 'Create language',
  })
  @Post()
  async createLang(
    @Body() body: CreateLanguagesAdminBody,
  ): Promise<LanguagesAdminObj> {
    return await this.createService.create(body);
  }

  @AdminPermission({
    plugin_code: 'core',
    group: 'can_manage_langs',
  })
  @ApiOkResponse({
    description: 'Delete language',
  })
  @Delete(':id')
  async deleteLang(@Param('id') id: string) {
    await this.deleteService.delete(+id);
  }

  @AdminPermission({
    plugin_code: 'core',
    group: 'can_manage_langs',
  })
  @ApiOkResponse({
    type: LanguagesAdminObj,
    description: 'Edit language',
  })
  @Put(':id')
  async editLang(
    @Body() body: EditLanguagesAdminBody,
    @Param('id') id: string,
  ): Promise<LanguagesAdminObj> {
    return await this.editService.edit({ body, id: +id });
  }

  @AdminPermission({
    plugin_code: 'core',
    group: 'can_manage_langs',
  })
  @ApiOkResponse({
    type: ShowLanguagesAdminObj,
    description: 'Show languages',
  })
  @Get()
  async showLang(
    @Query() query: ShowLanguagesAdminQuery,
  ): Promise<ShowLanguagesAdminObj> {
    return await this.showService.show(query);
  }

  @AdminPermission({
    plugin_code: 'core',
    group: 'can_manage_langs',
  })
  @ApiCreatedResponse({
    description: 'Translate content with AI',
  })
  @Post('translate-ai/:code')
  @UseGuards(OnlyForDevelopment)
  async translateAi(
    @Param('code') code: string,
    @Body() body: TranslateAiLanguagesAdminBody,
  ) {
    await this.translateAiService.translateAi({ code, body });
  }
}
