import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

import { StringLanguage } from './string-language.dto';
import { PaginationObj, PaginationQuery } from './utils/pagination.dto';

export class Legal {
  @ApiProperty()
  code: string;

  @ApiProperty({ type: [StringLanguage] })
  content: StringLanguage[];

  @ApiProperty()
  created_at: Date;

  @ApiPropertyOptional()
  href?: null | string;

  @ApiProperty()
  id: number;

  @ApiProperty({ type: [StringLanguage] })
  title: StringLanguage[];

  @ApiProperty()
  updated_at: Date;
}

export class LegalsObj extends PaginationObj {
  @ApiProperty({ type: [Legal] })
  edges: Legal[];
}

export class LegalsQuery extends PaginationQuery {}
