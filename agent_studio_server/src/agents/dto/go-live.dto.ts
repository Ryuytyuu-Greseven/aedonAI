import { IsNotEmpty, IsString } from 'class-validator';

export class GoLiveDto {
  /** Production phone number selected at go-live (not the staging number). */
  @IsString()
  @IsNotEmpty()
  phone_number: string;
}
