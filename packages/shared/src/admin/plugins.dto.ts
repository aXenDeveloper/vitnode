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

import { PageInfoObj, PaginationQuery } from '../utils/pagination.dto';
import { SortDirectionEnum } from '../utils/pagination.enum';
import { TransformString } from '../utils/text-language';
import { ShowPluginsAdminSortEnum } from './plugins.enum';

export class ShowPluginsAdminQuery extends PaginationQuery {
  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
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

export class ShowPluginsAdminObj extends PageInfoObj {
  @ApiProperty({ type: [ShowPluginAdmin] })
  edges: ShowPluginAdmin[];
}

export class CreatePluginsAdminBody {
  @Transform(TransformString)
  @MinLength(3)
  @MaxLength(100)
  @ApiProperty()
  @IsString()
  author: string;

  @Transform(TransformString)
  @IsOptional()
  @ApiPropertyOptional()
  @IsString()
  author_url?: string;

  @Transform(TransformString)
  @MinLength(3)
  @MaxLength(50)
  @Matches(/^[a-z0-9-]*$/)
  @ApiProperty()
  @IsString()
  code: string;

  @Transform(TransformString)
  @MaxLength(255)
  @IsOptional()
  @ApiPropertyOptional()
  @IsString()
  description?: string;

  @Transform(TransformString)
  @ApiProperty()
  @MinLength(3)
  @MaxLength(100)
  @IsString()
  name: string;

  @Transform(TransformString)
  @ApiProperty()
  @IsString()
  support_url: string;
}
