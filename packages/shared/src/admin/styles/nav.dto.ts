import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsNumber,
  MaxLength,
} from 'class-validator';

import { StringLanguage } from '../../string-language.dto';
import {
  TransformString,
  TransformStringLanguageInput,
} from '../../utils/text-language';

export class ChangePositionNavStylesAdminBody {
  @ApiProperty()
  @IsNumber()
  id: number;

  @ApiProperty()
  @IsNumber()
  index_to_move: number;

  @ApiProperty()
  @IsNumber()
  parent_id: number;
}

export class CreateNavStylesAdminBody {
  @ApiProperty({ type: [StringLanguage] })
  @IsArray()
  @Transform(TransformStringLanguageInput)
  description: StringLanguage[];

  @ApiProperty()
  @IsBoolean()
  external: boolean;

  @ApiProperty()
  @MaxLength(255)
  @Transform(TransformString)
  href: string;

  @ApiProperty({ type: [StringLanguage] })
  @ArrayMinSize(1)
  @IsArray()
  @Transform(TransformStringLanguageInput)
  name: StringLanguage[];
}
