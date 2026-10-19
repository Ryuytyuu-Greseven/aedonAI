import { IsNotEmpty, IsString } from 'class-validator';

export class AssignAgentToPageDto {
  @IsString()
  @IsNotEmpty()
  agentId: string;
}
