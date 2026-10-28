import { IsMongoId } from 'class-validator';

export class GoLiveDto {
  /**
   * `phone_numbers` id of the production number customers will call (not the
   * staging number). Must be Available, production, in the agent's company,
   * and unassigned or already on this agent.
   */
  @IsMongoId()
  phone_number_id: string;
}
