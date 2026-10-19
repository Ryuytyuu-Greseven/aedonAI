import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsString,
  IsUrl,
  MinLength,
  ValidateNested,
} from 'class-validator';

export class NewKnowledgeBaseUrlDto {
  @IsString()
  @MinLength(1)
  label: string;

  @IsString()
  @IsUrl({ require_tld: false })
  url: string;
}

export class AddKnowledgeBaseUrlsDto {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => NewKnowledgeBaseUrlDto)
  newUrls: NewKnowledgeBaseUrlDto[];
}
