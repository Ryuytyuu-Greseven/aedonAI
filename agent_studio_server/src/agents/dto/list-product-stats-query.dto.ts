import { Type } from 'class-transformer';
import {
  IsDateString,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

export const PRODUCT_STATS_SORT_KEYS = [
  'name',
  'enquiries',
  'uniqueCallers',
  'shortlisted',
  'purchaseIntent',
  'siteVisits',
  'conversionRate',
  'lastEnquiredAt',
] as const;
export type ProductStatsSortKey = (typeof PRODUCT_STATS_SORT_KEYS)[number];

/** Query for `GET /agents/:id/product-stats` — same paging/date names as `ListLeadsQueryDto`. */
export class ListProductStatsQueryDto {
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

  /** Case-insensitive substring match against the product name. */
  @IsOptional()
  @IsString()
  search?: string;

  /** Inclusive lower bound; defaults to 14 days before `toDate`. */
  @IsOptional()
  @IsDateString()
  fromDate?: string;

  /** Inclusive upper bound; defaults to now. */
  @IsOptional()
  @IsDateString()
  toDate?: string;

  @IsOptional()
  @IsIn(PRODUCT_STATS_SORT_KEYS)
  sort?: ProductStatsSortKey = 'enquiries';

  @IsOptional()
  @IsIn(['asc', 'desc'])
  order?: 'asc' | 'desc' = 'desc';
}
