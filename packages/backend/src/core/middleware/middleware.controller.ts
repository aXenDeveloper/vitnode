import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { ShowMiddlewareObj } from 'vitnode-shared/middleware.dto';

import { ShowMiddlewareService } from './services/show.service';

@ApiTags('Core')
@Controller('core/middleware')
export class MiddlewareController {
  constructor(private readonly showService: ShowMiddlewareService) {}

  @ApiOkResponse({
    type: ShowMiddlewareObj,
    description: 'Show middleware',
  })
  @Get()
  async show(): Promise<ShowMiddlewareObj> {
    return this.showService.show();
  }
}
