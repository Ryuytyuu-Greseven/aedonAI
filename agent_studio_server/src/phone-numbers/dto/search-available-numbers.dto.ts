import { Transform, Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  Min,
} from 'class-validator';
import { SUPPORTED_TELEPHONY_COUNTRIES } from '../../telephony/telephony-countries';
import {
  PHONE_NUMBER_TYPES,
  PhoneNumberType,
} from '../../telephony/telephony.types';

const toUpper = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim().toUpperCase() : value;

export class SearchAvailableNumbersDto {
  /** ISO alpha-2; picks the provider (US → Twilio, IN → Exotel). */
  @Transform(toUpper)
  @IsIn(SUPPORTED_TELEPHONY_COUNTRIES)
  country: string;

  /** Defaults per country: `local` for US, `mobile` for IN. */
  @IsOptional()
  @IsIn(PHONE_NUMBER_TYPES)
  type?: PhoneNumberType;

  /** US only. */
  @IsOptional()
  @Matches(/^\d{3}$/, { message: 'areaCode must be 3 digits' })
  areaCode?: string;

  /** IN only: telecom circle code (KA, DL, MH, …). */
  @IsOptional()
  @Transform(toUpper)
  @Matches(/^[A-Z]{2}$/, { message: 'region must be a 2-letter circle code' })
  region?: string;

  @IsOptional()
  @IsString()
  @Matches(/^\d{1,10}$/, { message: 'contains must be 1–10 digits' })
  contains?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number;
}
