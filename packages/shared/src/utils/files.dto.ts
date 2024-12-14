import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNumber, IsOptional, IsString } from 'class-validator';

export class FileObj {
  @ApiProperty()
  @IsString()
  dir_folder: string;

  @ApiProperty()
  @IsString()
  extension: string;

  @ApiProperty()
  @IsString()
  file_name: string;

  @ApiProperty()
  @IsString()
  file_name_original: string;

  @ApiProperty()
  @IsNumber()
  file_size: number;

  @ApiPropertyOptional()
  @IsNumber()
  @IsOptional()
  height: null | number;

  @ApiProperty()
  @IsString()
  mimetype: string;

  @ApiPropertyOptional()
  @IsNumber()
  @IsOptional()
  width: null | number;
}
