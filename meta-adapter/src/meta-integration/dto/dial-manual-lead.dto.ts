import { IsMongoId, IsOptional, IsString, Matches, MaxLength } from 'class-validator';

/** Sent by agent_studio_server, which has already checked the agent belongs to the caller. */
export class DialManualLeadDto {
  @IsMongoId()
  agentId: string;

  @Matches(/^\+[1-9]\d{7,14}$/, { message: 'phoneNumber must be E.164' })
  phoneNumber: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  fullName?: string;

  /** IST day (YYYY-MM-DD) from agent_studio_server, so both sides agree on "today". */
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  leadDay: string;
}
