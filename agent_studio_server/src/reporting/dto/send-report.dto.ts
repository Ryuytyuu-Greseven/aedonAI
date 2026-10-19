import { IsEmail, IsOptional, IsString } from 'class-validator';

/**
 * "Recipient" is not modeled anywhere in the mock or the data model
 * (backend-openspec/specs/reporting/spec.md, open decision). Rather than
 * speculatively adding a contact field on Agent, this accepts the
 * recipient at send-time; revisit once a real provider/recipient-storage
 * decision is made.
 */
export class SendReportEmailDto {
  @IsEmail()
  recipient: string;

  @IsOptional()
  @IsString()
  filename?: string;
}

export class SendReportWhatsAppDto {
  @IsString()
  recipient: string;

  @IsOptional()
  @IsString()
  filename?: string;
}
