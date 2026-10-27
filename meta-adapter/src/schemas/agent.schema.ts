import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type AgentDocument = HydratedDocument<Agent>;

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
}

export const AgentSchema = SchemaFactory.createForClass(Agent);
