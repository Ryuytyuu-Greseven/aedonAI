import { IsNotEmpty, IsString } from 'class-validator';

export class ListPropertiesQueryDto {
  @IsString()
  @IsNotEmpty()
  agentId: string;
}
