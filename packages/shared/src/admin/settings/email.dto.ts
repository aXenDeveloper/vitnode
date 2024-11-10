import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsOptional, IsString } from 'class-validator';

import { FileObj } from '../../utils/files.dto';
import { PaginationObj, PaginationQuery } from '../../utils/pagination.dto';

export class TestEmailSettingsAdminBody {
  @ApiProperty()
  @IsString()
  message: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  preview_text?: string;

  @ApiProperty()
  @IsString()
  subject: string;

  @ApiProperty()
  @IsEmail()
  to: string;
}

export class EditEmailSettingsAdminBody {
  @ApiProperty({ example: 'hsl(220, 74%, 50%)' })
  @IsString()
  color_primary: string;

  @ApiProperty({ example: 'hsl(210, 40%, 98%)' })
  @IsString()
  color_primary_foreground: string;

  @ApiPropertyOptional({ example: false })
  delete_logo?: boolean;

  @ApiPropertyOptional({ type: 'string', format: 'binary' })
  logo?: Express.Multer.File;
}

export class ShowEmailSettingsAdminObj {
  @ApiProperty()
  color_primary: string;

  @ApiProperty()
  is_enabled: boolean;

  @ApiPropertyOptional()
  logo?: FileObj;
}

export class LogsEmailSettingsAdminQuery extends PaginationQuery {}

class LogEmailSettingsAdmin {
  @ApiProperty()
  created_at: Date;

  @ApiProperty()
  error: string;

  @ApiProperty()
  html: string;

  @ApiProperty()
  id: number;

  @ApiProperty()
  subject: string;

  @ApiProperty()
  to: string;
}

export class LogsEmailSettingsAdminObj extends PaginationObj {
  @ApiProperty({ type: [LogEmailSettingsAdmin] })
  edges: LogEmailSettingsAdmin[];
}
