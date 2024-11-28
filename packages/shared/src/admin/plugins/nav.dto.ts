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

export class ChangePositionNavPluginsAdminBody {
  @ApiProperty()
  @IsNumber()
  @Min(0)
  index_to_move: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  parent_code?: string;
}

export class CreateNavPluginsAdminBody {
  @ApiProperty()
  @IsString()
  @MaxLength(100)
  @MinLength(3)
  @Transform(TransformString)
  code: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  icon?: string;

  @ApiProperty({ isArray: true })
  @IsArray()
  @IsString({ each: true })
  keywords: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  parent_code?: string;
}

export class DeleteNavPluginsAdminBody {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  parent_code?: string;
}
