import { Module } from '@nestjs/common';

import { EditThemeEditorStylesAdminService } from './service/edit.service';
import { ThemeEditorStylesAdminController } from './theme-editor.controller';

@Module({
  providers: [EditThemeEditorStylesAdminService],
  controllers: [ThemeEditorStylesAdminController],
})
export class ThemeEditorStylesAdminModule {}
