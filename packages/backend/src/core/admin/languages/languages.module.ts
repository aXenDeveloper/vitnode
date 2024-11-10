import { Module } from '@nestjs/common';

import { LanguagesAdminController } from './languages.controller';
import { CreateLanguagesAdminService } from './services/create.service';
import { DeleteLanguagesAdminService } from './services/delete.service';
import { EditLanguagesAdminService } from './services/edit.service';
import { ShowLanguagesAdminService } from './services/show.service';

@Module({
  providers: [
    ShowLanguagesAdminService,
    CreateLanguagesAdminService,
    EditLanguagesAdminService,
    DeleteLanguagesAdminService,
  ],
  controllers: [LanguagesAdminController],
})
export class LanguagesAdminModule {}
