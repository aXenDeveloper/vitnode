import { ApiProperty, ApiPropertyOptional, OmitType } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean, IsEnum, IsOptional, IsString } from 'class-validator';

import { PaginationObj, PaginationQuery } from '../utils/pagination.dto';
import { SortDirectionEnum } from '../utils/pagination.enum';
import { TransformString } from '../utils/text-language';
import { ShowLanguagesAdminSortEnum } from './language.enum';

export class ShowLanguagesAdminQuery extends PaginationQuery {
  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  search?: string;

  @ApiPropertyOptional({
    enum: ShowLanguagesAdminSortEnum,
  })
  @IsEnum(ShowLanguagesAdminSortEnum)
  @IsOptional()
  sortBy?: ShowLanguagesAdminSortEnum;

  @ApiPropertyOptional({ enum: SortDirectionEnum })
  @IsEnum(SortDirectionEnum)
  @IsOptional()
  sortDirection?: SortDirectionEnum;
}

export class LanguagesAdminObj {
  @ApiProperty()
  allow_in_input: boolean;

  @ApiProperty()
  code: string;

  @ApiProperty()
  created_at: Date;

  @ApiProperty()
  default: boolean;

  @ApiProperty()
  enabled: boolean;

  @ApiProperty()
  id: number;

  @ApiProperty()
  locale: string;

  @ApiProperty()
  name: string;

  @ApiProperty()
  protected: boolean;

  @ApiProperty()
  time_24: boolean;

  @ApiProperty()
  timezone: string;

  @ApiProperty()
  updated_at: Date;
}

export class ShowLanguagesAdminObj extends PaginationObj {
  @ApiProperty({ type: [LanguagesAdminObj] })
  edges: LanguagesAdminObj[];
}

export class CreateLanguagesAdminBody {
  @ApiProperty()
  @IsBoolean()
  allow_in_input: boolean;

  @ApiProperty()
  @Transform(TransformString)
  @IsString()
  code: string;

  @ApiProperty()
  @IsString()
  locale: string;

  @ApiProperty()
  @Transform(TransformString)
  @IsString()
  name: string;

  @ApiProperty()
  @IsBoolean()
  time_24: boolean;

  @Transform(TransformString)
  @ApiProperty()
  @IsString()
  timezone: string;
}

export class EditLanguagesAdminBody extends OmitType(CreateLanguagesAdminBody, [
  'code',
] as const) {
  @ApiProperty()
  @IsBoolean()
  default: boolean;

  @ApiProperty()
  @IsBoolean()
  enabled: boolean;
}
