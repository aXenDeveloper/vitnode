import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsNumber, IsOptional } from 'class-validator';

export class PageInfo {
  @ApiProperty({ example: 0 })
  count: number;

  @ApiPropertyOptional({ example: null })
  endCursor: number | undefined;

  @ApiProperty({ example: 0 })
  hasNextPage: boolean;

  @ApiProperty({ example: 0 })
  hasPreviousPage: boolean;

  @ApiPropertyOptional({ example: null })
  startCursor: number | undefined;

  @ApiProperty({ example: 0 })
  totalCount: number;
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
