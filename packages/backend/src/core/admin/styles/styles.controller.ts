import { Controllers } from '@/helpers/controller.decorator';
import { Body, Put } from '@nestjs/common';
import { ApiOkResponse } from '@nestjs/swagger';
import { EditorStylesAdminBody } from 'vitnode-shared/admin/styles/editor.dto';

import { EditorStylesAdminService } from './services/editor.service';

@Controllers({
  plugin_name: 'Core',
  plugin_code: 'styles',
  isAdmin: true,
})
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
