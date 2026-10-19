import { IsIn, IsOptional } from 'class-validator';
import { PhoneNumberEnvType } from '../../schemas/phone-number.schema';

export class ListPhoneNumbersDto {
  @IsOptional()
  @IsIn(['staging', 'production'])
  envType?: PhoneNumberEnvType;
}
