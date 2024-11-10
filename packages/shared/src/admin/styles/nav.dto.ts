import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { ArrayMinSize, IsArray, IsNumber, MaxLength } from 'class-validator';

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
  @Transform(TransformStringLanguageInput)
  @IsArray()
  @ApiProperty({ type: [StringLanguage] })
  description: StringLanguage[];

  @ApiProperty()
  external: boolean;

  @Transform(TransformString)
  @MaxLength(255)
  @ApiProperty()
  href: string;

  @ArrayMinSize(1)
  @IsArray()
  @Transform(TransformStringLanguageInput)
  @ApiProperty({ type: [StringLanguage] })
  name: StringLanguage[];
}
