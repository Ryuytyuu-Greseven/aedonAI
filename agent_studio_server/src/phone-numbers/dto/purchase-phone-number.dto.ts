import { Transform } from 'class-transformer';
import {
  IsIn,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import { PhoneNumberEnvType } from '../../schemas/phone-number.schema';
import { SUPPORTED_TELEPHONY_COUNTRIES } from '../../telephony/telephony-countries';
import {
  PHONE_NUMBER_TYPES,
  PhoneNumberType,
} from '../../telephony/telephony.types';

export class PurchasePhoneNumberDto {
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toUpperCase() : value,
  )
  @IsIn(SUPPORTED_TELEPHONY_COUNTRIES)
  country: string;

  /** E.164, exactly as returned by GET /phone-numbers/available. */
  @Matches(/^\+\d{8,15}$/, { message: 'phone_number must be E.164' })
  phone_number: string;

  /** Type the number was searched under; stored for display. */
  @IsOptional()
  @IsIn(PHONE_NUMBER_TYPES)
  number_type?: PhoneNumberType;

  /** Region/circle from the search result; stored for display. */
  @IsOptional()
  @IsString()
  @MaxLength(64)
  region?: string;

  @IsString()
  @MinLength(1)
  @MaxLength(80)
  label: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;

  @IsOptional()
  @IsIn(['staging', 'production'])
  envType?: PhoneNumberEnvType;
}
