import { IsNotEmpty, IsString } from 'class-validator';

export class PreviewCallDto {
  @IsString()
  @IsNotEmpty()
  business: string;

  @IsString()
  @IsNotEmpty()
  agentId: string;

  /** Destination mobile number (the person being called). */
  @IsString()
  @IsNotEmpty()
  countryCode: string;

  @IsString()
  @IsNotEmpty()
  phone: string;
}
