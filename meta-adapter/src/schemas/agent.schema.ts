import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type AgentDocument = HydratedDocument<Agent>;

/** The agent's dialing rules (`agents.call_settings`); see callSettingsOf() for defaults. */
export interface AgentCallSettings {
  timezone: string;
  calling_hours_start: string;
  calling_hours_end: string;
  missed_call_retries: number;
  missed_call_retry_gap_minutes: number;
}

/**
 * Read-only mirror of the `agents` collection owned by lyreai_agent_builder_server.
 * meta-adapter only reads the fields it needs to place a lead's outbound call
 * through calls_input_gateway — it must never write to this collection.
 */
@Schema({ collection: 'agents' })
export class Agent {
  @Prop({ type: String, default: null })
  companyId: string | null;

  @Prop()
  agent_name: string;

  @Prop()
  agent_id: string;

  /** Routes the call to the right agent server in calls_input_gateway (its `business`). */
  @Prop()
  base_template_id?: string;

  /** The agent's own number — the gateway resolves the agent from the call's `from` number. */
  @Prop({ type: String, default: null })
  phone_number: string | null;

  @Prop()
  status: string;

  /** Absent on agents saved before call settings existed. */
  @Prop({ type: Object })
  call_settings?: Partial<AgentCallSettings> | null;
}

export const AgentSchema = SchemaFactory.createForClass(Agent);
