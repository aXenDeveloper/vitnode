import { ApiProperty, ApiPropertyOptional, OmitType } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean, IsEnum, IsOptional, IsString } from 'class-validator';

import { PaginationObj, PaginationQuery } from '../utils/pagination.dto';
import { SortDirectionEnum } from '../utils/pagination.enum';
import { TransformString } from '../utils/text-language';
import { ShowLanguagesAdminSortEnum } from './language.enum';

export class CreateLanguagesAdminBody {
  @ApiProperty()
  @IsBoolean()
  allow_in_input: boolean;

  @ApiProperty()
  @IsString()
  @Transform(TransformString)
  code: string;

  @ApiProperty()
  @IsString()
  @Transform(TransformString)
  name: string;

  @ApiProperty()
  @IsBoolean()
  time_24: boolean;

  @ApiProperty()
  @IsString()
  @Transform(TransformString)
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

export class ShowLanguagesAdminQuery extends PaginationQuery {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
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
