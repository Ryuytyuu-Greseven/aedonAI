import { IsIn, IsNotEmpty, IsString } from 'class-validator';

/** Sent by calls_input_gateway when a carrier reports how a call ended. */
export class CallOutcomeDto {
  @IsIn(['twilio', 'exotel'])
  provider: 'twilio' | 'exotel';

  @IsString()
  @IsNotEmpty()
  callSid: string;

  /** Anything not answered (busy, no-answer, canceled, failed) is 'missed'. */
  @IsIn(['answered', 'missed'])
  outcome: 'answered' | 'missed';

  /** Carrier's raw final status, e.g. 'no-answer'. */
  @IsString()
  providerStatus: string;
}
