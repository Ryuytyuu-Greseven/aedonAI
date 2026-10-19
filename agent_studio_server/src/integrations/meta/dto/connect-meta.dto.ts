import { IsNotEmpty, IsString } from 'class-validator';

export class ConnectMetaDto {
  /**
   * OAuth authorization code returned by Meta's login dialog. Single-use and
   * expires within minutes, so it's forwarded to meta-adapter immediately.
   */
  @IsString()
  @IsNotEmpty()
  code: string;
}
