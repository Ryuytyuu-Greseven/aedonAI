import { IsIn } from 'class-validator';
import { ReportFrequency } from '../../schemas/report-frequency.schema';

export class SetFrequencyDto {
  @IsIn(['daily', 'weekly', 'monthly'])
  frequency: ReportFrequency;
}
