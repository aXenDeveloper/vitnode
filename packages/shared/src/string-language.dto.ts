import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

export class StringLanguage {
  @ApiProperty()
  @IsString()
  language_code: string;

  @ApiProperty()
  @IsString()
  value: string;
}
