import { ApiProperty } from '@nestjs/swagger';

import { PaginationObj, PaginationQuery } from '../utils/pagination.dto';

export class LogsAdminObj {
  @ApiProperty()
  created_at: Date;

  @ApiProperty()
  headers: string;

  @ApiProperty()
  id: number;

  @ApiProperty()
  message: string;

  @ApiProperty()
  method: string;

  @ApiProperty()
  name: string;

  @ApiProperty()
  status: number;

  @ApiProperty()
  url: string;
}

export class ShowLogsAdminObj extends PaginationObj {
  @ApiProperty({ type: [LogsAdminObj] })
  edges: LogsAdminObj[];
}

export class ShowLogsAdminQuery extends PaginationQuery {}
