import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class UpdatePropertyDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  name?: string;

  /** Free text — price, sqft, address, and anything else goes here. */
  @IsOptional()
  @IsString()
  description?: string;
}
