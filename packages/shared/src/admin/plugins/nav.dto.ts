import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsArray,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

import { TransformString } from '../../utils/text-language';

export class CreateNavPluginsAdminBody {
  @ApiProperty()
  @MinLength(3)
  @MaxLength(100)
  @Transform(TransformString)
  @IsString()
  code: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  icon?: string;

  @ApiProperty({ isArray: true })
  @IsArray()
  @IsString({ each: true })
  keywords: string[];

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  parent_code?: string;
}

export class DeleteNavPluginsAdminBody {
  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  parent_code?: string;
}

export class ChangePositionNavPluginsAdminBody {
  @ApiProperty()
  @IsNumber()
  @Min(0)
  index_to_move: number;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  parent_code?: string;
}
