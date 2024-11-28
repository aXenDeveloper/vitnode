import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsEnum,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

import { PaginationObj, PaginationQuery } from '../utils/pagination.dto';
import { SortDirectionEnum } from '../utils/pagination.enum';
import { TransformString } from '../utils/text-language';
import { ShowPluginsAdminSortEnum } from './plugins.enum';

export class CreatePluginsAdminBody {
  @ApiProperty()
  @IsString()
  @MaxLength(100)
  @MinLength(3)
  @Transform(TransformString)
  author: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Transform(TransformString)
  author_url?: string;

  @ApiProperty()
  @IsString()
  @Matches(/^[a-z0-9-]*$/)
  @MaxLength(50)
  @MinLength(3)
  @Transform(TransformString)
  code: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(255)
  @Transform(TransformString)
  description?: string;

  @ApiProperty()
  @IsString()
  @MaxLength(100)
  @MinLength(3)
  @Transform(TransformString)
  name: string;

  @ApiProperty()
  @IsString()
  @Transform(TransformString)
  support_url: string;
}

export class ShowPluginAdmin {
  @ApiProperty()
  allow_default: boolean;

  @ApiProperty()
  author: string;

  @ApiPropertyOptional()
  author_url: null | string;

  @ApiProperty()
  code: string;

  @ApiProperty()
  created_at: Date;

  @ApiProperty()
  default: boolean;

  @ApiPropertyOptional()
  description: null | string;

  @ApiProperty()
  enabled: boolean;

  @ApiProperty()
  id: number;

  @ApiProperty()
  name: string;

  @ApiProperty()
  support_url: string;

  @ApiProperty()
  updated_at: Date;

  @ApiProperty()
  version: string;

  @ApiProperty()
  version_code: number;
}

export class ShowPluginsAdminObj extends PaginationObj {
  @ApiProperty({ type: [ShowPluginAdmin] })
  edges: ShowPluginAdmin[];
}

export class ShowPluginsAdminQuery extends PaginationQuery {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({
    enum: ShowPluginsAdminSortEnum,
  })
  @IsEnum(ShowPluginsAdminSortEnum)
  @IsOptional()
  sortBy?: ShowPluginsAdminSortEnum;

  @ApiPropertyOptional({ enum: SortDirectionEnum })
  @IsEnum(SortDirectionEnum)
  @IsOptional()
  sortDirection?: SortDirectionEnum;
}
