import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ArrayMinSize, IsArray, IsOptional, IsString } from 'class-validator';

import { StringLanguage } from './string-language.dto';
import { PageInfoObj, PaginationQuery } from './utils/pagination.dto';

export class LegalsQuery extends PaginationQuery {}

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

export class LegalsObj extends PageInfoObj {
  @ApiProperty({ type: [Legal] })
  edges: Legal[];
}
