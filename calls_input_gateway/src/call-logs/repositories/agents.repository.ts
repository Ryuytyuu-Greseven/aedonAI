import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Agent, AgentDocument, ActiveSession } from '../schemas/agents.schema';

@Injectable()
export class AgentsRepository {
    constructor(
        @InjectModel(Agent.name) private readonly agentModel: Model<AgentDocument>,
    ) { }

    async filterById(id: string): Promise<AgentDocument | null> {
        return this.agentModel.findById(id).exec();
    }

    async filterByAgentId(agentId: string): Promise<AgentDocument | null> {
        return this.agentModel.findOne({ agent_id: agentId }).exec();
    }

    /**
     * phone_number has no uniqueness constraint (draft/staged/live revisions
     * of the same business can share one) — only 'live' represents real
     * deployed traffic, so that's the status this filters to.
     */
    async filterByPhoneNumber(phoneNumber: string): Promise<AgentDocument | null> {
        return this.agentModel
            .findOne({ phone_number: phoneNumber, status: 'live' })
            .exec();
    }

    /**
     * Atomic $push — safe under concurrent call-starts on the same agent
     * (multiple simultaneous inbound calls, or telephony + webrtc at once).
     * A read-modify-write (fetch doc, mutate array, save) would lose
     * updates under that concurrency; $push does not.
     */
    async addActiveSession(agentMongoId: string, session: ActiveSession): Promise<void> {
        await this.agentModel
            .updateOne({ _id: agentMongoId }, { $push: { active_sessions: session } })
            .exec();
    }

    /**
     * Atomic $pull, matched by sessionId alone (unique per call). Same
     * atomicity rationale as addActiveSession, for the symmetric case of
     * one call ending while another on the same agent is still active.
     */
    async removeActiveSession(agentMongoId: string, sessionId: string): Promise<void> {
        await this.agentModel
            .updateOne(
                { _id: agentMongoId },
                { $pull: { active_sessions: { sessionId } } },
            )
            .exec();
    }
}
