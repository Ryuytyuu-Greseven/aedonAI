import { IsString, MinLength } from 'class-validator';

export class AssignAgentDto {
  @IsString()
  @MinLength(1)
  assigned_agent: string;
}
