import {
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  Min,
  Validate,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';
import { MAX_MISSED_CALL_RETRIES } from '../../schemas/agent.schema';

const HH_MM = /^([01]\d|2[0-3]):[0-5]\d$/;

@ValidatorConstraint({ name: 'ianaTimeZone' })
class IanaTimeZone implements ValidatorConstraintInterface {
  validate(value: unknown): boolean {
    if (typeof value !== 'string' || !value) return false;
    try {
      new Intl.DateTimeFormat('en-US', { timeZone: value });
      return true;
    } catch {
      return false;
    }
  }

  defaultMessage(): string {
    return 'timezone must be an IANA time zone, e.g. Asia/Kolkata';
  }
}

/** Partial update of an agent's dialing rules; fields left out keep their value. */
export class UpdateCallSettingsDto {
  @IsOptional()
  @IsString()
  @Validate(IanaTimeZone)
  timezone?: string;

  @IsOptional()
  @Matches(HH_MM, { message: 'calling_hours_start must be HH:mm' })
  calling_hours_start?: string;

  @IsOptional()
  @Matches(HH_MM, { message: 'calling_hours_end must be HH:mm' })
  calling_hours_end?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(MAX_MISSED_CALL_RETRIES)
  missed_call_retries?: number;

  /** 5 minutes to 7 days. */
  @IsOptional()
  @IsInt()
  @Min(5)
  @Max(7 * 24 * 60)
  missed_call_retry_gap_minutes?: number;
}
