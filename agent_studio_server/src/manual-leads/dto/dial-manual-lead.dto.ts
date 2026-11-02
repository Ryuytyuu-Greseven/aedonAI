import { IsOptional, IsString, Matches, MaxLength } from 'class-validator';

export class DialManualLeadDto {
  /** E.164, built by the UI from the chosen country + number. */
  @Matches(/^\+[1-9]\d{7,14}$/, { message: 'phoneNumber must be E.164' })
  phoneNumber: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  fullName?: string;
}
