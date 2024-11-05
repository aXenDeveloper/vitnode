import { Module } from '@nestjs/common';

import { NavStylesAdminModule } from './nav/nav.module';

@Module({
  imports: [NavStylesAdminModule],
})
export class StylesAdminModule {}
