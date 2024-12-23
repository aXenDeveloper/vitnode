import { OnlyForDevelopment } from '@/guards/dev.guard';
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

  @ApiOkResponse({
    description: 'Delete language',
  })
  @Delete(':id')
  async deleteLang(@Param('id') id: string) {
    await this.deleteService.delete(+id);
  }

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

  @ApiCreatedResponse({
    description: 'Translate content with AI',
  })
  @Post('translate-ai/:code')
  @UseGuards(OnlyForDevelopment)
  async translateAi(@Param('code') code: string) {
    await this.translateAiService.translateAi(code);
  }
}
