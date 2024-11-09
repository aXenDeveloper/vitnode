import { Module } from '@nestjs/common';

import { NavStylesAdminModule } from './nav/nav.module';
import { EditorStylesAdminService } from './services/editor.service';
import { StylesAdminController } from './styles.controller';

@Module({
  providers: [EditorStylesAdminService],
  controllers: [StylesAdminController],
  imports: [NavStylesAdminModule],
})
export class StylesAdminModule {}
