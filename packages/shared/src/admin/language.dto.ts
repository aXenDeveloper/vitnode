import { ApiProperty, ApiPropertyOptional, OmitType } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean, IsOptional, IsString } from 'class-validator';

import { PageInfoObj, PaginationQuery } from '../utils/pagination.dto';
import { TransformString } from '../utils/text-language';

export class ShowLanguagesAdminQuery extends PaginationQuery {
  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  search?: string;
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

export class ShowLanguagesAdminObj extends PageInfoObj {
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
