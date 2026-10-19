import { IsIn, IsOptional, IsString, MinLength } from 'class-validator';
import { PhoneNumberEnvType } from '../../schemas/phone-number.schema';

export class CreatePhoneNumberDto {
  @IsString()
  @MinLength(1)
  country_code: string;

  @IsString()
  @MinLength(1)
  phone_number: string;

  @IsString()
  @MinLength(1)
  label: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsIn(['staging', 'production'])
  envType?: PhoneNumberEnvType;
}
