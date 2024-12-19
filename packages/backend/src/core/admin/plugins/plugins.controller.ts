import type { Response } from 'express';

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
  Res,
  UploadedFiles,
  UseGuards,
} from '@nestjs/common';
import { ApiCreatedResponse, ApiOkResponse } from '@nestjs/swagger';
import { EditPluginsAdminBody } from 'vitnode-shared/admin/plugin.dto';
import {
  CreatePluginsAdminBody,
  ExportPluginsAdminBody,
  ShowPluginAdmin,
  ShowPluginsAdminObj,
  ShowPluginsAdminQuery,
  UploadPluginsAdminBody,
} from 'vitnode-shared/admin/plugins.dto';

import { CreatePluginsAdminService } from './services/create.service';
import { DeletePluginsAdminService } from './services/delete.service';
import { EditPluginsAdminService } from './services/edit.service';
import { ExportPluginsAdminService } from './services/export.service';
import { ItemPluginsAdminService } from './services/item.service';
import { ShowPluginsAdminService } from './services/show.service';
import { UploadPluginsAdminService } from './services/upload.service';
import { UploadFilesMethod } from '@/helpers/upload-files.decorator';
import { FilesValidationPipe } from '@/helpers/files/files.pipe';

@Controllers({ plugin_name: 'Core', plugin_code: 'plugins', isAdmin: true })
export class PluginsAdminController {
  constructor(
    private readonly showService: ShowPluginsAdminService,
    private readonly createService: CreatePluginsAdminService,
    private readonly deleteService: DeletePluginsAdminService,
    private readonly itemService: ItemPluginsAdminService,
    private readonly editService: EditPluginsAdminService,
    private readonly exportService: ExportPluginsAdminService,
    private readonly uploadService: UploadPluginsAdminService,
  ) {}

  @ApiCreatedResponse({ description: 'Plugin uploaded' })
  @Post('upload')
  @UseGuards(OnlyForDevelopment)
  @UploadFilesMethod({ fields: ['file'] })
  async uploadPlugin(
    @UploadedFiles(
      new FilesValidationPipe({
        file: {
          maxSize: 1024 * 1024 * 10, // 10 MB
          acceptMimeType: ['application/gzip', 'application/x-compressed'],
          maxCount: 1,
        },
      }),
    )
    files: Pick<UploadPluginsAdminBody, 'file'>,
  ): Promise<void> {
    await this.uploadService.upload({ files });
  }

  @ApiCreatedResponse({ description: 'Plugin created', type: ShowPluginAdmin })
  @Post()
  @UseGuards(OnlyForDevelopment)
  async createPlugin(
    @Body() body: CreatePluginsAdminBody,
  ): Promise<ShowPluginAdmin> {
    return await this.createService.create(body);
  }

  @ApiOkResponse({ description: 'Plugin deleted' })
  @Delete(':id')
  @UseGuards(OnlyForDevelopment)
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

  @ApiOkResponse({ description: 'Plugin exported' })
  @Post(':code/export')
  @UseGuards(OnlyForDevelopment)
  async exportPlugin(
    @Param('code') code: string,
    @Body() body: ExportPluginsAdminBody,
    @Res() res: Response,
  ): Promise<void> {
    await this.exportService.export({ code, body, res });
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
