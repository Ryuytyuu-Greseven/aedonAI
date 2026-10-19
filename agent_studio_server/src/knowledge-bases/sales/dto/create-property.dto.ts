import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreatePropertyDto {
  /** The sales agent this property belongs to. */
  @IsString()
  @IsNotEmpty()
  agentId: string;

  @IsString()
  @IsNotEmpty()
  name: string;

  /** Free text — price, sqft, address, and anything else goes here. */
  @IsOptional()
  @IsString()
  description?: string;
}
