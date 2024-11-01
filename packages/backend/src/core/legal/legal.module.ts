import { Module } from '@nestjs/common';

import { LegalController } from './legal.controller';
import { ItemLegalService } from './services/item.service';
import { ShowLegalService } from './services/show.service';

@Module({
  providers: [ShowLegalService, ItemLegalService],
  controllers: [LegalController],
})
export class LegalModule {}
