import { IsString, MinLength, ValidateIf } from 'class-validator';

export class AssignAgentDto {
  /** Agent id to assign, or `null` to unassign the number. */
  @ValidateIf((_dto, value) => value !== null)
  @IsString()
  @MinLength(1)
  assigned_agent: string | null;
}
