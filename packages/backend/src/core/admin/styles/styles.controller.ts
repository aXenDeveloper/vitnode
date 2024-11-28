import { AdminAuthGuard } from '@/guards/admin-auth.guard';
import { Body, Controller, Put, UseGuards } from '@nestjs/common';
import { ApiOkResponse, ApiSecurity, ApiTags } from '@nestjs/swagger';
import { EditorStylesAdminBody } from 'vitnode-shared/admin/styles/editor.dto';

import { EditorStylesAdminService } from './services/editor.service';

@ApiSecurity('admin')
@ApiTags('Admin')
@Controller('admin/styles')
@UseGuards(AdminAuthGuard)
export class StylesAdminController {
  constructor(private readonly editorStyles: EditorStylesAdminService) {}

  @ApiOkResponse({
    description: 'Editor settings updated',
    type: EditorStylesAdminBody,
  })
  @Put('editor')
  async editor(
    @Body() body: EditorStylesAdminBody,
  ): Promise<EditorStylesAdminBody> {
    return await this.editorStyles.editor(body);
  }
}
