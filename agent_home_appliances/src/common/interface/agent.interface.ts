export type AgentStatus = 'draft' | 'staged' | 'live' | 'disabled';
export type ToolKind = 'custom' | 'api_webhook' | 'sms' | 'whatsapp' | 'email';
export type Currency = 'USD' | 'INR' | 'AED' | 'THB' | 'GBP' | 'EUR';

export interface IReferralBonus {
    amount: number;
    currency: Currency;
}

export interface IMcpServer {
    server_name: string;
    url: string;
    api_key: string;
}

export interface IAgent {
    id?: string; // Mapped from _id by the toJSON transform

    companyId: string | null;
    agent_name: string;
    agent_id: string;
    country_code: string;
    phone_number: string | null;
    language: string;
    enable_voice: boolean;
    status: AgentStatus;
    nodes: any[];

    currentLanguage: string;

    base_template_id?: string;
    greeting?: string;
    behavior_prompt?: string;
    behavior_notes?: string;
    referral_bonus?: IReferralBonus;

    /** Knowledge bases this agent can access (canonical link ownership). */
    knowledge_base_ids: string[];

    /** MCP servers this agent can use for tool execution. */
    mcp_servers: IMcpServer[];

    preview_hash: string | null;
    current_stage_version: number;
    staged_at: Date | null;
    live_at: Date | null;

    // Internal Bookkeeping
    clone_base_name?: string;
    clone_number?: number;

    // Mongoose Timestamps
    created_at: Date;
    updated_at: Date;
}
