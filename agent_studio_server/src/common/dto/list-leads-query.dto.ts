import { Type } from 'class-transformer';
import {
  IsDateString,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

/** Shared pagination/search/date-range query shape for lead-listing endpoints. */
export class ListLeadsQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;

  /** Case-insensitive substring match against name or phone number. */
  @IsOptional()
  @IsString()
  search?: string;

  /** Inclusive lower bound. */
  @IsOptional()
  @IsDateString()
  fromDate?: string;

  /** Inclusive upper bound. */
  @IsOptional()
  @IsDateString()
  toDate?: string;
}
