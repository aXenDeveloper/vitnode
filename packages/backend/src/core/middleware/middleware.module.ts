import { Module } from '@nestjs/common';

import { MiddlewareController } from './middleware.controller';
import { NavMiddlewareService } from './services/nav.service';
import { ShowMiddlewareService } from './services/show.service';

@Module({
  providers: [ShowMiddlewareService, NavMiddlewareService],
  controllers: [MiddlewareController],
  exports: [NavMiddlewareService],
})
export class MiddlewareModule {}
