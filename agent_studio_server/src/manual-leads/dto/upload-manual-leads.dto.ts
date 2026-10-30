import { ArrayMinSize, IsArray, IsObject } from 'class-validator';

export class UploadManualLeadsDto {
  /**
   * `{ fullName, phoneNumber, email }` rows from the reviewed sheet. Each row
   * is validated on its own so one bad row is rejected without failing the rest.
   */
  @IsArray()
  @ArrayMinSize(1)
  @IsObject({ each: true })
  leads: Record<string, unknown>[];
}
