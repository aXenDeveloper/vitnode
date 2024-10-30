import { Module } from '@nestjs/common';

import { LegalController } from './legal.controller';
import { ShowLegalService } from './services/show.service';

@Module({
  providers: [ShowLegalService],
  controllers: [LegalController],
})
export class LegalModule {}
