import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { Legal, LegalsObj, LegalsQuery } from 'vitnode-shared/legal.dto';

import { ItemLegalService } from './services/item.service';
import { ShowLegalService } from './services/show.service';

@ApiTags('Core')
@Controller('core/legal')
export class LegalController {
  constructor(
    private readonly showService: ShowLegalService,
    private readonly itemService: ItemLegalService,
  ) {}

  @ApiOkResponse({
    description: 'Item legal',
  })
  @Get(':code')
  async item(@Param('code') code: string): Promise<Legal> {
    return await this.itemService.item(code);
  }

  @ApiOkResponse({
    description: 'Show legal',
  })
  @Get()
  async show(@Query() query: LegalsQuery): Promise<LegalsObj> {
    return await this.showService.show(query);
  }
}
