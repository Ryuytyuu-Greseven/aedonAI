import { IsString, MinLength } from 'class-validator';

export class UpdateFrontlineAgentNameDto {
  @IsString()
  @MinLength(1)
  name: string;
}
