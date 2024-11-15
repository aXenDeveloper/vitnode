import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
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
  @IsString({ each: true })
  @IsOptional()
  delete_logos: string;

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
  @Min(1)
  @Max(30)
  mobile_width: number;

  @ApiProperty()
  @IsString()
  text: string;

  @ApiProperty({ example: 15 })
  @IsNumber()
  @Min(1)
  @Max(30)
  width: number;
}

export class EditThemeEditorStylesAdminObj {
  @ApiProperty()
  @IsObject()
  logos: LogosMiddleware;
}
