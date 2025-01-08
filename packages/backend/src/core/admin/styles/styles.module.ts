import { Module } from '@nestjs/common';

import { NavStylesAdminModule } from './nav/nav.module';
import { ThemeEditorStylesAdminModule } from './theme-editor/theme-editor.module';

@Module({
  imports: [NavStylesAdminModule, ThemeEditorStylesAdminModule],
})
export class StylesAdminModule {}
