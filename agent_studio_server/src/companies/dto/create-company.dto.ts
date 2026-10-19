import { IsEmail, IsPhoneNumber, IsString, MinLength } from 'class-validator';

export class CreateCompanyDto {
  @IsString()
  @MinLength(1)
  companyName: string;

  @IsString()
  @MinLength(1)
  address: string;

  @IsPhoneNumber()
  contactNo: string;

  @IsString()
  @MinLength(1)
  country: string;

  @IsEmail()
  email: string;
}
