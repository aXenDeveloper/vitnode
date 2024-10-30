import { Controller, Get, Query } from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { LegalsObj, LegalsQuery } from 'vitnode-shared/legal.dto';

import { ShowLegalService } from './services/show.service';

@ApiTags('Core')
@Controller('core/legal')
export class LegalController {
  constructor(private readonly showService: ShowLegalService) {}

  @Get()
  @ApiOkResponse({
    description: 'Show legal',
  })
  async show(@Query() query: LegalsQuery): Promise<LegalsObj> {
    return await this.showService.show(query);
  }
}
