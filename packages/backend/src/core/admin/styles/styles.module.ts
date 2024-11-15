import { Module } from '@nestjs/common';

import { NavStylesAdminModule } from './nav/nav.module';
import { EditorStylesAdminService } from './services/editor.service';
import { StylesAdminController } from './styles.controller';
import { ThemeEditorStylesAdminModule } from './theme-editor/theme-editor.module';

@Module({
  providers: [EditorStylesAdminService],
  controllers: [StylesAdminController],
  imports: [NavStylesAdminModule, ThemeEditorStylesAdminModule],
})
export class StylesAdminModule {}
