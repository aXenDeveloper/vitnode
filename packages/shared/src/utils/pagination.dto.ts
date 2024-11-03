import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsNumber, IsOptional } from 'class-validator';

export class PageInfo {
  @ApiProperty({ example: 0 })
  count: number;

  @ApiPropertyOptional({ example: null })
  end_cursor: number | undefined;

  @ApiProperty({ example: 0 })
  has_next_page: boolean;

  @ApiProperty({ example: 0 })
  has_previous_page: boolean;

  @ApiPropertyOptional({ example: null })
  start_cursor: number | undefined;

  @ApiProperty({ example: 0 })
  total_count: number;
}

export class PageInfoObj {
  @ApiProperty()
  page_info: PageInfo;
}

export class PaginationQuery {
  @ApiPropertyOptional({ example: null })
  @IsNumber()
  @IsOptional()
  @Transform(({ value }) => +value)
  cursor?: number;

  @ApiPropertyOptional({ example: null })
  @IsNumber()
  @IsOptional()
  @Transform(({ value }) => +value)
  first?: number;

  @ApiPropertyOptional({ example: null })
  @IsNumber()
  @IsOptional()
  @Transform(({ value }) => +value)
  last?: number;
}
