import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsArray,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

import { LogosMiddleware } from '../../middleware.dto';

export class EditThemeEditorStylesAdminBody {
  @ApiPropertyOptional({ isArray: true, type: 'string' })
  @IsArray()
  @IsOptional()
  @IsString({ each: true })
  @Transform(({ value }) => value.split(','))
  delete_logos: string[];

  @ApiPropertyOptional({ type: 'string', format: 'binary' })
  logo_dark?: Express.Multer.File;

  @ApiPropertyOptional({ type: 'string', format: 'binary' })
  logo_light?: Express.Multer.File;

  @ApiPropertyOptional({ type: 'string', format: 'binary' })
  mobile_logo_dark?: Express.Multer.File;

  @ApiPropertyOptional({ type: 'string', format: 'binary' })
  mobile_logo_light?: Express.Multer.File;

  @ApiProperty({ example: 5 })
  @IsNumber()
  @Max(30)
  @Min(1)
  @Transform(({ value }) => +value)
  mobile_width: number;

  @ApiProperty()
  @IsString()
  text: string;

  @ApiProperty({ example: 15 })
  @IsNumber()
  @Max(30)
  @Min(1)
  @Transform(({ value }) => +value)
  width: number;
}

export class EditThemeEditorStylesAdminObj {
  @ApiProperty()
  @IsObject()
  logos: LogosMiddleware;
}
