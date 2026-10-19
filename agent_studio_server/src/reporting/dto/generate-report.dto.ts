import { IsIn, IsOptional, IsString } from 'class-validator';

export class GenerateReportDto {
  @IsIn(['daily', 'weekly', 'monthly', 'custom'])
  period: 'daily' | 'weekly' | 'monthly' | 'custom';

  @IsOptional()
  @IsString()
  startDate?: string;

  @IsOptional()
  @IsString()
  endDate?: string;
}
